import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import {
  buildHorizonCliffBackdrop3D,
  enableSceneLinearFog,
  evaluateHorizonFogAndFarClip,
  evaluateHorizonLinearFogFactor,
  HORIZON_BACKDROP_DRAW_CALL_LIMIT,
  HORIZON_CLEAR_FOG_COLOR_HEX,
  syncSceneHorizonFogAndFarClip,
} from './buddiesHorizonOptimizer';
import { getBaseProceduralGroundElevation } from './buddiesPlanetCurvature';

test('Linear THREE.Fog calibration keeps City landmarks crisp while dissolving West cliff cutoff', () => {
  // 1. Gameplay eye-level / follow view
  const gameplay = evaluateHorizonFogAndFarClip({ mode: 'gameplay' });
  assert.equal(gameplay.fogEnabled, true);
  assert.equal(gameplay.fogColorHex, HORIZON_CLEAR_FOG_COLOR_HEX);
  assert.equal(gameplay.cameraFar, gameplay.fogFar + gameplay.farClipBuffer);
  assert.ok(gameplay.cameraFar < 220, `gameplay camera.far (${gameplay.cameraFar}) should cut far overdraw`);
  assert.equal(evaluateHorizonLinearFogFactor(45, gameplay.fogNear, gameplay.fogFar), 0);
  assert.equal(evaluateHorizonLinearFogFactor(gameplay.fogFar, gameplay.fogNear, gameplay.fogFar), 1);

  // 2. Seated eye-level bench view
  const seated = evaluateHorizonFogAndFarClip({ mode: 'seated' });
  assert.equal(seated.fogEnabled, true);
  assert.equal(seated.cameraFar, seated.fogFar + seated.farClipBuffer);
  assert.equal(evaluateHorizonLinearFogFactor(48, seated.fogNear, seated.fogFar), 0);
  assert.ok(
    evaluateHorizonLinearFogFactor(110, seated.fogNear, seated.fogFar) > 0.9,
    'seated view should dissolve outer West plateau edge (>=110m) cleanly into sky',
  );

  // 3. #kota City Overview (dist = 138m default)
  const kota = evaluateHorizonFogAndFarClip({ mode: 'city_overview', cameraDistanceM: 138 });
  assert.equal(kota.fogEnabled, true);
  assert.equal(kota.cameraFar, kota.fogFar + kota.farClipBuffer);
  assert.ok(kota.cameraFar < 400, `#kota camera.far (${kota.cameraFar}) must be tightly aligned, not 900-1000`);
  // Tennis (~79m), Plaza (~113m), Central Park (~140m), Grand Casino (~155m), North Res (~183m) stay crisp (< near)
  assert.equal(evaluateHorizonLinearFogFactor(79, kota.fogNear, kota.fogFar), 0);
  assert.equal(evaluateHorizonLinearFogFactor(113, kota.fogNear, kota.fogFar), 0);
  assert.equal(evaluateHorizonLinearFogFactor(140, kota.fogNear, kota.fogFar), 0);
  assert.equal(evaluateHorizonLinearFogFactor(155, kota.fogNear, kota.fogFar), 0);
  assert.equal(evaluateHorizonLinearFogFactor(183, kota.fogNear, kota.fogFar), 0);
  // Outer plateau fades smoothly into horizon sky
  assert.equal(evaluateHorizonLinearFogFactor(kota.fogFar, kota.fogNear, kota.fogFar), 1);

  // 4. District Views (#plaza dist=50, #casino dist=56, #tennis dist=36)
  const plaza = evaluateHorizonFogAndFarClip({ mode: 'city_district', cameraDistanceM: 50 });
  assert.equal(evaluateHorizonLinearFogFactor(50, plaza.fogNear, plaza.fogFar), 0);
  assert.equal(evaluateHorizonLinearFogFactor(116, plaza.fogNear, plaza.fogFar), 1);
  assert.equal(plaza.cameraFar, plaza.fogFar + plaza.farClipBuffer);

  const casino = evaluateHorizonFogAndFarClip({ mode: 'city_district', cameraDistanceM: 56 });
  assert.equal(evaluateHorizonLinearFogFactor(56, casino.fogNear, casino.fogFar), 0);
  assert.ok(evaluateHorizonLinearFogFactor(120, casino.fogNear, casino.fogFar) > 0.9);
  assert.equal(casino.cameraFar, casino.fogFar + casino.farClipBuffer);
});

