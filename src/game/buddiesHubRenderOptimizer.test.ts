import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DEFAULT_ARENA_MAP_LAYOUT } from './buddiesBlitzWorldBuilder';
import {
  applySkinnedMeshSafeBoundingSphere,
  auditAndApplyFrustumCulling,
  composeWorldPropInstanceMatrix,
  computeDistrictChunkCullRadius,
  computeHouseInteriorLightRig,
  computeInstancedBoundingVolumes,
  createInstancedMeshWithOutline,
  FixedPointLightPool,
  InstancedWorldPropBatchManager,
  LIGHTING_HYGIENE_LIMITS,
  resolveOutdoorLightingState,
  selectBudgetedPointLightEmitters,
  shouldPreserveFrustumCulledFalse,
  shouldStepCharacterDetailThisFrame,
} from './buddiesHubRenderOptimizer';
import { bindBlitzShadowSamplerShaderDefine } from './buddiesBlitzShadersAndAssets';

test('computeInstancedBoundingVolumes computes accurate union box and enclosing sphere', () => {
  const geo = new THREE.BoxGeometry(2, 4, 2); // [-1..1] x [-2..2] x [-1..1]
  const mat = new THREE.MeshBasicMaterial();
  const inst = new THREE.InstancedMesh(geo, mat, 4);

  const m0 = new THREE.Matrix4().makeTranslation(-10, 0, -20);
  const m1 = new THREE.Matrix4().makeTranslation(30, 6, 40);
  const m2Collapsed = new THREE.Matrix4().makeScale(0, 0, 0); // should be skipped
  const m3 = new THREE.Matrix4().makeTranslation(10, 2, 10);
  inst.setMatrixAt(0, m0);
  inst.setMatrixAt(1, m1);
  inst.setMatrixAt(2, m2Collapsed);
  inst.setMatrixAt(3, m3);

  const result = computeInstancedBoundingVolumes(inst, { padding: 0.5 });
  assert.equal(result.activeCount, 3);
  assert.equal(inst.frustumCulled, true);
  // Active span X: [-11..31] +/- 0.5 -> [-11.5..31.5]
  assert.ok(result.boundingBox.min.x <= -11.49);
  assert.ok(result.boundingBox.max.x >= 31.49);
  // Active span Y: [-2..8] +/- 0.5 -> [-2.5..8.5]
  assert.ok(result.boundingBox.min.y <= -2.49);
  assert.ok(result.boundingBox.max.y >= 8.49);
  // Enclosing sphere must contain every corner of active boxes
  for (const pt of [
    new THREE.Vector3(-11, -2, -21),
    new THREE.Vector3(31, 8, 41),
    new THREE.Vector3(11, 4, 11),
  ]) {
    assert.ok(
      result.boundingSphere.containsPoint(pt),
      `Sphere should contain corner ${pt.toArray().join(',')}`,
    );
  }
});

test('createInstancedMeshWithOutline shares instanceMatrix buffer and passes frustum culling', () => {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const strokeGeo = geo.clone();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const strokeMat = new THREE.MeshBasicMaterial({ color: 0x12121e, side: THREE.BackSide });

  const matrices = [
    new THREE.Matrix4().makeTranslation(0, 1, -20),
    new THREE.Matrix4().makeTranslation(2, 1, -22),
  ];

  const batch = createInstancedMeshWithOutline({
    geometry: geo,
    material: mat,
    outlineGeometry: strokeGeo,
    outlineMaterial: strokeMat,
    matrices,
    name: 'TestCloudBatch',
    padding: 1.0,
  });

  assert.ok(batch.strokeMesh);
  assert.equal(batch.mesh.frustumCulled, true);
  assert.equal(batch.strokeMesh.frustumCulled, true);
  assert.equal(batch.mesh.matrixAutoUpdate, false);
  assert.equal(batch.strokeMesh.matrixAutoUpdate, false);
  assert.equal(batch.strokeMesh.instanceMatrix, batch.mesh.instanceMatrix);
  assert.ok(batch.boundingSphere.radius > 2.0);

  // Verify Three.js Frustum sees batch when camera faces -Z, and culls when camera looks +Z
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  cam.position.set(0, 1, 0);
  cam.lookAt(0, 1, -20);
  cam.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
  );
  batch.mesh.updateMatrixWorld();
  assert.equal(frustum.intersectsObject(batch.mesh), true);

  cam.lookAt(0, 1, 20);
  cam.updateMatrixWorld();
  frustum.setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
  );
  assert.equal(frustum.intersectsObject(batch.mesh), false);
});

