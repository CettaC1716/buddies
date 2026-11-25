import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  CITY_LIGHTS_SCALE_BOUNDS,
  TIME_PHASE_DEFAULT_HOURS,
} from './buddiesBlitzRules';
import type { BlitzWindUniforms } from './buddiesBlitzShadersAndAssets';
import {
  AUTO_CYCLE_HOURS_PER_SEC,
  buildDynamicWeatherSystem3D,
  evaluateLinearFogParams,
  evaluateSolarClockFactors,
  evaluateWeatherAndTimeState,
  formatClock24h,
  normalizeHours24,
  resolvePhaseFromHours,
  setWeatherControlConfig,
  shortestHoursDelta24,
  stepWeatherRuntimeState,
  type AnimeSkyUniformsLike,
  type WeatherControlConfig,
  type WeatherRuntimeState,
} from './buddiesWeatherSystem';

function makeMockSkyAndLighting() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#bae2ff', 105, 215);
  const hemiLight = new THREE.HemisphereLight('#fffdf0', '#3d7068', 1.2);
  const dirLight = new THREE.DirectionalLight('#ffe6b1', 2.05);
  const animeSkyUniforms: AnimeSkyUniformsLike = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uZenithColor: { value: new THREE.Color('#1b5eb8') },
    uMidSkyColor: { value: new THREE.Color('#3b99f0') },
    uHorizonSkyColor: { value: new THREE.Color('#8be0ff') },
    uHorizonGlowColor: { value: new THREE.Color('#fff1cf') },
    uGroundBounceColor: { value: new THREE.Color('#8ec8e8') },
    uSunColor: { value: new THREE.Color('#fff9e6') },
    uCloudLitColor: { value: new THREE.Color('#fffdf9') },
    uCloudMidColor: { value: new THREE.Color('#d7e8ff') },
    uCloudShadowColor: { value: new THREE.Color('#a6c2e8') },
  };
  const cloudPuffToonMat = new THREE.MeshToonMaterial({ color: '#ffffff' });
  const animeSparkleMat = new THREE.PointsMaterial({ color: '#ffffff', opacity: 0.82 });
  const windUniforms: BlitzWindUniforms = {
    uTime: { value: 0 },
    uWindPhase: { value: 0 },
    uWindDirection: { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) },
    uWindStrength: { value: 0.32 },
    uWindGust: { value: 0.25 },
    uLightDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uLightColor: { value: new THREE.Color('#fff4c8') },
    uShadowColor: { value: new THREE.Color('#3b6e52') },
  };
  return {
    scene,
    hemiLight,
    dirLight,
    animeSkyUniforms,
    cloudPuffToonMat,
    animeSparkleMat,
    windUniforms,
  };
}

function resetGlobalWeatherConfig(): void {
  setWeatherControlConfig({
    phase: 'day',
    timeOfDayHours: TIME_PHASE_DEFAULT_HOURS.day,
    weatherCondition: 'cerah',
    rainIntensityTier: 'deras',
    autoCycleEnabled: false,
    cityLightsScale: CITY_LIGHTS_SCALE_BOUNDS.default,
  });
}

test('24-hour clock wraparound, formatting, and shortest circular delta stay continuous', () => {
  assert.equal(normalizeHours24(24), 0);
  assert.equal(normalizeHours24(-1.5), 22.5);
  assert.equal(normalizeHours24(27.25), 3.25);

  assert.equal(formatClock24h(12.75), '12:45');
  assert.equal(formatClock24h(5.75), '05:45');
  assert.equal(formatClock24h(24), '00:00');

  assert.ok(Math.abs(shortestHoursDelta24(23.5, 0.5) - 1.0) < 1e-6);
  assert.ok(Math.abs(shortestHoursDelta24(0.5, 23.5) - -1.0) < 1e-6);

  assert.equal(resolvePhaseFromHours(5.75), 'dawn');
  assert.equal(resolvePhaseFromHours(12.75), 'day');
  assert.equal(resolvePhaseFromHours(18.0), 'dusk');
  assert.equal(resolvePhaseFromHours(23.0), 'night');
  assert.equal(resolvePhaseFromHours(2.0), 'night');
});