test('syncSceneHorizonFogAndFarClip recovers from null/FogExp2, aligns camera.far lazily, and composes with weatherEnvState', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 1000);
  let projUpdateCount = 0;
  const origUpdateProj = camera.updateProjectionMatrix.bind(camera);
  camera.updateProjectionMatrix = () => {
    projUpdateCount++;
    origUpdateProj();
  };

  // Recover from legacy FogExp2 in gameplay
  scene.fog = new THREE.FogExp2(0x95e1ff, 0.00045);
  const gpRes = syncSceneHorizonFogAndFarClip({ scene, camera, mode: 'gameplay' });
  assert.ok(scene.fog instanceof THREE.Fog, 'scene.fog must be converted to Linear THREE.Fog');
  assert.equal(scene.fog.color.getHex(), HORIZON_CLEAR_FOG_COLOR_HEX);
  assert.equal(camera.far, gpRes.fogFar + gpRes.farClipBuffer);
  assert.equal(projUpdateCount, 1);

  // Steady second frame must NOT call updateProjectionMatrix()
  syncSceneHorizonFogAndFarClip({ scene, camera, mode: 'gameplay' });
  assert.equal(projUpdateCount, 1);

  // Entering park_view & city_view must NEVER leave scene.fog === null
  const pvRes = syncSceneHorizonFogAndFarClip({ scene, camera, mode: 'park_view' });
  assert.ok(scene.fog instanceof THREE.Fog);
  assert.equal(camera.far, pvRes.fogFar + pvRes.farClipBuffer);

  const cvRes = syncSceneHorizonFogAndFarClip({
    scene,
    camera,
    mode: 'city_overview',
    cameraDistanceM: 138,
    targetFovDeg: 42,
  });
  assert.ok(scene.fog instanceof THREE.Fog);
  assert.equal(camera.far, cvRes.fogFar + cvRes.farClipBuffer);

  // Exiting full_map_overview (which sets fog = null) restores THREE.Fog immediately
  syncSceneHorizonFogAndFarClip({ scene, camera, mode: 'full_map_overview' });
  assert.equal(scene.fog, null);
  assert.equal(camera.far, 800);
  syncSceneHorizonFogAndFarClip({ scene, camera, mode: 'gameplay' });
  assert.ok((scene.fog as THREE.Fog | THREE.FogExp2 | null) instanceof THREE.Fog);

  // Harmonize with @dynamiccuaca weatherEnvState during active fog/rain
  const stormColor = 0x5c6f8a;
  (scene.fog as THREE.Fog).color.setHex(stormColor);
  (scene.fog as THREE.Fog).near = 14;
  (scene.fog as THREE.Fog).far = 72;
  scene.userData.weatherEnvState = {
    fogFactor01: 0.8,
    rainFactor01: 1.0,
  };
  const stormSync = syncSceneHorizonFogAndFarClip({ scene, camera, mode: 'gameplay' });
  assert.equal((scene.fog as THREE.Fog).color.getHex(), stormColor, 'must preserve dynamic weather fog color');
  assert.equal((scene.fog as THREE.Fog).near, 14, 'must preserve dynamic weather fog near');
  assert.equal((scene.fog as THREE.Fog).far, 72, 'must preserve dynamic weather fog far');
  assert.equal(camera.far, 72 + stormSync.farClipBuffer, 'camera.far tracks compressed weather fog.far + buffer');
});