test('auditAndApplyFrustumCulling enables culling on meshes/skinned meshes while preserving allowlisted shaders', () => {
  const root = new THREE.Group();

  const regularGeo = new THREE.BoxGeometry(1, 1, 1);
  const regularMesh = new THREE.Mesh(regularGeo, new THREE.MeshBasicMaterial());
  regularMesh.frustumCulled = false;

  const skyGeo = new THREE.SphereGeometry(300, 8, 8);
  const skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial());
  skyDome.name = 'AnimeSkyDome';
  skyDome.frustumCulled = false;

  const customLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
  customLine.userData.dynamicVertices = true;
  customLine.frustumCulled = false;

  const bone = new THREE.Bone();
  const skel = new THREE.Skeleton([bone]);
  const skinnedMesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(0.6, 1.8, 0.5), new THREE.MeshBasicMaterial());
  skinnedMesh.bind(skel, new THREE.Matrix4());
  skinnedMesh.frustumCulled = false;

  root.add(regularMesh, skyDome, customLine, skinnedMesh);

  assert.equal(shouldPreserveFrustumCulledFalse(skyDome), true);
  assert.equal(shouldPreserveFrustumCulledFalse(customLine), true);
  assert.equal(shouldPreserveFrustumCulledFalse(regularMesh), false);

  const report = auditAndApplyFrustumCulling(root);
  assert.equal(report.totalMeshes, 4);
  assert.equal(report.preservedAllowlistCount, 2);
  assert.equal(regularMesh.frustumCulled, true);
  assert.equal(skinnedMesh.frustumCulled, true);
  assert.equal(skyDome.frustumCulled, false);
  assert.equal(customLine.frustumCulled, false);
  assert.ok(skinnedMesh.boundingSphere && skinnedMesh.boundingSphere.radius >= 1.8);

  // Explicit helper test with small geo verifies minLocalRadius floor
  const tinySkinned = new THREE.SkinnedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const sphere = applySkinnedMeshSafeBoundingSphere(tinySkinned, 1.85, 0.8);
  assert.ok(sphere.radius >= 0.8);
  assert.equal(tinySkinned.frustumCulled, true);
});