test('continuous 24h Dawn/Day/Dusk/Night interpolation is smooth across midnight seam with zero NaNs', () => {
  let prevState = evaluateWeatherAndTimeState({
    timeOfDayHours: 0,
    weatherCondition: 'cerah',
  });

  // Sample every 15 minutes around the full 24h cycle
  for (let q = 1; q <= 96; q++) {
    const h = q * 0.25;
    const cur = evaluateWeatherAndTimeState({
      timeOfDayHours: h,
      weatherCondition: 'cerah',
      timeSec: q * 0.5,
    });
    assert.ok(Number.isFinite(cur.lighting.dirIntensity));
    assert.ok(Number.isFinite(cur.lighting.hemiIntensity));
    assert.ok(Number.isFinite(cur.fog.near));
    assert.ok(Number.isFinite(cur.fog.far));
    assert.ok(cur.fog.far > cur.fog.near);
    assert.ok(Number.isFinite(cur.envState.nightFactor01));
    assert.ok(Number.isFinite(cur.envState.sunElevation01));
    assert.ok(Math.abs(cur.sky.sunDir.length() - 1) < 1e-4);

    // Consecutive 15-minute steps should transition smoothly without sudden jumps
    const maxNightDelta = Math.abs(cur.envState.nightFactor01 - prevState.envState.nightFactor01);
    const maxDirDelta = Math.abs(cur.lighting.dirIntensity - prevState.lighting.dirIntensity);
    assert.ok(maxNightDelta <= 0.3, `hour ${h} nightFactor jump ${maxNightDelta}`);
    assert.ok(maxDirDelta <= 0.4, `hour ${h} dirIntensity jump ${maxDirDelta}`);
    prevState = cur;
  }

  // Midnight continuity: 23.95 vs 0.05 should be almost identical
  const preMidnight = evaluateWeatherAndTimeState({ timeOfDayHours: 23.95, weatherCondition: 'cerah' });
  const postMidnight = evaluateWeatherAndTimeState({ timeOfDayHours: 0.05, weatherCondition: 'cerah' });
  assert.ok(Math.abs(preMidnight.envState.nightFactor01 - postMidnight.envState.nightFactor01) < 0.01);
  assert.ok(
    preMidnight.sky.zenithColor.getHexString() === postMidnight.sky.zenithColor.getHexString() ||
      Math.abs(preMidnight.sky.zenithColor.b - postMidnight.sky.zenithColor.b) < 0.02,
  );
});

