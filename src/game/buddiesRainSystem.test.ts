import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { createGpuRainSystem } from './buddiesRainSystem';
import { evaluateLinearFogParams, evaluateWeatherAndTimeState } from './buddiesWeatherSystem';

test('createGpuRainSystem initializes 1500-4000 static GPU particle attributes once with single THREE.Points draw call', () => {
  const swRain = createGpuRainSystem({ isSoftwareGl: true });
  const hwRain = createGpuRainSystem({ isSoftwareGl: false });

  try {
    for (const sys of [swRain, hwRain]) {
      assert.ok(sys.particleCount >= 1500 && sys.particleCount <= 4000);
      assert.ok(sys.points instanceof THREE.Points);
      assert.equal(sys.points.frustumCulled, false);
      assert.equal(sys.material.depthWrite, false);
      assert.equal(sys.material.transparent, true);

      for (const attrName of ['position', 'aOffset', 'aSpeed', 'aPhase', 'aRandom']) {
        const attr = sys.geometry.getAttribute(attrName) as THREE.BufferAttribute;
        assert.ok(attr, `Missing static attribute ${attrName}`);
        assert.equal(attr.count, sys.particleCount);
      }

      // Verify shader handles vertex wrapping, wind slant, intensity culling, and top-down angle adaptation
      const vs = sys.material.vertexShader;
      assert.ok(vs.includes('mod('));
      assert.ok(vs.includes('uCenter'));
      assert.ok(vs.includes('uWind'));
      assert.ok(vs.includes('aRandom > intensity'));
      assert.ok(vs.includes('vTopDownMix'));
      assert.ok(vs.includes('gl_PointSize'));
    }
  } finally {
    swRain.dispose();
    hwRain.dispose();
  }
});

test('DynamicRainController smoothly lerps intensity & wind around moving camera uCenter with zero buffer reallocation', () => {
  const rain = createGpuRainSystem({ isSoftwareGl: false, initialIntensity: 0 });
  try {
    const initialOffsetAttr = rain.geometry.getAttribute('aOffset');
    const initialRandomAttr = rain.geometry.getAttribute('aRandom');
    const initialSpeedAttr = rain.geometry.getAttribute('aSpeed');

    rain.setTarget({ intensity: 0.85, windX: 3.6, windZ: -2.4 });
    rain.update({
      dt: 0.05,
      timeSec: 1.0,
      centerX: 12,
      centerY: 14,
      centerZ: -8,
      spanXZ: 110,
      spanY: 42,
      viewportHeightPx: 900,
      pixelRatio: 2,
    });

    // Smooth lerp: starts transitioning rather than snapping immediately
    assert.ok(rain.state.intensity > 0 && rain.state.intensity < 0.85);
    assert.ok(rain.state.windX > 0 && rain.state.windX < 3.6);
    assert.ok(rain.state.windZ < 0 && rain.state.windZ > -2.4);

    // Step ~2 seconds toward target
    for (let i = 0; i < 40; i++) {
      rain.update({
        dt: 0.05,
        timeSec: 1.05 + i * 0.05,
        centerX: 25 + i * 0.5,
        centerY: 16,
        centerZ: -15 - i * 0.4,
      });
    }

    assert.ok(Math.abs(rain.state.intensity - 0.85) < 0.02);
    assert.ok(Math.abs(rain.state.windX - 3.6) < 0.05);
    assert.ok(Math.abs(rain.state.windZ - -2.4) < 0.05);
    assert.equal(rain.material.uniforms.uCenter.value.x, 25 + 39 * 0.5);
    assert.equal(rain.material.uniforms.uCenter.value.y, 16);

    // BufferGeometry attributes must remain the exact same object references (zero reallocations)
    assert.equal(rain.geometry.getAttribute('aOffset'), initialOffsetAttr);
    assert.equal(rain.geometry.getAttribute('aRandom'), initialRandomAttr);
    assert.equal(rain.geometry.getAttribute('aSpeed'), initialSpeedAttr);

    // Fade back to zero cleanly
    rain.setIntensity(0);
    for (let i = 0; i < 50; i++) {
      rain.update({ dt: 0.05, timeSec: 4.0 + i * 0.05, centerX: 0, centerY: 12, centerZ: 0 });
    }
    assert.ok(rain.state.intensity < 0.01);
  } finally {
    rain.dispose();
  }
});

test('Daytime rain fog uses cool slate overcast tone and keeps nearby grass crisp & unsaturated-wash-free', () => {
  const rainDay = evaluateWeatherAndTimeState({
    timeOfDayHours: 12.75,
    weatherCondition: 'hujan',
    rainIntensityTier: 'deras',
  });

  // Fog near stays >= 50m in gameplay rain so foreground character & grass remain sharp
  const fogParams = evaluateLinearFogParams({
    baseNear: 74,
    baseFar: 132,
    rainFactor01: 1.0,
    fogFactor01: rainDay.envState.fogFactor01,
    isCityView: false,
  });
  assert.ok(fogParams.near >= 50, `Expected rain fog near >= 50m to keep grass sharp, got ${fogParams.near}`);
  assert.ok(fogParams.far > fogParams.near + 40);

  // Overcast daytime fog color is cool slate-blue (blue channel > red channel, not bright washed-out white)
  assert.ok(rainDay.fog.color.b > rainDay.fog.color.r);
  assert.ok(rainDay.fog.color.r < 0.55, `Fog red channel (${rainDay.fog.color.r}) should not be washed-out pale white`);
  assert.ok(rainDay.terrain.fogDesat <= 0.08);

  // Verify grass & ground shaders attenuate fog wash-out while preserving Linear fog & water ripples
  const shadersSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/game/buddiesBlitzShadersAndAssets.ts'),
    'utf8',
  );
  assert.ok(shadersSrc.includes('grassFogWeight'));
  assert.ok(shadersSrc.includes('grassFogScale'));
  assert.ok(shadersSrc.includes('evalWaterRainRipples'));
});