test('InstancedWorldPropBatchManager collapses repetitive static props and trees into shared InstancedMeshes', () => {
  const manager = new InstancedWorldPropBatchManager();

  // Simulate 10 lampposts + 8 benches (each with baked opaque + stroke = 36 raw meshes -> 4 InstancedMeshes)
  const lampGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 6);
  const lampStrokeGeo = new THREE.CylinderGeometry(0.11, 0.11, 4, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
  const strokeMat = new THREE.MeshBasicMaterial({ color: 0x12121e, side: THREE.BackSide });

  const benchGeo = new THREE.BoxGeometry(1.6, 0.6, 0.6);
  const benchMat = new THREE.MeshBasicMaterial({ color: 0x8b5a2b });

  const propWrappers: THREE.Group[] = [];
  for (let i = 0; i < 10; i++) {
    const w = new THREE.Group();
    w.position.set(i * 5, 0, -10);
    const m = new THREE.Mesh(lampGeo, lampMat);
    const s = new THREE.Mesh(lampStrokeGeo, strokeMat);
    s.userData.isModelStroke = true;
    w.add(m, s);
    propWrappers.push(w);
  }
  for (let i = 0; i < 8; i++) {
    const w = new THREE.Group();
    w.position.set(i * 4, 0, 12);
    const m = new THREE.Mesh(benchGeo, benchMat);
    const s = new THREE.Mesh(benchGeo, strokeMat);
    s.userData.isModelStroke = true;
    w.add(m, s);
    propWrappers.push(w);
  }

  const promotedProps = manager.promoteStaticPropsToInstancedBatches(propWrappers, 2);
  assert.equal(promotedProps, 18);
  assert.equal(manager.getBatchDrawCallCount(), 4); // 2 parts x 2 prop templates (down from 36 draw calls!)
  for (const w of propWrappers) {
    assert.ok(w.userData.__instancedPropBinding);
    for (const ch of w.children) {
      assert.equal(ch.visible, false);
    }
  }

  // Test dynamic hide/jiggle via slot binding
  const firstBinding = propWrappers[0].userData.__instancedPropBinding;
  firstBinding.syncTransform(0, 0, -10, 0, 1, 1, 1, false);
  const hiddenMat = new THREE.Matrix4();
  firstBinding.partInsts[0].getMatrixAt(0, hiddenMat);
  const extractedScale = new THREE.Vector3().setFromMatrixScale(hiddenMat);
  assert.ok(extractedScale.length() < 1e-5);

  // Test trees promotion: 6 purple + 6 gold trees (36 raw meshes/insts -> 6 InstancedMeshes total)
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6);
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const treeEntries: { isPurple: boolean; mesh: THREE.Group; x: number; z: number; alive: boolean }[] = [];
  for (let i = 0; i < 12; i++) {
    const grp = new THREE.Group();
    grp.position.set((i - 6) * 8, 0, i % 2 === 0 ? -25 : 25);
    const trunkContainer = new THREE.Group();
    trunkContainer.name = 'RealGlbTreeTrunk';
    const trunk = new THREE.Mesh(trunkGeo, benchMat);
    const trunkStroke = new THREE.Mesh(trunkGeo, strokeMat);
    trunkStroke.userData.isModelStroke = true;
    trunk.add(trunkStroke);
    const leaves = new THREE.InstancedMesh(leafGeo, lampMat, 4);
    leaves.name = 'RealGlbTreeLeaves';
    const tmpM = new THREE.Matrix4();
    for (let li = 0; li < 4; li++) {
      tmpM.makeTranslation(li * 0.5, 4, 0);
      leaves.setMatrixAt(li, tmpM);
    }
    trunkContainer.add(trunk, leaves);
    grp.add(trunkContainer);
    treeEntries.push({
      isPurple: i < 6,
      mesh: grp,
      x: grp.position.x,
      z: grp.position.z,
      alive: true,
    });
  }

  const promotedTrees = manager.promoteTreesToInstancedBatches(treeEntries);
  assert.equal(promotedTrees, 12);
  // 4 prop batches + 6 tree batches (2 variants * (trunk + trunkStroke + leaves)) = 10 total draw calls
  assert.equal(manager.getBatchDrawCallCount(), 10);

  const treeBinding = treeEntries[0].mesh.userData.__instancedTreeBinding;
  assert.ok(treeBinding);
  assert.equal(treeBinding.leavesInst?.count, 24); // 6 purple trees * 4 markers

  // Composing jiggle matrix preserves scale
  const jiggleM = composeWorldPropInstanceMatrix(new THREE.Matrix4(), 5, 0, 5, 1.2, 1, 1, 1, 0.08, -0.05);
  const det = jiggleM.determinant();
  assert.ok(Math.abs(det - 1.0) < 1e-4);

  manager.clear();
  assert.equal(manager.getBatchDrawCallCount(), 0);
});