test('buildHorizonCliffBackdrop3D uses smooth high-segment bell hills, sakura billboard leaf canopies, <= 3 InstancedMeshes, and 60 FPS flags', () => {
  const scene = new THREE.Scene();
  const initialLeafTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  initialLeafTex.needsUpdate = true;

  const windUniforms = {
    uTime: { value: 0 },
    uWindPhase: { value: 0 },
    uWindDirection: { value: new THREE.Vector2(0.7071, 0.7071) },
    uWindStrength: { value: 0.32 },
    uWindGust: { value: 0.15 },
    uLightDirection: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() },
    uLightColor: { value: new THREE.Color('#fff4c8') },
    uShadowColor: { value: new THREE.Color('#3b6e52') },
  };

  const handle = buildHorizonCliffBackdrop3D(scene, {
    isSoftwareGl: false,
    leafMaskTexture: initialLeafTex,
    windUniforms,
  });

  assert.ok(
    handle.getDrawCallCount() <= HORIZON_BACKDROP_DRAW_CALL_LIMIT,
    `Expected <= ${HORIZON_BACKDROP_DRAW_CALL_LIMIT} draw calls, got ${handle.getDrawCallCount()}`,
  );
  assert.equal(handle.instancedMeshes.length, 3);

  // 1. Verify smooth high-segment rolling bell-dome hills (zero low-poly / MeshToonMaterial)
  const hillGeo = handle.hillMoundsMesh.geometry as THREE.SphereGeometry;
  assert.ok(hillGeo instanceof THREE.SphereGeometry, 'Hill geometry must be a SphereGeometry');
  assert.ok(
    hillGeo.parameters.widthSegments >= 32,
    `Hill radial segments (${hillGeo.parameters.widthSegments}) must be >= 32 for smooth silhouettes`,
  );
  assert.ok(
    hillGeo.parameters.heightSegments >= 16,
    `Hill height segments (${hillGeo.parameters.heightSegments}) must be >= 16`,
  );
  const hillNormals = hillGeo.getAttribute('normal');
  for (let i = 0; i < hillNormals.count; i++) {
    const len = Math.hypot(hillNormals.getX(i), hillNormals.getY(i), hillNormals.getZ(i));
    assert.ok(Math.abs(len - 1.0) < 1e-3, `Hill normal #${i} must be unit-length (got ${len})`);
  }

  // 2. Verify sakura-style camera-facing billboard leaf cluster canopy (non-icosahedron, uLeafTex + setLeafMaskTexture)
  const canopyGeo = handle.treeCanopiesMesh.geometry;
  assert.ok(!(canopyGeo instanceof THREE.IcosahedronGeometry), 'Canopy must not use IcosahedronGeometry');
  assert.ok(canopyGeo.getAttribute('aLeafCenter'), 'Canopy geometry must define aLeafCenter');
  assert.ok(canopyGeo.getAttribute('aLeafLocalPos'), 'Canopy geometry must define aLeafLocalPos');
  assert.ok(canopyGeo.getAttribute('aLeafPlaneSeed'), 'Canopy geometry must define aLeafPlaneSeed');
  assert.ok(canopyGeo.getAttribute('aLobeNormal'), 'Canopy geometry must define aLobeNormal');
  assert.ok(canopyGeo.getAttribute('uv'), 'Canopy geometry must define uv');

  const canopyMat = handle.treeCanopiesMesh.material as THREE.ShaderMaterial;
  assert.ok(canopyMat instanceof THREE.ShaderMaterial);
  assert.equal(canopyMat.uniforms.uLeafTex?.value, initialLeafTex);
  assert.ok(
    typeof canopyMat.uniforms.uAlphaThreshold?.value === 'number' &&
      canopyMat.uniforms.uAlphaThreshold.value >= 0.3,
    'Canopy shader must enforce alpha cutout threshold >= 0.3',
  );
  assert.ok(canopyMat.fragmentShader.includes('uLeafTex'));
  assert.ok(canopyMat.fragmentShader.includes('discard'));
  assert.ok(canopyMat.vertexShader.includes('uWindPhase'));
  assert.ok(canopyMat.vertexShader.includes('uWindStrength'));

  const upgradedLeafTex = new THREE.DataTexture(new Uint8Array([180, 180, 180, 255]), 1, 1);
  upgradedLeafTex.needsUpdate = true;
  handle.setLeafMaskTexture(upgradedLeafTex);
  assert.equal(
    canopyMat.uniforms.uLeafTex.value,
    upgradedLeafTex,
    'setLeafMaskTexture must swap canopy uLeafTex immediately',
  );

  // Verify mixed green + sakura pink/lilac tree instance colors
  assert.ok(handle.treeCanopiesMesh.instanceColor !== null, 'Canopies must provide instanceColor');
  const tmpColor = new THREE.Color();
  let hasGreenTree = false;
  let hasSakuraTree = false;
  for (let i = 0; i < handle.treeCanopiesMesh.count; i++) {
    handle.treeCanopiesMesh.getColorAt(i, tmpColor);
    if (tmpColor.g > tmpColor.r && tmpColor.g > tmpColor.b) hasGreenTree = true;
    if (tmpColor.r > tmpColor.g * 1.15 && tmpColor.b > tmpColor.g) hasSakuraTree = true;
  }
  assert.equal(hasGreenTree, true, 'Horizon treeline must include lush green canopies');
  assert.equal(hasSakuraTree, true, 'Horizon treeline must include sakura pink/lilac accents');

  // 3. Verify smooth tree trunks (CylinderGeometry >= 10 radial segments)
  const trunkGeo = handle.treeTrunksMesh.geometry as THREE.CylinderGeometry;
  assert.ok(trunkGeo instanceof THREE.CylinderGeometry);
  assert.ok(
    trunkGeo.parameters.radialSegments >= 10,
    `Trunk radialSegments (${trunkGeo.parameters.radialSegments}) must be >= 10`,
  );

  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();

  let coversTennisZ = false;
  let coversPlazaZ = false;
  let coversCasinoZ = false;

  for (const mesh of handle.instancedMeshes) {
    assert.ok(mesh instanceof THREE.InstancedMesh);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
    assert.equal(mesh.matrixAutoUpdate, false);
    assert.equal(mesh.frustumCulled, true);
    assert.ok(mesh.boundingSphere !== null && mesh.boundingSphere.radius > 10);
    assert.ok(mesh.boundingBox !== null && !mesh.boundingBox.isEmpty());
    assert.ok(mesh.count > 10);

    const mat = mesh.material as THREE.ShaderMaterial;
    assert.ok(
      !(mat instanceof THREE.MeshToonMaterial),
      `${mesh.name} must not use stepped MeshToonMaterial`,
    );
    assert.ok(mat instanceof THREE.ShaderMaterial, `${mesh.name} must use smooth ShaderMaterial`);
    assert.equal(mat.fog, true, `${mesh.name} material must have fog = true`);
    assert.ok('fogNear' in mat.uniforms && 'fogFar' in mat.uniforms && 'fogColor' in mat.uniforms);
    assert.ok(mat.vertexShader.includes('#include <fog_pars_vertex>'));
    assert.ok(mat.vertexShader.includes('#include <fog_vertex>'));
    assert.ok(mat.fragmentShader.includes('#include <fog_pars_fragment>'));
    assert.ok(mat.fragmentShader.includes('#include <fog_fragment>'));

    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, tmpMat);
      tmpMat.decompose(tmpPos, tmpQuat, tmpScale);
      // Must stay clear of West playable buildings (strictly west of x = -110 in main corridor |z| < 92)
      if (Math.abs(tmpPos.z) < 92) {
        assert.ok(tmpPos.x <= -110, `Instance at (${tmpPos.x}, ${tmpPos.z}) intrudes east of West cliff`);
      }
      const groundY = getBaseProceduralGroundElevation(tmpPos.x, tmpPos.z);
      assert.ok(
        tmpPos.y >= groundY - 2.0,
        `Instance at (${tmpPos.x}, ${tmpPos.y}, ${tmpPos.z}) sunk below ground ${groundY}`,
      );
      if (tmpPos.z >= 38 && tmpPos.z <= 95 && tmpPos.x <= -112) coversTennisZ = true;
      if (tmpPos.z >= -30 && tmpPos.z <= 30 && tmpPos.x <= -112) coversPlazaZ = true;
      if (tmpPos.z >= -112 && tmpPos.z <= -45 && tmpPos.x <= -112) coversCasinoZ = true;
    }
  }

  assert.equal(coversTennisZ, true, 'West backdrop must cover ridge behind Tennis');
  assert.equal(coversPlazaZ, true, 'West backdrop must cover ridge behind Central Plaza');
  assert.equal(coversCasinoZ, true, 'West backdrop must cover ridge behind Grand Casino');

  // Verify compact SoftwareGL mode also preserves smooth resolution & <= 3 draw calls
  const softScene = new THREE.Scene();
  const softHandle = buildHorizonCliffBackdrop3D(softScene, { isSoftwareGl: true });
  assert.ok(softHandle.getDrawCallCount() <= HORIZON_BACKDROP_DRAW_CALL_LIMIT);
  assert.ok((softHandle.hillMoundsMesh.geometry as THREE.SphereGeometry).parameters.widthSegments >= 32);
  softHandle.dispose();

  const horizonSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/game/buddiesHorizonOptimizer.ts'),
    'utf8',
  );
  assert.ok(!horizonSrc.includes('IcosahedronGeometry'), 'buddiesHorizonOptimizer must not use IcosahedronGeometry');
  assert.ok(!horizonSrc.includes('MeshToonMaterial'), 'buddiesHorizonOptimizer must not use stepped MeshToonMaterial');
  assert.ok(!horizonSrc.includes('NearestFilter'), 'buddiesHorizonOptimizer must not use NearestFilter toon ramp');

  handle.dispose();
  initialLeafTex.dispose();
  upgradedLeafTex.dispose();
  assert.equal(scene.getObjectByName('HorizonWestCliffBackdrop'), undefined);
});

