import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COASTAL_HILL_CUT_INNER_M,
  COASTAL_HILL_CUT_OUTER_M,
  COASTAL_HILL_EVAL_SEGMENTS,
  COASTAL_HILL_FULL_LOOP_SPLINE_POINTS,
  COASTAL_HILL_HALF_CONTROL_POINTS,
  COASTAL_HILL_RIDGE_ELEV_Y,
  COASTAL_HILL_ROAD_HALF_WIDTH,
  COASTAL_HILL_WALKABLE_HALF_WIDTH,
  HILL_VILLA_PLATEAUS,
  buildCoastalHillGlslSnippet,
  evaluateCoastalHillRoadSample,
  evaluateHillVillaDrivewayApronSdf,
  evaluateHillVillaPlateauSdf,
  isPointInCoastalHillDrivewayGap,
} from './buddiesCoastalHillsRules';

test('Coastal switchbacks maintain gentle <= 9.8% grades, N/S mirror symmetry, and seawall clearance', () => {
  const half = COASTAL_HILL_HALF_CONTROL_POINTS;
  assert.equal(half[0].x, 96.0);
  assert.equal(half[0].az, 108.0);
  assert.equal(half[0].y, 0.0);
  assert.equal(half[half.length - 1].x, -126.5);
  assert.equal(half[half.length - 1].az, 0.0);
  assert.equal(half[half.length - 1].y, COASTAL_HILL_RIDGE_ELEV_Y);

  const spline = COASTAL_HILL_FULL_LOOP_SPLINE_POINTS;
  assert.ok(spline.length > 80);

  // Check every high-res spline segment has gentle <= 9.8% grade (well below 10.6%) and stays inside seawall (x < 101.5)
  let maxGradePct = 0;
  let maxRoadOuterX = -Infinity;
  for (let i = 0; i < spline.length - 1; i++) {
    const a = spline[i];
    const b = spline[i + 1];
    const ds = Math.hypot(b.x - a.x, b.z - a.z);
    assert.ok(ds > 0.1, `Zero-length spline segment at ${i}`);
    const gradePct = (Math.abs(b.y - a.y) / ds) * 100;
    if (gradePct > maxGradePct) maxGradePct = gradePct;
    maxRoadOuterX = Math.max(maxRoadOuterX, a.x + COASTAL_HILL_ROAD_HALF_WIDTH);
  }
  assert.ok(
    maxGradePct <= 9.8,
    `Max switchback grade ${maxGradePct.toFixed(2)}% must stay gentle (<= 9.8%)`,
  );
  assert.ok(
    maxRoadOuterX < 101.5,
    `Switchback outer asphalt edge (${maxRoadOuterX.toFixed(2)}m) must stay west of 101.5m coastal seawall`,
  );

  // Check genuinely non-adjacent switchback passes (>= 24m apart along road arc length) maintain >= 11.5m 2D separation (cut outer margin = 5.95m < half sep)
  const evalSegs = COASTAL_HILL_EVAL_SEGMENTS;
  const arcS: number[] = [0];
  for (let i = 1; i < evalSegs.length; i++) {
    arcS.push(arcS[i - 1] + Math.hypot(evalSegs[i].x - evalSegs[i - 1].x, evalSegs[i].az - evalSegs[i - 1].az));
  }
  for (let i = 0; i < evalSegs.length - 1; i++) {
    for (let j = i + 1; j < evalSegs.length - 1; j++) {
      const midArcDist = Math.abs(0.5 * (arcS[j] + arcS[j + 1]) - 0.5 * (arcS[i] + arcS[i + 1]));
      if (midArcDist < 24.0) continue;
      const mx = 0.5 * (evalSegs[i].x + evalSegs[i + 1].x);
      const mz = 0.5 * (evalSegs[i].az + evalSegs[i + 1].az);
      const nx = 0.5 * (evalSegs[j].x + evalSegs[j + 1].x);
      const nz = 0.5 * (evalSegs[j].az + evalSegs[j + 1].az);
      const dist = Math.hypot(mx - nx, mz - nz);
      assert.ok(
        dist >= 14.5,
        `Switchback passes ${i} and ${j} too close (${dist.toFixed(2)}m)`,
      );
    }
  }
  // Ensure inner curve turn radii are wide enough (>= 6.5m) so inner curbs/rails never self-pinch
  let minTurnRadius = 1e9;
  for (let i = 1; i < COASTAL_HILL_FULL_LOOP_SPLINE_POINTS.length - 1; i++) {
    const a = COASTAL_HILL_FULL_LOOP_SPLINE_POINTS[i - 1];
    const b = COASTAL_HILL_FULL_LOOP_SPLINE_POINTS[i];
    const c = COASTAL_HILL_FULL_LOOP_SPLINE_POINTS[i + 1];
    const ax = b.x - a.x;
    const az = b.z - a.z;
    const bx = c.x - b.x;
    const bz = c.z - b.z;
    const area2 = Math.abs(ax * bz - az * bx);
    if (area2 > 1e-5) {
      const r =
        (Math.hypot(ax, az) * Math.hypot(bx, bz) * Math.hypot(ax + bx, az + bz)) /
        (2 * area2);
      if (r < minTurnRadius) minTurnRadius = r;
    }
  }
  assert.ok(
    minTurnRadius >= 6.5,
    `Minimum curve turn radius ${minTurnRadius.toFixed(2)}m must be >= 6.5m to avoid inner curb pinch`,
  );
  assert.ok(COASTAL_HILL_CUT_INNER_M >= 5.55);
  assert.ok(COASTAL_HILL_CUT_OUTER_M >= 7.15);

  // Exact N/S symmetry of road sampler & plateau SDF
  for (const [tx, tz] of [
    [96.0, 108.0],
    [76.0, 125.6],
    [52.0, 134.8],
    [-15.0, 144.5],
    [-126.5, 45.0],
    [-15.0, 130.0],
  ]) {
    const pos = evaluateCoastalHillRoadSample(tx, tz);
    const neg = evaluateCoastalHillRoadSample(tx, -tz);
    assert.ok(Math.abs(pos.distToCenterM - neg.distToCenterM) < 1e-6);
    assert.ok(Math.abs(pos.roadElevY - neg.roadElevY) < 1e-6);
    assert.ok(Math.abs(pos.cutAlpha - neg.cutAlpha) < 1e-6);
    assert.ok(
      Math.abs(evaluateHillVillaPlateauSdf(tx, tz) - evaluateHillVillaPlateauSdf(tx, -tz)) < 1e-6,
    );
  }

  // Early-out boundary (x = -110, az = 98) must have cutAlpha = 0 seamlessly
  assert.equal(evaluateCoastalHillRoadSample(-109.9, 97.9).cutAlpha, 0.0);
  assert.equal(evaluateCoastalHillRoadSample(-110.1, 98.0).cutAlpha, 0.0);
  assert.equal(evaluateCoastalHillRoadSample(96.0, 97.9).cutAlpha, 0.0);
  assert.equal(evaluateCoastalHillRoadSample(96.0, 98.1).cutAlpha, 0.0);
});