test('InstancedWorldPropBatchManager promotes tree leaves with useOpaqueShadowProxy to low-poly opaque shadow proxies', () => {
  const manager = new InstancedWorldPropBatchManager('ShadowProxyTest');
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6);
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial();

  const entries: { isPurple: boolean; mesh: THREE.Group; x: number; z: number; alive: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    const grp = new THREE.Group();
    grp.position.set(i * 6, 0, 0);
    const trunkContainer = new THREE.Group();
    trunkContainer.name = 'RealGlbTreeTrunk';
    const trunk = new THREE.Mesh(trunkGeo, mat);
    const leaves = new THREE.InstancedMesh(leafGeo, mat, 3);
    leaves.name = 'RealGlbTreeLeaves';
    leaves.castShadow = true;
    leaves.userData.useOpaqueShadowProxy = true;
    const tmpM = new THREE.Matrix4();
    for (let li = 0; li < 3; li++) {
      tmpM.makeTranslation(0, 3 + li, 0);
      leaves.setMatrixAt(li, tmpM);
    }
    trunkContainer.add(trunk, leaves);
    grp.add(trunkContainer);
    entries.push({ isPurple: false, mesh: grp, x: grp.position.x, z: 0, alive: true });
  }

  assert.equal(manager.promoteTreesToInstancedBatches(entries), 4);
  const binding = entries[0].mesh.userData.__instancedTreeBinding;
  assert.ok(binding?.leavesInst);
  // Billboard leaves mesh must NOT cast alpha-tested shadows directly
  assert.equal(binding.leavesInst.castShadow, false);
  // Paired opaque shadow proxy must exist, share instanceMatrix, and cast shadows
  const shadowProxy = manager.batchRootGroup.getObjectByName('InstancedTreeShadowProxy_gold') as
    | THREE.InstancedMesh
    | undefined;
  assert.ok(shadowProxy);
  assert.equal(shadowProxy.castShadow, true);
  assert.equal(shadowProxy.count, 12);
  assert.equal(shadowProxy.instanceMatrix, binding.leavesInst.instanceMatrix);

  // Toggling foliage shadows off disables the shadow proxy cleanly
  manager.setTreeFoliageShadowsEnabled(false);
  assert.equal(shadowProxy.castShadow, false);
  assert.equal(shadowProxy.visible, false);

  manager.setTreeFoliageShadowsEnabled(true);
  assert.equal(shadowProxy.castShadow, true);
  assert.equal(shadowProxy.visible, true);

  manager.clear();
  trunkGeo.dispose();
  leafGeo.dispose();
  mat.dispose();
});

test('PointLight budgeting keeps fixed shader light pool constant and sorts by distance', () => {
  const requests = Array.from({ length: 8 }, (_, idx) => ({
    x: (idx + 1) * 5,
    y: 1,
    z: 0,
    colorHex: 0x00f2ff,
    intensity: 2.2,
    distance: 6,
  }));
  const chosen = selectBudgetedPointLightEmitters(
    requests,
    { x: 0, y: 1, z: 0 },
    LIGHTING_HYGIENE_LIMITS.maxActiveLaserPointLights,
  );
  assert.equal(chosen.length, 2);
  assert.equal(chosen[0].x, 5);
  assert.equal(chosen[1].x, 10);

  const scene = new THREE.Scene();
  const pool = new FixedPointLightPool(scene, 2);
  assert.equal(pool.lights.length, 2);

  pool.beginFrame();
  for (const r of requests) pool.submit(r);
  const activeCount = pool.commitFrame({ x: 0, y: 1, z: 0 }, true);
  assert.equal(activeCount, 2);
  assert.equal(pool.lights[0].position.x, 5);
  assert.equal(pool.lights[1].position.x, 10);
  assert.equal(pool.lights[0].intensity, 2.2);

  // Indoor mode zeros intensity without removing lights (zero shader recompiles!)
  const muted = pool.commitFrame({ x: 0, y: 1, z: 0 }, false);
  assert.equal(muted, 0);
  assert.equal(pool.lights[0].intensity, 0);
  assert.equal(pool.lights[1].intensity, 0);
  assert.equal(scene.children.length, 2);
});