test('nightFactor01 curve hits dusk/night/dawn targets and boosts during heavy rain & thick fog', () => {
  const clearDay = evaluateWeatherAndTimeState({
    timeOfDayHours: TIME_PHASE_DEFAULT_HOURS.day,
    weatherCondition: 'cerah',
  });
  assert.equal(clearDay.envState.phase, 'day');
  assert.equal(clearDay.envState.nightFactor01, 0);
  assert.ok(clearDay.envState.sunElevation01 > 0.9);
  assert.equal(clearDay.fog.color.getHexString(), 'bae2ff');

  const windyDay = evaluateWeatherAndTimeState({
    timeOfDayHours: TIME_PHASE_DEFAULT_HOURS.day,
    weatherCondition: 'berangin',
  });
  assert.equal(windyDay.envState.nightFactor01, 0);
  assert.ok(windyDay.envState.windStrength > 1.2);
  assert.equal(windyDay.particles.leafIntensity01, 1.0);

  const clearDusk = evaluateWeatherAndTimeState({
    timeOfDayHours: TIME_PHASE_DEFAULT_HOURS.dusk,
    weatherCondition: 'cerah',
  });
  assert.equal(clearDusk.envState.phase, 'dusk');
  assert.ok(clearDusk.envState.nightFactor01 >= 0.4 && clearDusk.envState.nightFactor01 <= 0.9);
  assert.ok(clearDusk.envState.duskDawnFactor01 >= 0.85);

  const clearNight = evaluateWeatherAndTimeState({
    timeOfDayHours: TIME_PHASE_DEFAULT_HOURS.night,
    weatherCondition: 'cerah',
  });
  assert.equal(clearNight.envState.phase, 'night');
  assert.equal(clearNight.envState.nightFactor01, 1.0);
  assert.ok(clearNight.sky.starOpacity > 0.7);

  const clearDawn = evaluateWeatherAndTimeState({
    timeOfDayHours: TIME_PHASE_DEFAULT_HOURS.dawn,
    weatherCondition: 'cerah',
  });
  assert.equal(clearDawn.envState.phase, 'dawn');
  assert.ok(clearDawn.envState.nightFactor01 >= 0.45 && clearDawn.envState.nightFactor01 <= 0.75);
  assert.ok(clearDawn.envState.duskDawnFactor01 >= 0.85);

  // Dawn fades gently after sunrise
  const lateDawn = evaluateSolarClockFactors(6.75);
  assert.ok(lateDawn.nightByClock01 < 0.25 && lateDawn.nightByClock01 > 0.05);

  // Heavy rain & thick fog boost daytime nightFactor01 so city lamps & vehicle headlights engage
  const stormDay = evaluateWeatherAndTimeState({
    timeOfDayHours: 12.75,
    weatherCondition: 'hujan',
    rainIntensityTier: 'deras',
  });
  assert.ok(stormDay.envState.nightFactor01 >= 0.65);
  assert.ok(stormDay.lighting.dirIntensity < clearDay.lighting.dirIntensity * 0.6);
  assert.ok(stormDay.fog.far < clearDay.fog.far * 0.6);

  const fogDay = evaluateWeatherAndTimeState({
    timeOfDayHours: 12.75,
    weatherCondition: 'kabut',
  });
  assert.ok(fogDay.envState.nightFactor01 >= 0.4);
  assert.ok(fogDay.fog.far <= 75);
  assert.ok(fogDay.fog.near <= 15);
  assert.ok(fogDay.sky.starOpacity < 0.15);

  // Linear fog helper preserves horizon-optimizer baseline in clear weather and compresses in City View mist
  const clearCityViewFog = evaluateLinearFogParams({
    baseNear: 215,
    baseFar: 365,
    rainFactor01: 0,
    fogFactor01: 0,
    isCityView: true,
  });
  assert.equal(clearCityViewFog.near, 215);
  assert.equal(clearCityViewFog.far, 365);

  const foggyCityViewFog = evaluateLinearFogParams({
    baseNear: 215,
    baseFar: 365,
    rainFactor01: 0,
    fogFactor01: 1,
    isCityView: true,
  });
  assert.ok(foggyCityViewFog.near < 60 && foggyCityViewFog.far < 210);

  // City lights scale clamping [0.5, 2.5]
  const lowScale = evaluateWeatherAndTimeState({
    timeOfDayHours: 23,
    weatherCondition: 'cerah',
    cityLightsScale: 0.1,
  });
  const highScale = evaluateWeatherAndTimeState({
    timeOfDayHours: 23,
    weatherCondition: 'cerah',
    cityLightsScale: 4.0,
  });
  assert.equal(lowScale.envState.cityLightsScale, CITY_LIGHTS_SCALE_BOUNDS.min);
  assert.equal(highScale.envState.cityLightsScale, CITY_LIGHTS_SCALE_BOUNDS.max);
});

test('weather runtime smoothly ramps rain/fog/wind transitions and dries wetness gradually after rain', () => {
  const runtime: WeatherRuntimeState = {
    currentHours: 12.75,
    targetHours: 12.75,
    rainFactor01: 0,
    fogFactor01: 0,
    windStrength: 0.32,
    overcast01: 0,
    wetness01: 0,
    petalDrift01: 0,
    windAngleRad: Math.PI * 0.25,
    lastAppliedRevision: 1,
  };
  const cfg: WeatherControlConfig = {
    timeOfDayHours: 12.75,
    phase: 'day',
    weatherCondition: 'hujan',
    rainIntensityTier: 'deras',
    autoCycleEnabled: false,
    cityLightsScale: 1.0,
    configRevision: 2,
  };

  // Ramp into heavy rain over 2.5s
  for (let i = 0; i < 50; i++) {
    stepWeatherRuntimeState(runtime, cfg, 0.05, i * 0.05);
  }
  assert.ok(runtime.rainFactor01 > 0.95);
  assert.ok(runtime.wetness01 > 0.9);
  assert.ok(runtime.windStrength > 1.0);

  // Switch back to clear — rain drops faster than lingering wet road sheen
  cfg.weatherCondition = 'cerah';
  cfg.configRevision = 3;
  for (let i = 0; i < 20; i++) {
    stepWeatherRuntimeState(runtime, cfg, 0.05, 2.5 + i * 0.05);
  }
  assert.ok(runtime.rainFactor01 < 0.05);
  assert.ok(runtime.wetness01 > 0.7, `wetness should dry gradually, got ${runtime.wetness01}`);
});