test('Hilltop Villa Plateaus (North, South, West) align flush with Ridge Highway and open wide driveway gaps', () => {
  assert.equal(HILL_VILLA_PLATEAUS.length, 3);
  for (const p of HILL_VILLA_PLATEAUS) {
    assert.equal(p.elevY, 8.5);
    const cx = 0.5 * (p.minX + p.maxX);
    const cz = 0.5 * (p.minZ + p.maxZ);
    assert.ok(
      evaluateHillVillaPlateauSdf(cx, cz) < -5.0,
      `Plateau ${p.id} center (${cx}, ${cz}) must be deep inside plateau SDF`,
    );
  }

  // Driveway aprons bridge Ridge Highway <-> Plateau cleanly without pinching
  assert.ok(evaluateHillVillaDrivewayApronSdf(-15.0, -141.0) < -1.5);
  assert.ok(evaluateHillVillaDrivewayApronSdf(-15.0, 141.0) < -1.5);
  assert.ok(evaluateHillVillaDrivewayApronSdf(-130.1, 0.0) < -1.5);

  // Inner edge driveway openings skip curbs/guardrails while outer cliff edge retains them
  assert.equal(isPointInCoastalHillDrivewayGap(-15.0, -140.85), true);
  assert.equal(isPointInCoastalHillDrivewayGap(-15.0, 140.85), true);
  assert.equal(isPointInCoastalHillDrivewayGap(-130.15, 0.0), true);
  // Outer cliff sides stay guarded
  assert.equal(isPointInCoastalHillDrivewayGap(-15.0, -148.15), false);
  assert.equal(isPointInCoastalHillDrivewayGap(-15.0, 148.15), false);
  assert.equal(isPointInCoastalHillDrivewayGap(-122.85, 0.0), false);
});

test('buildCoastalHillGlslSnippet synchronizes constants and spline array with TypeScript', () => {
  const glsl = buildCoastalHillGlslSnippet();
  assert.ok(glsl.includes(`COASTAL_HILL_PT_COUNT = ${COASTAL_HILL_EVAL_SEGMENTS.length}`));
  assert.ok(glsl.includes('float evaluateHillVillaPlateauSdf(vec2 p)'));
  assert.ok(glsl.includes('float evaluateHillVillaDrivewayApronSdf(vec2 p)'));
  assert.ok(glsl.includes('vec3 evalCoastalHillRoad(vec2 p)'));
  assert.ok(glsl.includes(COASTAL_HILL_CUT_INNER_M.toFixed(2)));
  assert.ok(glsl.includes(COASTAL_HILL_CUT_OUTER_M.toFixed(2)));
  assert.ok(COASTAL_HILL_WALKABLE_HALF_WIDTH > COASTAL_HILL_ROAD_HALF_WIDTH);
});