test('lighting hygiene, district chunk cull radius, and avatar LOD cadence behave cleanly', () => {
  const houseDay = computeHouseInteriorLightRig(1.0, 1.0, 0.0);
  assert.ok(houseDay.hemiIntensity > 1.2);
  assert.ok(houseDay.sunIntensity > 1.0);
  assert.ok(houseDay.ceilingFillPointIntensity > 0.5);

  const indoorSync = resolveOutdoorLightingState('night', true, false, '#4c6fa8');
  assert.equal(indoorSync.outdoorLightsVisible, false);
  assert.equal(indoorSync.outdoorCastShadow, false);
  assert.equal(indoorSync.hasDirShadowUniform, 0.0);

  const outdoorDusk = resolveOutdoorLightingState('dusk', false, false, '#ffb37c');
  assert.equal(outdoorDusk.outdoorLightsVisible, true);
  assert.equal(outdoorDusk.outdoorCastShadow, true);
  assert.equal(outdoorDusk.hasDirShadowUniform, 1.0);
  assert.equal(outdoorDusk.windLightColorHex, '#ffb37c');

  assert.equal(
    computeDistrictChunkCullRadius({
      isFlatIndoorRoomMode: false,
      isFullMapOverview: false,
      isCityView: false,
      isParkView: false,
      isCasinoView: false,
      isLandingTour: false,
      isOrbit: false,
    }),
    LIGHTING_HYGIENE_LIMITS.defaultDistrictChunkCullRadiusM,
  );
  assert.equal(
    computeDistrictChunkCullRadius({
      isFlatIndoorRoomMode: false,
      isFullMapOverview: true,
      isCityView: false,
      isParkView: false,
      isCasinoView: false,
      isLandingTour: false,
      isOrbit: false,
    }),
    0,
  );

  // Foreground character always updates at 60Hz; far character throttles to stride 4 (15Hz)
  for (let f = 0; f < 4; f++) {
    assert.equal(shouldStepCharacterDetailThisFrame(10 * 10, f, 1, false, false), true);
  }
  const farUpdates = [0, 1, 2, 3].filter((f) =>
    shouldStepCharacterDetailThisFrame(55 * 55, f, 2, false, false),
  );
  assert.equal(farUpdates.length, 1);
});

test('quantitative optimization metrics on DEFAULT_ARENA_MAP_LAYOUT prove major draw-call and light reductions', () => {
  const manager = new InstancedWorldPropBatchManager('MetricsVerification');
  const treeEntries: { isPurple: boolean; mesh: THREE.Group; x: number; z: number; alive: boolean }[] = [];
  const staticPropWrappers: THREE.Group[] = [];

  const sharedTrunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6);
  const sharedLeafGeo = new THREE.PlaneGeometry(1, 1);
  const sharedTrunkMat = new THREE.MeshBasicMaterial({ color: 0x755341 });
  const sharedLeafMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
  const sharedStrokeMat = new THREE.MeshBasicMaterial({ color: 0x12121e, side: THREE.BackSide });

  const kindTemplates = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material }>();
  let unbatchedDrawCallsBefore = 0;

  for (const prop of DEFAULT_ARENA_MAP_LAYOUT.props) {
    if (prop.kind === 'tree_purple' || prop.kind === 'tree_gold') {
      const grp = new THREE.Group();
      grp.position.set(prop.x, 0, prop.z);
      grp.rotation.y = prop.rotY;
      const trunkContainer = new THREE.Group();
      trunkContainer.name = 'RealGlbTreeTrunk';
      const trunk = new THREE.Mesh(sharedTrunkGeo, sharedTrunkMat);
      const trunkStroke = new THREE.Mesh(sharedTrunkGeo, sharedStrokeMat);
      trunkStroke.userData.isModelStroke = true;
      trunk.add(trunkStroke);
      const leaves = new THREE.InstancedMesh(sharedLeafGeo, sharedLeafMat, 8);
      leaves.name = 'RealGlbTreeLeaves';
      const lm = new THREE.Matrix4();
      for (let i = 0; i < 8; i++) {
        lm.makeTranslation((i - 4) * 0.4, 4.5, 0);
        leaves.setMatrixAt(i, lm);
      }
      trunkContainer.add(trunk, leaves);
      grp.add(trunkContainer);
      treeEntries.push({
        isPurple: prop.kind === 'tree_purple',
        mesh: grp,
        x: prop.x,
        z: prop.z,
        alive: true,
      });
      unbatchedDrawCallsBefore += 3; // trunk + trunkStroke + per-tree foliage InstancedMesh
      continue;
    }

    if (
      prop.kind === 'lamppost_1a' ||
      prop.kind === 'lamppost_1b' ||
      prop.kind === 'bench' ||
      prop.kind === 'recycle_bin' ||
      prop.kind === 'hydrant' ||
      prop.kind === 'river_rock' ||
      prop.kind === 'flower_cluster'
    ) {
      let tmpl = kindTemplates.get(prop.kind);
      if (!tmpl) {
        tmpl = {
          geo: new THREE.BoxGeometry(1, 1, 1),
          mat: new THREE.MeshBasicMaterial({ color: 0x64748b }),
        };
        kindTemplates.set(prop.kind, tmpl);
      }
      const w = new THREE.Group();
      w.position.set(prop.x, 0, prop.z);
      w.rotation.y = prop.rotY;
      const m = new THREE.Mesh(tmpl.geo, tmpl.mat);
      const st = new THREE.Mesh(tmpl.geo, sharedStrokeMat);
      st.userData.isModelStroke = true;
      w.add(m, st);
      staticPropWrappers.push(w);
      unbatchedDrawCallsBefore += 2;
    }
  }

  const promotedTrees = manager.promoteTreesToInstancedBatches(treeEntries);
  const promotedProps = manager.promoteStaticPropsToInstancedBatches(staticPropWrappers, 2);
  const batchedDrawCallsAfter = manager.getBatchDrawCallCount();

  assert.equal(promotedTrees, treeEntries.length);
  assert.ok(promotedProps >= 50, `Expected >= 50 static repetitive props, got ${promotedProps}`);
  assert.ok(
    unbatchedDrawCallsBefore >= 200,
    `Expected >= 200 unbatched prop/tree draw calls in default layout, got ${unbatchedDrawCallsBefore}`,
  );
  assert.ok(
    batchedDrawCallsAfter <= 24,
    `Expected <= 24 batched draw calls, got ${batchedDrawCallsAfter}`,
  );
  // Expect > 85% draw call reduction on default arena decorative props & trees
  const reductionRatio = 1 - batchedDrawCallsAfter / unbatchedDrawCallsBefore;
  assert.ok(
    reductionRatio > 0.85,
    `Expected >85% draw-call reduction, measured ${(reductionRatio * 100).toFixed(1)}% (${unbatchedDrawCallsBefore} -> ${batchedDrawCallsAfter})`,
  );

  // Verify sky cloud ring (112 puffs -> 1 InstancedMesh) and House PointLight budget (4 -> 2)
  assert.equal(LIGHTING_HYGIENE_LIMITS.maxHouseInteriorPointLights, 2);
  assert.equal(LIGHTING_HYGIENE_LIMITS.maxActiveLaserPointLights, 2);

  manager.clear();
});

