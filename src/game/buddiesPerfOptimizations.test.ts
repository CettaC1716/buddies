import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  computeAdaptiveDprTarget,
  evaluateAvatarOutlinePixelWidth,
  evaluateShadowMapRefreshDecision,
  getAvatarOutlineScreenSpaceProfile,
  shouldRefreshNightLightingFrame,
} from './buddiesPerfOptimizations';
import {
  invalidateCityWindowNightLightingCache,
  updateCityWindowNightLighting,
} from './buddiesNightLightingRules';

test('evaluateShadowMapRefreshDecision locks to integer texel multiple and throttles walking updates', () => {
  const right = { x: 1, y: 0, z: 0 };
  const up = { x: 0, y: 1, z: 0 };
  const back = { x: 0, y: 0, z: 1 };
  const texel = 72 / 2048; // ~0.03515625m

  // First frame always updates
  const init = evaluateShadowMapRefreshDecision({
    finalLookX: 0,
    finalLookZ: 0,
    shadowLightRight: right,
    shadowLightUp: up,
    shadowLightBack: back,
    shadowTexelWorldSize: texel,
    prevSnappedShadowX: Number.NaN,
    prevSnappedShadowZ: Number.NaN,
    frameTickCount: 1,
    lastShadowUpdateFrame: 0,
    maxStationaryIntervalFrames: 12,
    smoothedFrameMs: 16,
  });
  assert.equal(init.shouldUpdate, true);

  // Tiny 5cm walk step stays within the 6-texel (~21cm) stride -> no shadow re-render
  const microStep = evaluateShadowMapRefreshDecision({
    finalLookX: 0.05,
    finalLookZ: 0.04,
    shadowLightRight: right,
    shadowLightUp: up,
    shadowLightBack: back,
    shadowTexelWorldSize: texel,
    prevSnappedShadowX: init.snappedLookX,
    prevSnappedShadowZ: init.snappedLookZ,
    frameTickCount: 3,
    lastShadowUpdateFrame: 1,
    maxStationaryIntervalFrames: 12,
    smoothedFrameMs: 16,
  });
  assert.equal(microStep.shouldUpdate, false);

  // Walking > 0.25m on the very next frame after last update is throttled until min interval (2 frames)
  const throttledWalk = evaluateShadowMapRefreshDecision({
    finalLookX: 0.4,
    finalLookZ: 0,
    shadowLightRight: right,
    shadowLightUp: up,
    shadowLightBack: back,
    shadowTexelWorldSize: texel,
    prevSnappedShadowX: init.snappedLookX,
    prevSnappedShadowZ: init.snappedLookZ,
    frameTickCount: 2,
    lastShadowUpdateFrame: 1,
    maxStationaryIntervalFrames: 12,
    smoothedFrameMs: 16,
  });
  // Frame 2 is <= 2 (initial warm-up), test at frame 11 with last update at frame 10
  assert.equal(throttledWalk.shouldUpdate, true);
  const throttledMidGame = evaluateShadowMapRefreshDecision({
    finalLookX: 0.4,
    finalLookZ: 0,
    shadowLightRight: right,
    shadowLightUp: up,
    shadowLightBack: back,
    shadowTexelWorldSize: texel,
    prevSnappedShadowX: init.snappedLookX,
    prevSnappedShadowZ: init.snappedLookZ,
    frameTickCount: 11,
    lastShadowUpdateFrame: 10,
    maxStationaryIntervalFrames: 12,
    smoothedFrameMs: 16,
  });
  assert.equal(throttledMidGame.shouldUpdate, false);

  // Two frames later (frame 12) it updates and snaps to exact multiple of 6*texel
  const refreshedWalk = evaluateShadowMapRefreshDecision({
    finalLookX: 0.4,
    finalLookZ: 0,
    shadowLightRight: right,
    shadowLightUp: up,
    shadowLightBack: back,
    shadowTexelWorldSize: texel,
    prevSnappedShadowX: init.snappedLookX,
    prevSnappedShadowZ: init.snappedLookZ,
    frameTickCount: 12,
    lastShadowUpdateFrame: 10,
    maxStationaryIntervalFrames: 12,
    smoothedFrameMs: 16,
  });
  assert.equal(refreshedWalk.shouldUpdate, true);
  const ratio = refreshedWalk.snappedLookX / (texel * 6);
  assert.ok(Math.abs(ratio - Math.round(ratio)) < 1e-6);

  // Teleport (> 3m jump) updates immediately even 1 frame later
  const teleport = evaluateShadowMapRefreshDecision({
    finalLookX: 12.0,
    finalLookZ: 0,
    shadowLightRight: right,
    shadowLightUp: up,
    shadowLightBack: back,
    shadowTexelWorldSize: texel,
    prevSnappedShadowX: refreshedWalk.snappedLookX,
    prevSnappedShadowZ: refreshedWalk.snappedLookZ,
    frameTickCount: 13,
    lastShadowUpdateFrame: 12,
    maxStationaryIntervalFrames: 12,
    smoothedFrameMs: 30,
  });
  assert.equal(teleport.shouldUpdate, true);
});

