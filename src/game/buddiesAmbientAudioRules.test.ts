import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyFootstepSurface,
  computeAmbientNightFactor,
  computeAmbientSoundscapeMix,
  computeAmbientWaveCycleEnvelope,
  computeFootstepSynthSpec,
  resolveFootstepHalfCycleIndex,
} from './buddiesAmbientAudioRules';

test('classifyFootstepSurface resolves distinct surfaces cleanly across map habitats', () => {
  // Golden sandy East Beach (Kai South Beachfront + widened sand East of Beach Club)
  assert.equal(classifyFootstepSurface(99.5, 62.0), 'sand');
  assert.equal(classifyFootstepSurface(126.0, -78.0), 'sand');
  assert.equal(classifyFootstepSurface(112.0, -78.0), 'stone_road');

  // SE Beachfront Boardwalk (+0.82m), Stilt Cabin deck (+0.96m), and indoor wooden home
  assert.equal(classifyFootstepSurface(85.0, 72.0), 'wood');
  assert.equal(classifyFootstepSurface(131.6, 95.2), 'wood');
  assert.equal(classifyFootstepSurface(0.0, 0.0, 'house_interior'), 'wood');

  // Central Park Terrazzo vs Manicured Oasis Meadow & Fountain water
  assert.equal(classifyFootstepSurface(-48.0, 4.0), 'grass');
  assert.equal(classifyFootstepSurface(29.5, 8.2), 'stone_road');
  assert.equal(classifyFootstepSurface(22.0, 0.0), 'stone_road');
  assert.equal(classifyFootstepSurface(29.5, 0.0), 'water');

  // Asphalt Highway, Coastal Switchbacks & Indoor Marble/Terrazzo Cafe & Salon
  assert.equal(classifyFootstepSurface(-62.2, 0.0), 'stone_road');
  assert.equal(classifyFootstepSurface(96.0, 108.0), 'stone_road');
  assert.equal(classifyFootstepSurface(0.0, 0.0, 'cafe_interior'), 'stone_road');

  // NW Oasis Lake & Open East Ocean (beyond widened 134.0m shoreline)
  assert.equal(classifyFootstepSurface(-31.0, 0.0), 'water');
  assert.equal(classifyFootstepSurface(142.0, 70.0), 'water');

  // Hilltop Villa Plateau Meadow (+8.50m)
  assert.equal(classifyFootstepSurface(-10.0, -130.0), 'grass');
});

test('computeAmbientSoundscapeMix balances coastal surf, lake stillness, birdsong, and UI ducking', () => {
  // Sunny afternoon on widened East Beach near surf: strong ocean surf, seagulls active, zero lake ripple
  const beachDay = computeAmbientSoundscapeMix({
    listenerX: 124.0,
    listenerZ: 68.0,
    timeOfDayHours: 14.0,
    rainIntensity01: 0.0,
    environmentMode: 'outdoor',
  });
  assert.ok(beachDay.oceanSurfGain >= 0.75, `Expected strong beach surf (got ${beachDay.oceanSurfGain})`);
  assert.equal(beachDay.lakeWaterGain, 0);
  assert.ok(beachDay.seagullRatePerMin > 1.5, 'Expected coastal gulls active near beach');
  assert.equal(beachDay.oceanFoamCutoffHz, 2350);

  // Sunny morning at NW Oasis Lake: calm trickle, high forest songbirds, zero surf
  const lakeDay = computeAmbientSoundscapeMix({
    listenerX: -31.0,
    listenerZ: -12.0,
    timeOfDayHours: 9.0,
    rainIntensity01: 0.0,
    environmentMode: 'outdoor',
  });
  assert.ok(lakeDay.lakeWaterGain >= 0.65, `Expected calm lake ambient near (-31,-12) (got ${lakeDay.lakeWaterGain})`);
  assert.equal(lakeDay.oceanSurfGain, 0);
  assert.ok(lakeDay.songbirdRatePerMin >= 5.0, 'Expected melodic birdsong near oasis lake');
  assert.equal(lakeDay.seagullRatePerMin, 0);

  // Night & Heavy Rain suppress daytime birds and engage rain bed
  assert.equal(computeAmbientNightFactor(23.0), 1);
  assert.equal(computeAmbientNightFactor(12.0), 0);
  const beachStormNight = computeAmbientSoundscapeMix({
    listenerX: 124.0,
    listenerZ: 68.0,
    timeOfDayHours: 23.0,
    rainIntensity01: 1.0,
    environmentMode: 'outdoor',
  });
  assert.equal(beachStormNight.songbirdRatePerMin, 0);
  assert.equal(beachStormNight.seagullRatePerMin, 0);
  assert.ok(beachStormNight.rainBedGain >= 0.65);

  // UI Modal / City View gently ducks master ambient & rolls off bright foam
  const modalBeach = computeAmbientSoundscapeMix({
    listenerX: 124.0,
    listenerZ: 68.0,
    timeOfDayHours: 14.0,
    rainIntensity01: 0.0,
    environmentMode: 'outdoor',
    isUiModalOpen: true,
  });
  assert.ok(modalBeach.uiDuckMultiplier < 0.7);
  assert.ok(modalBeach.oceanFoamCutoffHz < 1100);
});

test('wave LFO breathing, step phase cadence, and footstep synth presets remain smooth and bounded', () => {
  // Twin-cycle ocean swell oscillates smoothly without negative or NaN values
  const vals = [0, 1.5, 3.1, 4.8, 7.4].map((t) => computeAmbientWaveCycleEnvelope(t));
  for (const s of vals) {
    assert.ok(s.swellGain01 >= 0.3 && s.swellGain01 <= 1.0);
    assert.ok(s.foamGain01 >= 0.1 && s.foamGain01 <= 1.0);
    assert.ok(s.swellCutoffHz >= 180 && s.swellCutoffHz <= 500);
  }

  // Deterministic alternating step detection across PI boundaries
  assert.equal(resolveFootstepHalfCycleIndex(0.2), 0);
  assert.equal(resolveFootstepHalfCycleIndex(3.15), 1);
  assert.equal(resolveFootstepHalfCycleIndex(6.3), 2);
  assert.equal(resolveFootstepHalfCycleIndex(-1), -1);

  // Grass steps have brighter crisp centroid than soft sand steps; wood steps carry warm body
  const sandL = computeFootstepSynthSpec('sand', 0.7, 0);
  const sandR = computeFootstepSynthSpec('sand', 0.7, 1);
  const grass = computeFootstepSynthSpec('grass', 0.7, 0);
  const wood = computeFootstepSynthSpec('wood', 0.7, 0);
  assert.ok(grass.noiseFreqHz > sandL.noiseFreqHz);
  assert.ok(wood.bodyGain > sandL.bodyGain);
  assert.equal(sandL.panOffset, -sandR.panOffset);
});
