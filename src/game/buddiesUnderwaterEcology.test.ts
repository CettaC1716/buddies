import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  OASIS_LILY_PAD_BASE_Y,
  UNDERWATER_DRAW_CALL_LIMIT,
  WATER_SURFACE_Y,
  buildUnderwaterEcology3D,
  evaluateFishTrackPose,
  evaluateSeabedElevation,
  evaluateWaterDepthAt,
  isPointClearOfPierAndQuay,
} from './buddiesUnderwaterEcology';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import { evaluateNwLakeSdf, evaluateSeHarborSdf } from './buddiesPlanetCurvature';

function createTestWindUniforms(): BlitzWindUniforms {
  return {
    uTime: { value: 0 },
    uWindPhase: { value: 0 },
    uWindDirection: { value: new THREE.Vector2(0.7071, 0.7071) },
    uWindStrength: { value: 0.35 },
    uWindGust: { value: 0.0 },
    uLightDirection: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
    uLightColor: { value: new THREE.Color('#fff4c8') },
    uShadowColor: { value: new THREE.Color('#3b6e52') },
  };
}

test('evaluateSeabedElevation slopes smoothly on NE & SE sandy beaches and drops steeply at Harbor Quay & Oasis Lake', () => {
  // Oasis Lake center (-31, 0) drops to -1.55m
  assert.ok(evaluateSeabedElevation(-31, 0) <= -1.5);
  assert.ok(evaluateWaterDepthAt(-31, 0) >= 1.3);

  // NE Taman Ria beach (z = -75, shoreX = 126.5): shallow crystal slope -> deep -1.65m
  const neNearShore = evaluateSeabedElevation(131.0, -75.0);
  const neMidSlope = evaluateSeabedElevation(134.5, -75.0);
  const neDeepSea = evaluateSeabedElevation(142.0, -75.0);
  assert.ok(neNearShore < WATER_SURFACE_Y, 'NE shallow seabed at x=131 sits below water surface');
  assert.ok(neMidSlope < neNearShore && neDeepSea < neMidSlope, 'NE seabed slopes downward seaward');
  assert.ok(Math.abs(neDeepSea - -1.65) < 0.02);

  // SE Beachfront (z = 75, shoreX = 110.0): shallow crystal slope -> deep -1.65m
  const seNearShore = evaluateSeabedElevation(114.5, 75.0);
  const seMidSlope = evaluateSeabedElevation(118.0, 75.0);
  const seDeepSea = evaluateSeabedElevation(125.0, 75.0);
  assert.ok(seNearShore < WATER_SURFACE_Y);
  assert.ok(seMidSlope < seNearShore && seDeepSea < seMidSlope);
  assert.ok(Math.abs(seDeepSea - -1.65) < 0.02);

  // Harbor Quay seawall (z = 0, x = 112.0): drops steeply to -1.65m
  assert.ok(evaluateSeabedElevation(112.0, 0.0) <= -1.6);
});