test('computeAdaptiveDprTarget steps down under GPU pressure without dropping below native 1.0', () => {
  const stepDown1 = computeAdaptiveDprTarget({
    smoothedFrameMs: 25,
    currentDpr: 1.25,
    capDpr: 1.25,
    cooldownFrames: 0,
  });
  assert.equal(stepDown1.changed, true);
  assert.ok(stepDown1.nextDpr < 1.25 && stepDown1.nextDpr >= 1.0);
  assert.equal(stepDown1.nextCooldownFrames, 45);

  // Never steps below crisp 1.0 native CSS resolution even under heavy GPU load
  const floorClamp = computeAdaptiveDprTarget({
    smoothedFrameMs: 40,
    currentDpr: 1.0,
    capDpr: 1.25,
    cooldownFrames: 0,
  });
  assert.equal(floorClamp.changed, false);
  assert.equal(floorClamp.nextDpr, 1.0);

  const stepUp = computeAdaptiveDprTarget({
    smoothedFrameMs: 12,
    currentDpr: 1.0,
    capDpr: 1.25,
    cooldownFrames: 0,
  });
  assert.equal(stepUp.changed, true);
  assert.ok(stepUp.nextDpr > 1.0 && stepUp.nextDpr <= 1.25);
  assert.equal(stepUp.nextCooldownFrames, 90);

  const inCooldown = computeAdaptiveDprTarget({
    smoothedFrameMs: 35,
    currentDpr: 1.25,
    capDpr: 1.25,
    cooldownFrames: 10,
  });
  assert.equal(inCooldown.changed, false);
  assert.equal(inCooldown.nextCooldownFrames, 9);
});

test('thin anime outline profiles keep crisp fine stroke at gameplay distance and taper cleanly far away', () => {
  for (const kind of ['head', 'skin', 'cloth', 'hair_cutout'] as const) {
    const profile = getAvatarOutlineScreenSpaceProfile(kind);
    const closePx = evaluateAvatarOutlinePixelWidth(profile, 4.0);
    const thirdPersonPx = evaluateAvatarOutlinePixelWidth(profile, 15.0);
    const farPx = evaluateAvatarOutlinePixelWidth(profile, 60.0);

    assert.ok(
      closePx >= 0.7 && closePx <= 1.1,
      `${kind}: close-up thin anime outline should stay crisp and fine (0.7-1.1px), got ${closePx}`,
    );
    assert.ok(
      thirdPersonPx >= 0.7 && thirdPersonPx <= 1.05,
      `${kind}: third-person outline should stay fine and continuous (0.7-1.05px), got ${thirdPersonPx}`,
    );
    assert.ok(
      farPx < thirdPersonPx && farPx >= 0.35,
      `${kind}: far-distance outline should taper gracefully without blobbing, got ${farPx}`,
    );
    assert.ok(
      profile.depthBias > 0 && profile.depthBias < 0.0001,
      `${kind}: depthBias must stay tiny to stop z-fighting without floor clipping`,
    );
  }
});