test('enableSceneLinearFog sets fog=true on outdoor meshes/outlines while preserving sky dome and additive glows', () => {
  const scene = new THREE.Scene();

  const worldBox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshToonMaterial({ color: 0xffffff, fog: false }),
  );
  const strokeOutline = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x12121e, side: THREE.BackSide, fog: false }),
  );
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x7fd8ff, fog: false }),
  );
  skyDome.name = 'AnimeSkyDome';

  const cloudRing = new THREE.Group();
  cloudRing.name = 'AnimeHorizonCloudRingInstanced';
  const cloudPuff = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshToonMaterial({ color: 0xffffff, fog: false }),
  );
  cloudRing.add(cloudPuff);

  const additiveHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffe896,
      blending: THREE.AdditiveBlending,
      transparent: true,
      fog: false,
    }),
  );

  const foggedShader = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    fog: false,
  });
  const shaderMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), foggedShader);

  scene.add(worldBox, strokeOutline, skyDome, cloudRing, additiveHalo, shaderMesh);

  const report = enableSceneLinearFog(scene);
  assert.ok(report.updatedCount >= 3);
  assert.equal((worldBox.material as THREE.MeshToonMaterial).fog, true);
  assert.equal((strokeOutline.material as THREE.MeshBasicMaterial).fog, true);
  assert.equal(foggedShader.fog, true);
  assert.equal((skyDome.material as THREE.MeshBasicMaterial).fog, false, 'AnimeSkyDome must stay fog=false');
  assert.equal((cloudPuff.material as THREE.MeshToonMaterial).fog, false, 'Cloud ring must stay fog=false');
  assert.equal((additiveHalo.material as THREE.MeshBasicMaterial).fog, false, 'Additive glow must stay fog=false');
});

test('Shaders and Arena contain Linear THREE.Fog chunks and zero THREE.FogExp2', () => {
  const shadersSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/game/buddiesBlitzShadersAndAssets.ts'),
    'utf8',
  );
  const arenaSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/game/BuddiesBlitzArena.tsx'),
    'utf8',
  );

  assert.ok(shadersSrc.includes('THREE.UniformsLib.fog'));
  assert.ok(shadersSrc.includes('#include <fog_pars_vertex>'));
  assert.ok(shadersSrc.includes('#include <fog_vertex>'));
  assert.ok(shadersSrc.includes('#include <fog_pars_fragment>'));
  assert.ok(shadersSrc.includes('#include <fog_fragment>'));
  assert.ok(!arenaSrc.includes('new THREE.FogExp2('), 'BuddiesBlitzArena must not instantiate THREE.FogExp2');
});
