import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_GRAPHICS_QUALITY,
  GRAPHICS_QUALITY_OPTIONS,
  GRAPHICS_QUALITY_STORAGE_KEY,
  readStoredGraphicsQuality,
  resolveGraphicsQualityProfile,
  sanitizeGraphicsQualityPreset,
  shouldRunAdaptiveQualityControls,
  writeStoredGraphicsQuality,
} from './buddiesGraphicsSettings';

describe('buddiesGraphicsSettings', () => {
  it('exposes exactly the four required options: Low, Balanced, High, Adaptive', () => {
    assert.deepEqual(
      GRAPHICS_QUALITY_OPTIONS.map((o) => o.id),
      ['low', 'balanced', 'high', 'adaptive'],
    );
    assert.deepEqual(
      GRAPHICS_QUALITY_OPTIONS.map((o) => o.label),
      ['Low', 'Balanced', 'High', 'Adaptive'],
    );
  });

  it('never enables adaptive auto-scaling for manual presets (low, balanced, high)', () => {
    for (const preset of ['low', 'balanced', 'high'] as const) {
      assert.equal(shouldRunAdaptiveQualityControls(preset), false);
      const profile = resolveGraphicsQualityProfile(preset, 2, false);
      assert.equal(profile.isAdaptive, false);
      assert.notEqual(profile.fixedDpr, null);
    }
    assert.equal(shouldRunAdaptiveQualityControls('adaptive'), true);
    const adaptiveProfile = resolveGraphicsQualityProfile('adaptive', 2, false);
    assert.equal(adaptiveProfile.isAdaptive, true);
    assert.equal(adaptiveProfile.fixedDpr, null);
  });

  it('maps Low, Balanced, High, and Adaptive to distinct pixel ratio caps and shadow settings', () => {
    const low = resolveGraphicsQualityProfile('low', 2, false);
    assert.equal(low.fixedDpr, 0.85);
    assert.equal(low.shadowsEnabled, false);
    assert.equal(low.foliageShadowsEnabled, false);

    const balanced = resolveGraphicsQualityProfile('balanced', 2, false);
    assert.equal(balanced.fixedDpr, 1.0);
    assert.equal(balanced.shadowsEnabled, true);
    assert.equal(balanced.shadowMapRes, 1536);
    assert.equal(balanced.foliageShadowsEnabled, false);

    const high = resolveGraphicsQualityProfile('high', 2, false);
    assert.equal(high.fixedDpr, 1.5);
    assert.equal(high.shadowsEnabled, true);
    assert.equal(high.shadowMapRes, 2048);
    assert.equal(high.foliageShadowsEnabled, true);

    const adaptive = resolveGraphicsQualityProfile('adaptive', 2, false);
    assert.equal(adaptive.dprCap, 1.25);
    assert.equal(adaptive.shadowsEnabled, true);
    assert.equal(adaptive.shadowMapRes, 2048);
  });

  it('persists and restores graphics quality from local device storage', () => {
    const store = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    assert.equal(readStoredGraphicsQuality(fakeStorage), DEFAULT_GRAPHICS_QUALITY);
    writeStoredGraphicsQuality('high', fakeStorage);
    assert.equal(store.get(GRAPHICS_QUALITY_STORAGE_KEY), 'high');
    assert.equal(readStoredGraphicsQuality(fakeStorage), 'high');

    store.set(GRAPHICS_QUALITY_STORAGE_KEY, 'ultra_invalid');
    assert.equal(readStoredGraphicsQuality(fakeStorage), DEFAULT_GRAPHICS_QUALITY);
    assert.equal(sanitizeGraphicsQualityPreset(null), DEFAULT_GRAPHICS_QUALITY);
  });
});