test('shouldRefreshNightLightingFrame skips redundant daytime work and throttles steady night frames', () => {
  assert.equal(
    shouldRefreshNightLightingFrame({
      isDay: true,
      nightFactor: 0,
      elapsedSec: 1.0,
      hasAppliedInitial: false,
      prevWasDay: false,
      prevNightFactor: 0,
      prevElapsedSec: 0,
      registryGrew: false,
    }),
    true,
  );
  // Steady daytime: skip
  assert.equal(
    shouldRefreshNightLightingFrame({
      isDay: true,
      nightFactor: 0,
      elapsedSec: 1.016,
      hasAppliedInitial: true,
      prevWasDay: true,
      prevNightFactor: 0,
      prevElapsedSec: 1.0,
      registryGrew: false,
    }),
    false,
  );
  // Dusk transition: immediate update
  assert.equal(
    shouldRefreshNightLightingFrame({
      isDay: false,
      nightFactor: 0.3,
      elapsedSec: 1.016,
      hasAppliedInitial: true,
      prevWasDay: true,
      prevNightFactor: 0,
      prevElapsedSec: 1.0,
      registryGrew: false,
    }),
    true,
  );
  // Steady night within 16ms: skip
  assert.equal(
    shouldRefreshNightLightingFrame({
      isDay: false,
      nightFactor: 0.9,
      elapsedSec: 10.016,
      hasAppliedInitial: true,
      prevWasDay: false,
      prevNightFactor: 0.9,
      prevElapsedSec: 10.0,
      registryGrew: false,
    }),
    false,
  );
  // Steady night after 70ms: update
  assert.equal(
    shouldRefreshNightLightingFrame({
      isDay: false,
      nightFactor: 0.9,
      elapsedSec: 10.07,
      hasAppliedInitial: true,
      prevWasDay: false,
      prevNightFactor: 0.9,
      prevElapsedSec: 10.0,
      registryGrew: false,
    }),
    true,
  );
});

test('updateCityWindowNightLighting avoids full-scene rebuilds when dynamic crates are added/removed and skips daytime GPU uploads', () => {
  const scene = new THREE.Scene();
  const winGeo = new THREE.PlaneGeometry(1, 1);
  const winMat = new THREE.MeshStandardMaterial({ color: '#9ecae1' });
  const inst = new THREE.InstancedMesh(winGeo, winMat, 4);
  inst.name = 'PlazaWindowInstanced';
  inst.userData.cityWindowInstancedSpecs = [
    { id: 'w1', seed: 11, kind: 'upper_floor' },
    { id: 'w2', seed: 22, kind: 'upper_floor' },
    { id: 'w3', seed: 33, kind: 'civic' },
    { id: 'w4', seed: 44, kind: 'upper_floor' },
  ];
  scene.add(inst);

  // Initial daytime update initializes registry and sets daytime colors
  const count1 = updateCityWindowNightLighting(scene, 0.0, 1.0);
  assert.equal(count1, 1);
  const versionAfterInit = inst.instanceColor?.version ?? 0;

  // Second daytime frame should NOT upload instanceColor again
  updateCityWindowNightLighting(scene, 0.0, 1.016);
  assert.equal(inst.instanceColor?.version ?? 0, versionAfterInit);

  // Adding and removing a dynamic non-window crate should NOT trigger a full rebuild or GPU upload
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  crate.name = 'DynamicSupplyCrate';
  scene.add(crate);
  updateCityWindowNightLighting(scene, 0.0, 1.032);
  assert.equal(inst.instanceColor?.version ?? 0, versionAfterInit);
  scene.remove(crate);
  updateCityWindowNightLighting(scene, 0.0, 1.048);
  assert.equal(inst.instanceColor?.version ?? 0, versionAfterInit);

  // Switching to night DOES update instanceColor
  updateCityWindowNightLighting(scene, 0.95, 2.0);
  assert.ok((inst.instanceColor?.version ?? 0) > versionAfterInit);

  // Adding a brand new building with a window mesh IS still discovered incrementally!
  const newBuilding = new THREE.Group();
  const extraWin = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: '#a5d8ff' }),
  );
  extraWin.name = 'NewTowerWindow';
  extraWin.userData.cityWindowSpec = { id: 'extra', seed: 77, kind: 'upper_floor' };
  newBuilding.add(extraWin);
  scene.add(newBuilding);

  const countAfterBuilding = updateCityWindowNightLighting(scene, 0.95, 2.01);
  assert.equal(countAfterBuilding, 2);

  invalidateCityWindowNightLightingCache(scene);
  winGeo.dispose();
  winMat.dispose();
});