test('buildUnderwaterEcology3D meets <=5 draw-call budget, instanced bounds, fog, zero shadows/outlines, and clean dispose()', () => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbae2ff, 74, 132);
  const windUniforms = createTestWindUniforms();

  const handle = buildUnderwaterEcology3D(scene, windUniforms, false);

  assert.equal(handle.stats.drawCalls, 4);
  assert.ok(handle.stats.drawCalls <= UNDERWATER_DRAW_CALL_LIMIT, 'Total draw calls must be <= 5');
  assert.equal(handle.instancedMeshes.length, 4);
  assert.ok(
    handle.stats.pebblesCount >= 85 && handle.stats.pebblesCount <= 110,
    `Pebbles/boulders count ${handle.stats.pebblesCount} expected in [85..110]`,
  );
  assert.ok(
    handle.stats.coralAndKelpCount >= 75 && handle.stats.coralAndKelpCount <= 95,
    `Corals/kelp count ${handle.stats.coralAndKelpCount} expected in [75..95]`,
  );
  assert.equal(handle.stats.fishCount, 36);
  assert.equal(handle.stats.lilyPadsCount, 24);

  // Count actual rendered meshes attached to group (must be <= 5 and zero outline strokes)
  let meshCount = 0;
  let strokeCount = 0;
  handle.group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshCount++;
    if (obj.userData?.isModelStroke) strokeCount++;
  });
  assert.equal(meshCount, 4);
  assert.ok(meshCount <= UNDERWATER_DRAW_CALL_LIMIT);
  assert.equal(strokeCount, 0, 'Underwater ecology must have zero black cartoon outlines');

  // Strict performance flags & Linear THREE.Fog compliance on all 4 instanced batches
  for (const inst of handle.instancedMeshes) {
    assert.equal(inst.isInstancedMesh, true);
    assert.equal(inst.castShadow, false, `${inst.name} must disable castShadow`);
    assert.equal(inst.receiveShadow, false, `${inst.name} must disable receiveShadow`);
    assert.equal(inst.frustumCulled, true, `${inst.name} must enable frustumCulled`);
    assert.ok(
      inst.boundingSphere && Number.isFinite(inst.boundingSphere.radius) && inst.boundingSphere.radius > 0,
      `${inst.name} must have valid finite boundingSphere`,
    );
    const mat = inst.material as THREE.ShaderMaterial;
    assert.equal(mat.fog, true, `${inst.name} material must enable fog: true`);
    assert.ok('fogNear' in mat.uniforms && 'fogFar' in mat.uniforms && 'fogColor' in mat.uniforms);
  }

  // Static batches must lock matrixAutoUpdate = false
  assert.equal(handle.pebblesMesh.matrixAutoUpdate, false);
  assert.equal(handle.coralKelpMesh.matrixAutoUpdate, false);
  assert.equal(handle.lilyPadsMesh.matrixAutoUpdate, false);

  // Lily pad shader synchronizes with Oasis Lake wind & shore-damped wave uniforms
  const lilyMat = handle.lilyPadsMesh.material as THREE.ShaderMaterial;
  assert.ok('uWindStrength' in lilyMat.uniforms);
  assert.ok(handle.lilyPadsMesh.geometry.getAttribute('aPadShoreDamp'));

  // Verify frame update advances fish instance matrices without throwing & respects visibility gate
  const m0 = new THREE.Matrix4();
  const m1 = new THREE.Matrix4();
  handle.update(0.0, 0.0);
  handle.fishMesh.getMatrixAt(0, m0);
  handle.update(2.4, 2.4);
  handle.fishMesh.getMatrixAt(0, m1);
  assert.notDeepEqual(m0.elements, m1.elements, 'Fish matrices must animate smoothly over time');

  // Hidden group skips dynamic matrix updates cleanly
  handle.group.visible = false;
  handle.update(5.0, 5.0);
  const m2 = new THREE.Matrix4();
  handle.fishMesh.getMatrixAt(0, m2);
  assert.deepEqual(m1.elements, m2.elements, 'Hidden group update should early-return');

  // Dispose removes group from scene and cleans up safely (including idempotent repeat)
  assert.ok(scene.children.includes(handle.group));
  handle.dispose();
  assert.equal(scene.children.includes(handle.group), false);
  handle.dispose();
});