test('buildDynamicWeatherSystem3D maintains <= 3 GPU weather draw calls (Points rain + 2 InstancedMeshes), 0 PointLights, indoor suppression, and auto-cycle sync', () => {
  resetGlobalWeatherConfig();
  const rig = makeMockSkyAndLighting();
  const weather = buildDynamicWeatherSystem3D({
    ...rig,
    isSoftwareGl: false,
    initialPreset: 'day',
  });

  try {
    // 1. Verify exact GPU-driven draw-call & PointLight hygiene (1 THREE.Points rain + 2 InstancedMeshes)
    let instancedMeshCount = 0;
    let pointsCount = 0;
    let pointLightCount = 0;
    weather.rootGroup.traverse((node) => {
      if ((node as THREE.InstancedMesh).isInstancedMesh) {
        instancedMeshCount++;
      }
      if ((node as THREE.Points).isPoints) {
        pointsCount++;
      }
      if ((node as THREE.PointLight).isPointLight) {
        pointLightCount++;
      }
    });
    assert.equal(pointsCount, 1);
    assert.equal(instancedMeshCount, 2);
    assert.equal(pointsCount + instancedMeshCount, 3);
    assert.ok(weather.rainMesh instanceof THREE.Points);
    assert.equal(weather.rainMesh.frustumCulled, false);
    assert.equal((weather.rainMesh.material as THREE.ShaderMaterial).depthWrite, false);
    assert.equal(pointLightCount, 0);

    // Clear daytime preserves Linear THREE.Fog baseline -> 0 active weather draw calls
    weather.update({
      dt: 0.016,
      timeSec: 1.0,
      pivotX: 0,
      pivotZ: 12.5,
      windUniforms: rig.windUniforms,
      isFlatIndoorRoomMode: false,
      isShowcaseMode: false,
      isFullMapOverview: false,
      isCityView: false,
    });
    assert.ok(rig.scene.fog instanceof THREE.Fog);
    assert.equal((rig.scene.fog as THREE.Fog).color.getHexString(), 'bae2ff');
    assert.equal(weather.getDrawCallCounts().activeDrawCalls, 0);
    assert.equal(weather.getDrawCallCounts().pointLights, 0);

    // City View calibrated baseline from @env-horizon-optimizer is respected when clear
    (rig.scene.fog as THREE.Fog).near = 215;
    (rig.scene.fog as THREE.Fog).far = 365;
    weather.update({
      dt: 0.016,
      timeSec: 1.02,
      pivotX: 0,
      pivotZ: 0,
      windUniforms: rig.windUniforms,
      isFlatIndoorRoomMode: false,
      isShowcaseMode: false,
      isFullMapOverview: false,
      isCityView: true,
    });
    assert.equal((rig.scene.fog as THREE.Fog).near, 215);
    assert.equal((rig.scene.fog as THREE.Fog).far, 365);

    // Windy -> only 1 instanced petal/leaf draw call active
    setWeatherControlConfig({ weatherCondition: 'berangin' });
    for (let i = 0; i < 25; i++) {
      weather.update({
        dt: 0.05,
        timeSec: 1.0 + i * 0.05,
        pivotX: 10,
        pivotZ: 20,
        windUniforms: rig.windUniforms,
        isFlatIndoorRoomMode: false,
        isShowcaseMode: false,
        isFullMapOverview: false,
      });
    }
    assert.equal(weather.getDrawCallCounts().activeDrawCalls, 1);
    assert.equal(weather.leafMesh.visible, true);
    assert.equal(weather.rainMesh.visible, false);
    assert.ok(rig.windUniforms.uWindStrength.value > 1.1);

    // Heavy Rain -> rain + splashes + leaves <= 3 draw calls and scene.userData.weatherEnvState updated
    setWeatherControlConfig({ weatherCondition: 'hujan', rainIntensityTier: 'deras' });
    for (let i = 0; i < 30; i++) {
      weather.update({
        dt: 0.05,
        timeSec: 2.5 + i * 0.05,
        pivotX: 10,
        pivotZ: 20,
        windUniforms: rig.windUniforms,
        isFlatIndoorRoomMode: false,
        isShowcaseMode: false,
        isFullMapOverview: false,
      });
    }
    assert.ok(weather.getDrawCallCounts().activeDrawCalls <= 3);
    assert.equal(weather.rainMesh.visible, true);
    assert.equal(weather.splashMesh.visible, true);

    const env = rig.scene.userData.weatherEnvState as ReturnType<typeof weather.getWeatherEnvState>;
    assert.ok(env !== undefined);
    assert.equal(env.weatherCondition, 'hujan');
    assert.ok(env.rainFactor01 > 0.85);
    assert.ok(env.nightFactor01 >= 0.6);

    // Indoor mode hides all outdoor rain/splashes/petals and pushes Linear fog safely past indoor bounds
    weather.update({
      dt: 0.016,
      timeSec: 4.1,
      pivotX: 0,
      pivotZ: 0,
      windUniforms: rig.windUniforms,
      isFlatIndoorRoomMode: true,
      isShowcaseMode: false,
      isFullMapOverview: false,
      isCityView: false,
    });
    assert.equal(weather.rootGroup.visible, false);
    assert.equal(weather.getDrawCallCounts().activeDrawCalls, 0);
    assert.ok(rig.scene.fog instanceof THREE.Fog);
    assert.ok((rig.scene.fog as THREE.Fog).near >= 5000);

    // Exiting indoors restores outdoor Linear fog baseline cleanly
    weather.update({
      dt: 0.016,
      timeSec: 4.2,
      pivotX: 0,
      pivotZ: 0,
      windUniforms: rig.windUniforms,
      isFlatIndoorRoomMode: false,
      isShowcaseMode: false,
      isFullMapOverview: false,
      isCityView: false,
    });
    assert.ok((rig.scene.fog as THREE.Fog).far < 300);

    // Auto-cycle advances clock smoothly across 24h
    setWeatherControlConfig({
      weatherCondition: 'cerah',
      autoCycleEnabled: true,
      timeOfDayHours: 17.0,
    });
    const startHours = weather.getWeatherEnvState().timeOfDayHours;
    for (let i = 0; i < 40; i++) {
      weather.update({
        dt: 0.1,
        timeSec: 5.0 + i * 0.1,
        pivotX: 0,
        pivotZ: 0,
        windUniforms: rig.windUniforms,
        isFlatIndoorRoomMode: false,
        isShowcaseMode: false,
        isFullMapOverview: false,
      });
    }
    const afterHours = weather.getWeatherEnvState().timeOfDayHours;
    assert.ok(
      Math.abs(shortestHoursDelta24(startHours, afterHours) - 4.0 * AUTO_CYCLE_HOURS_PER_SEC) < 0.05,
    );

    // Wide rain & ground-splash coverage dynamically scales for zoomed-out / City View and handles elevated West Plaza/Boardwalks
    setWeatherControlConfig({ weatherCondition: 'hujan', rainIntensityTier: 'deras' });
    weather.update({
      dt: 0.016,
      timeSec: 10.0,
      pivotX: -92.75,
      pivotZ: 0.0,
      windUniforms: rig.windUniforms,
      isFlatIndoorRoomMode: false,
      isShowcaseMode: false,
      isFullMapOverview: false,
      isCityView: false,
      spanScale: 1.0,
    });
    const rainMat = weather.rainMesh.material as THREE.ShaderMaterial;
    const splashMat = weather.splashMesh.material as THREE.ShaderMaterial;
    const baseRainSpan = Number(rainMat.uniforms.uSpanXZ.value);
    const baseSplashSpan = Number(splashMat.uniforms.uSpanXZ.value);
    assert.ok(baseRainSpan >= 80, `Expected uniform gameplay rain span >= 80m (got ${baseRainSpan})`);
    assert.ok(baseSplashSpan >= 62, `Expected uniform gameplay splash span >= 62m (got ${baseSplashSpan})`);
    assert.ok(splashMat.vertexShader.includes('2.545'), 'West Plaza splashes must lift to +2.545m');
    assert.ok(splashMat.vertexShader.includes('0.855'), 'Boardwalk splashes must lift to +0.855m');
    assert.ok(
      splashMat.vertexShader.includes('8.545') &&
        splashMat.vertexShader.includes('evalCoastalHillRoad'),
      'Hilltop Villa Plateau & Coastal Switchback splashes must lift cleanly up to +8.545m',
    );

    weather.update({
      dt: 0.016,
      timeSec: 10.1,
      pivotX: 29.5,
      pivotZ: 0.0,
      windUniforms: rig.windUniforms,
      isFlatIndoorRoomMode: false,
      isShowcaseMode: false,
      isFullMapOverview: false,
      isCityView: true,
    });
    assert.ok(
      Number(rainMat.uniforms.uSpanXZ.value) > baseRainSpan * 1.4,
      'City View must expand rain coverage span across the viewport',
    );
    assert.ok(
      Number(splashMat.uniforms.uSpanXZ.value) > baseSplashSpan * 1.4,
      'City View must expand splash coverage span across the viewport',
    );
  } finally {
    weather.dispose();
    assert.equal(rig.scene.getObjectByName('DynamicWeatherSystem3D'), undefined);
    assert.equal(rig.scene.userData.weatherEnvState, undefined);
    resetGlobalWeatherConfig();
  }
});