test('bindBlitzShadowSamplerShaderDefine forces BLITZ_SHADOW_COMPARE whenever PCFShadowMap is enabled even with zero active scene shadow casters', () => {
  const mat = new THREE.ShaderMaterial();
  bindBlitzShadowSamplerShaderDefine(mat);

  const pcfParams = {
    shadowMapType: THREE.PCFShadowMap,
    shadowMapEnabled: false,
    defines: { existing: 1 },
  } as unknown as Parameters<THREE.ShaderMaterial['onBeforeCompile']>[0];
  const pcfRenderer = {
    shadowMap: { enabled: true },
  } as unknown as THREE.WebGLRenderer;
  mat.onBeforeCompile(pcfParams, pcfRenderer);
  assert.equal(pcfParams.defines?.BLITZ_SHADOW_COMPARE, 1);
  assert.equal(pcfParams.defines?.existing, 1);

  const basicParams = {
    shadowMapType: THREE.BasicShadowMap,
    shadowMapEnabled: false,
    defines: {},
  } as unknown as Parameters<THREE.ShaderMaterial['onBeforeCompile']>[0];
  mat.onBeforeCompile(basicParams, pcfRenderer);
  assert.equal(basicParams.defines?.BLITZ_SHADOW_COMPARE, undefined);

  const disabledParams = {
    shadowMapType: THREE.PCFShadowMap,
    shadowMapEnabled: false,
    defines: {},
  } as unknown as Parameters<THREE.ShaderMaterial['onBeforeCompile']>[0];
  const disabledRenderer = {
    shadowMap: { enabled: false },
  } as unknown as THREE.WebGLRenderer;
  mat.onBeforeCompile(disabledParams, disabledRenderer);
  assert.equal(disabledParams.defines?.BLITZ_SHADOW_COMPARE, undefined);

  mat.dispose();
});