test('All swimming fish remain strictly inside waterSdf < -0.5 / lakeSdf < -0.5, below -0.20m, >= +0.16m above seabed, and clear of piers/quays across full cycle', () => {
  const scene = new THREE.Scene();
  const handle = buildUnderwaterEcology3D(scene, createTestWindUniforms(), false);

  const sampleTimes = [0, 0.7, 1.9, 3.4, 5.8, 9.2, 14.5, 22.0, 31.7, 45.0];
  for (const tr of handle.fishTracks) {
    assert.ok(tr.scale >= 1.15, `Fish #${tr.index} scale=${tr.scale} must stay clearly readable`);
    for (const t of sampleTimes) {
      const pose = evaluateFishTrackPose(tr, t);
      assert.ok(pose.y < -0.2, `Fish #${tr.index} at t=${t} rose too high: y=${pose.y.toFixed(3)}`);
      assert.ok(
        pose.y >= -0.68 && pose.y <= -0.3,
        `Fish #${tr.index} at t=${t} out of swim band [-0.68..-0.30]: y=${pose.y.toFixed(3)}`,
      );
      assert.ok(
        pose.clearanceAboveBed >= 0.159,
        `Fish #${tr.index} at t=${t} too close to seabed: clearance=${pose.clearanceAboveBed.toFixed(3)}`,
      );

      if (tr.zone === 'oasis_lake') {
        const lakeSdf = evaluateNwLakeSdf(pose.x, pose.z);
        assert.ok(
          lakeSdf < -0.5,
          `Oasis fish #${tr.index} at (${pose.x.toFixed(2)}, ${pose.z.toFixed(2)}) escaped lakeSdf=${lakeSdf.toFixed(2)}`,
        );
      } else {
        const { waterSdf } = evaluateSeHarborSdf(pose.x, pose.z);
        assert.ok(
          waterSdf < -0.5,
          `Ocean fish #${tr.index} at (${pose.x.toFixed(2)}, ${pose.z.toFixed(2)}) escaped waterSdf=${waterSdf.toFixed(2)}`,
        );
        assert.ok(
          isPointClearOfPierAndQuay(pose.x, pose.z, 1.0),
          `Ocean fish #${tr.index} intruded Bianglala pier or Harbor Quay at (${pose.x.toFixed(2)}, ${pose.z.toFixed(2)})`,
        );
      }
    }
  }

  handle.dispose();
});

test('Submerged pebbles, corals/kelp, and Oasis lily pads stay properly grounded, submerged, and clear of Bianglala Pier & Harbor Quay', () => {
  const scene = new THREE.Scene();
  const handle = buildUnderwaterEcology3D(scene, createTestWindUniforms(), false);

  for (const p of handle.pebblePlacements) {
    assert.ok(p.depth >= 0.18 && p.depth <= 1.35, `Pebble depth ${p.depth.toFixed(2)} outside [0.18..1.35]`);
    const maxLocalY = p.variant === 1 ? 0.13 : 0.25;
    assert.ok(
      p.y + maxLocalY * p.scale < WATER_SURFACE_Y,
      `Pebble top ${(p.y + maxLocalY * p.scale).toFixed(2)} protrudes above water surface`,
    );
    if (p.zone !== 'oasis_lake') {
      assert.ok(isPointClearOfPierAndQuay(p.x, p.z, 1.0), `Pebble at (${p.x}, ${p.z}) blocks pier/quay`);
      assert.ok(p.x >= 112.5, `Pebble at x=${p.x} too close to Harbor Quay x<112.5`);
      const inPierBox = p.x >= 115 && p.x <= 131 && p.z >= -43 && p.z <= -22;
      assert.equal(inPierBox, false, 'Pebble must not sit inside Bianglala Overwater Pier footprint');
    } else {
      assert.ok(evaluateNwLakeSdf(p.x, p.z) < 0, 'Oasis pebble must sit inside Oasis Lake');
    }
  }

  for (const c of handle.coralPlacements) {
    assert.ok(c.depth >= 0.2 && c.depth <= 1.4, `Coral/kelp depth ${c.depth.toFixed(2)} out of range`);
    if (c.zone !== 'oasis_lake') {
      assert.ok(isPointClearOfPierAndQuay(c.x, c.z, 1.0), `Coral at (${c.x}, ${c.z}) blocks pier/quay`);
      assert.ok(c.x >= 112.5, `Coral at x=${c.x} too close to Harbor Quay`);
    } else {
      assert.ok(evaluateNwLakeSdf(c.x, c.z) < -0.25);
    }
  }

  for (const pad of handle.lilyPadPlacements) {
    assert.equal(pad.y, OASIS_LILY_PAD_BASE_Y);
    const lakeSdf = evaluateNwLakeSdf(pad.x, pad.z);
    assert.ok(
      lakeSdf >= -3.4 && lakeSdf <= -0.9,
      `Lily pad at (${pad.x.toFixed(2)}, ${pad.z.toFixed(2)}) has lakeSdf=${lakeSdf.toFixed(2)} outside [-3.4..-0.9]`,
    );
  }

  handle.dispose();
});
