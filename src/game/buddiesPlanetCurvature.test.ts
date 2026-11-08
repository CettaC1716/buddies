import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  PLANET_CURVATURE_STRENGTH,
  PLANET_RIVERBED_DEPTH,
  PLANET_WATER_SURFACE_Y,
  wrapPlanetCoord,
  getPlanetShortestDelta,
  getRawGroundElevation,
  getBridgeDeckElevation,
  getTerrainElevation,
  samplePlanetCurvature,
  computePlanetYOffset,
  computePlanetSurfaceNormal,
  applyPlanetCurvatureToObject,
  evaluateRoadNetworkSdf,
  evaluateNwLakeSdf,
  evaluateSeHarborSdf,
  evaluateWestPowerPlantSdf,
  evaluateEastConstructionYardSdf,
  evaluateEmbankmentTierOffsets,
  evaluateOuterEmbankmentSdf,
  evaluateTolanWaterField,
  evaluateBlitzGrassMask,
  ZEBRA_CROSSWALK_ZONES,
  isPointOnZebraCrosswalk,
  isPointOnAsphaltRoadOrZebraCross,
  applyTerrainSculptBrush,
  resetTerrainSculptGrid,
} from './buddiesPlanetCurvature';

test('PLANET_CURVATURE_STRENGTH is 0.0 for 100% flat Buddies Blitz ground', () => {
  assert.equal(PLANET_CURVATURE_STRENGTH, 0.0);
  assert.equal(PLANET_RIVERBED_DEPTH, 0.0);
  assert.equal(PLANET_WATER_SURFACE_Y, 0.0);
  assert.equal(computePlanetYOffset(25, 12, 5, 12), 0.0);
});

test('wrapPlanetCoord clamps within [-130, +130] and getPlanetShortestDelta is flat Euclidean delta', () => {
  assert.equal(wrapPlanetCoord(24), 24);
  assert.equal(wrapPlanetCoord(145), 130);
  assert.equal(wrapPlanetCoord(-145), -130);

  // Flat Euclidean delta without toroidal wrapping jump
  assert.equal(getPlanetShortestDelta(48, -48), 96);
  assert.equal(getPlanetShortestDelta(-10, 15), -25);
});

test('computePlanetSurfaceNormal points straight up (0, 1, 0) on flat Blitz ground', () => {
  const centerN = computePlanetSurfaceNormal(0, 0, 0, 0);
  assert.equal(centerN.nx, 0);
  assert.equal(centerN.ny, 1);
  assert.equal(centerN.nz, 0);

  const eastN = computePlanetSurfaceNormal(32, -18, 0, 0);
  assert.equal(eastN.nx, 0);
  assert.equal(eastN.ny, 1);
  assert.equal(eastN.nz, 0);
});

test('applyPlanetCurvatureToObject places objects at flat ground elevation with zero tilt when k = 0', () => {
  const obj = new THREE.Object3D();
  const yOff = applyPlanetCurvatureToObject(obj, 10, 2.0, -10, 0, 0, Math.PI / 4, 0.0);
  assert.equal(yOff, 0);
  assert.ok(Math.abs(obj.position.x - 10) < 1e-6);
  assert.ok(Math.abs(obj.position.y - 2.0) < 1e-6);
  assert.ok(Math.abs(obj.position.z - -10) < 1e-6);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion);
  assert.ok(Math.abs(up.x) < 1e-6);
  assert.ok(Math.abs(up.y - 1.0) < 1e-6);
  assert.ok(Math.abs(up.z) < 1e-6);
});

test('getRawGroundElevation and getTerrainElevation are flat (0.0m) in playable arena and raised (+8m) on Outer Perimeter Hill Embankment ("Tanggul Bukit")', () => {
  resetTerrainSculptGrid();
  for (const [x, z] of [
    [0, 0],
    [-46.5, 39.0],
    [46.5, -39.0],
    [-61.5, -58.5],
    [50.5, 50.5],
    [0.0, 108.0],
    [0.0, -108.0],
  ]) {
    assert.equal(getRawGroundElevation(x, z), 0.0);
    assert.equal(getTerrainElevation(x, z), 0.0);
    assert.equal(getBridgeDeckElevation(x, z), -Infinity);
  }

  // Outer Perimeter Hill Embankment ("Tanggul Bukit") rises sharply around the North, West, and South map boundaries
  assert.ok(evaluateOuterEmbankmentSdf(0, 0) < -80);
  assert.ok(evaluateOuterEmbankmentSdf(0, 123) > 4.0);
  assert.ok(evaluateOuterEmbankmentSdf(0, -123) > 4.0);
  assert.ok(evaluateOuterEmbankmentSdf(-112, 0) > 4.0);
  // East boundary (x > 109.2) is the Impassable Open Ocean / Coastal Seawall ("ujung dermaga")
  assert.ok(evaluateOuterEmbankmentSdf(118, 0) > 4.0);
  assert.ok(getTerrainElevation(0, 123) > 5.0);
  assert.ok(getTerrainElevation(0, -123) > 5.0);
  assert.ok(getTerrainElevation(-124, 0) > 5.0);
  assert.ok(getTerrainElevation(-112, 55) > 5.0);

  // Widened West Elevated Concrete Lobby & Shopping Plaza Platform is raised (+1.40m) across x ∈ [-104.5, -76.5], z ∈ [-38, +38]
  assert.ok(evaluateWestPowerPlantSdf(-88.5, 0.0) < -5.0);
  assert.ok(evaluateWestPowerPlantSdf(-96.0, 25.0) < -5.0);
  assert.ok(getRawGroundElevation(-96.0, 0.0) > 1.35);
  assert.ok(getTerrainElevation(-96.0, 0.0) > 1.35);

  // Central-West Oasis Lake has a real 3-Level Concave Basin Depression ("level cekungan danau", down to -1.55m at center)
  assert.ok(getRawGroundElevation(-31.0, 0.0) < -1.45);
  assert.ok(getTerrainElevation(-31.0, 0.0) < -1.45);
  assert.ok(getTerrainElevation(-25.0, 0.0) < -0.4 && getTerrainElevation(-25.0, 0.0) > -1.35);

  // East Dirt Construction Yards (x ∈ [75.5, 101.5], |z| ∈ [46.0, 104.0]) are flat dirt areas (grassMask === 0)
  assert.ok(evaluateEastConstructionYardSdf(88.5, 75.0) < -5.0);
  assert.ok(evaluateEastConstructionYardSdf(88.5, -75.0) < -5.0);
  assert.equal(evaluateBlitzGrassMask(88.5, 75.0), 0.0);
  assert.equal(evaluateBlitzGrassMask(88.5, -75.0), 0.0);

  // 4-Level Terraced Contour Offsets maintain strict non-overlapping terrace ordering (t1 > t2 > t3 > t4) on N/W/S borders
  for (const [tx, tz] of [
    [-108, -40],
    [-108, 40],
    [-40, -122],
    [40, 122],
  ]) {
    const tiers = evaluateEmbankmentTierOffsets(tx, tz);
    assert.ok(tiers.t1 - tiers.t2 >= 3.25, `Expected Terrace 1->2 separation at (${tx}, ${tz})`);
    assert.ok(tiers.t2 - tiers.t3 >= 3.35, `Expected Terrace 2->3 separation at (${tx}, ${tz})`);
    assert.ok(tiers.t3 - tiers.t4 >= 3.45, `Expected Terrace 3->4 separation at (${tx}, ${tz})`);
  }
});

test('evaluateRoadNetworkSdf, evaluateNwLakeSdf, and evaluateSeHarborSdf match 100% North-South mirrored 3-Part Arena with Outer Base Ring Roads', () => {
  // 1. Complete Outer Ring Highway Loop (x=-70 West Wind Farm, x=+70 East Ring Highway, z=-52 North Red Base, z=+52 South Blue Base)
  assert.ok(evaluateRoadNetworkSdf(-70, 0) < 0);
  assert.ok(evaluateRoadNetworkSdf(70, 0) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, 52) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, -52) < 0);
  // Mirrored Central S-Curves (s5 at x=-13, s6 at z=±14, s3 at z=±26, s8 at z=±24, s10 at x=-18, s11 at x=+19)
  assert.ok(evaluateRoadNetworkSdf(-13, 0) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, 14) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, -14) < 0);
  assert.ok(evaluateRoadNetworkSdf(-33, 26) < 0);
  assert.ok(evaluateRoadNetworkSdf(-33, -26) < 0);
  assert.ok(evaluateRoadNetworkSdf(26, 24) < 0);
  assert.ok(evaluateRoadNetworkSdf(26, -24) < 0);
  assert.ok(evaluateRoadNetworkSdf(-18, 40) < 0);
  assert.ok(evaluateRoadNetworkSdf(-18, -40) < 0);
  assert.ok(evaluateRoadNetworkSdf(19, 40) < 0);
  assert.ok(evaluateRoadNetworkSdf(19, -40) < 0);

  // Outer Base Ring Road Loop ("jalan lingkar luar area base") and 3 Complex Divider Roads separating the 4 Base Plots (x = -60, -30, 0, +30, +60)
  for (const roadX of [-60, -30, 0, 30, 60]) {
    assert.ok(evaluateRoadNetworkSdf(roadX, 80) < 0, `Expected complex divider/ring road at (${roadX}, 80)`);
    assert.ok(evaluateRoadNetworkSdf(roadX, -80) < 0, `Expected complex divider/ring road at (${roadX}, -80)`);
  }
  assert.ok(evaluateRoadNetworkSdf(0, 108) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, -108) < 0);

  // 100% North-South Mirror Symmetry: evaluateRoadNetworkSdf(x, -z) === evaluateRoadNetworkSdf(x, +z)
  for (const [rx, rz] of [
    [-55, 15],
    [-45, 22],
    [-33, 26],
    [-19, 20],
    [-13, 8],
    [0, 14],
    [14, 19],
    [28, 24],
    [-18, 42],
    [19, 42],
    [-48, 82],
    [48, 82],
    [0, 108],
  ]) {
    assert.ok(
      Math.abs(evaluateRoadNetworkSdf(rx, rz) - evaluateRoadNetworkSdf(rx, -rz)) < 1e-6,
      `Expected N/S mirror symmetry on road SDF at (${rx}, ±${rz})`,
    );
  }

  // 2. Centered Turquoise Oasis Lake at (-31.0, 0.0) with N/S Mirror Symmetry
  assert.ok(evaluateNwLakeSdf(-31.0, 0.0) < -5.0);
  assert.ok(evaluateNwLakeSdf(-58.0, -32.0) > 2.0);
  assert.ok(evaluateTolanWaterField(-31.0, 0.0) > 0.9);
  assert.ok(Math.abs(evaluateNwLakeSdf(-31.0, 6.5) - evaluateNwLakeSdf(-31.0, -6.5)) < 1e-6);

  // 3. Shifted Right-Side (East) Harbor Concrete Dock (x ∈ [76, 110]), Coastal Seawall (x ∈ [101.5, 110]), & Open East Ocean (x > 110)
  const pier = evaluateSeHarborSdf(88, 0);
  assert.ok(pier.concreteSdf < 0);
  assert.ok(pier.waterSdf > 0);

  const expandedPier = evaluateSeHarborSdf(102, -28);
  assert.ok(expandedPier.concreteSdf < 0);
  assert.ok(expandedPier.waterSdf > 0);

  const coastalSeawall = evaluateSeHarborSdf(106, 95);
  assert.ok(coastalSeawall.concreteSdf < 0);
  assert.ok(coastalSeawall.waterSdf > 0);

  const seaEast = evaluateSeHarborSdf(120, 0);
  assert.ok(seaEast.waterSdf < 0);
  assert.ok(evaluateTolanWaterField(120, 0) > 0.9);
  assert.ok(evaluateTolanWaterField(120, 95) > 0.9);
});

test('evaluateBlitzGrassMask preserves zero grass inside the single intact Bottom-Left Model Estate Base and renders lush green lawn across all 7 emptied base lots and Warzone islands', () => {
  // Open Warzone islands ((0, 0), (-53.5, 0.0), (60.0, 0.0)) have lush green grass (> 0.85)
  assert.ok(evaluateBlitzGrassMask(0, 0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(-53.5, 0.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(60.0, 0.0) > 0.85);

  // 1. Intact Bottom-Left Model Estate Base (plotX = -45.0, z in [64.2..99.2]) & its front driveway spur (z = 57.0) have grassMask === 0.0
  assert.equal(evaluateBlitzGrassMask(-45.0, 86.0), 0.0);
  assert.equal(evaluateBlitzGrassMask(-45.0, 72.0), 0.0);
  assert.equal(evaluateBlitzGrassMask(-45.0, 57.0), 0.0);

  // 2. All other 3 South Base Lots (-15.0, 15.0, 45.0) are emptied into flat lush green grass lots (> 0.85)
  for (const plotX of [-15.0, 15.0, 45.0]) {
    assert.ok(
      evaluateBlitzGrassMask(plotX, 86.0) > 0.85,
      `Expected lush green grass inside emptied South base lot at (${plotX}, 86.0)`,
    );
    assert.ok(
      evaluateBlitzGrassMask(plotX, 72.0) > 0.85,
      `Expected lush green grass inside emptied South base lot at (${plotX}, 72.0)`,
    );
    assert.ok(
      evaluateBlitzGrassMask(plotX, 92.0) > 0.85,
      `Expected lush green grass inside emptied South base lot at (${plotX}, 92.0)`,
    );
  }

  // 3. All 4 North Base Lots (-45.0, -15.0, 15.0, 45.0) are emptied into flat lush green grass lots (> 0.85)
  for (const plotX of [-45.0, -15.0, 15.0, 45.0]) {
    assert.ok(
      evaluateBlitzGrassMask(plotX, -86.0) > 0.85,
      `Expected lush green grass inside emptied North base lot at (${plotX}, -86.0)`,
    );
    assert.ok(
      evaluateBlitzGrassMask(plotX, -72.0) > 0.85,
      `Expected lush green grass inside emptied North base lot at (${plotX}, -72.0)`,
    );
    assert.ok(
      evaluateBlitzGrassMask(plotX, -92.0) > 0.85,
      `Expected lush green grass inside emptied North base lot at (${plotX}, -92.0)`,
    );
  }

  // Outside the Base Lots (e.g. x = ±66.5, z = ±82) is lush green grass
  assert.ok(evaluateBlitzGrassMask(66.5, 82.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(-66.5, -82.0) > 0.85);

  // Lush InfiniteGrass on West Wind Farm hills (-58.0, -36.0), Central Forest pockets (0.0, 32.0), and widened East Warzone (46.0, 0.0)
  assert.ok(evaluateBlitzGrassMask(-58.0, -36.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(-58.0, 36.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(0.0, 32.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(0.0, -32.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(46.0, 0.0) > 0.85);

  // Zero grass inside Centered Oasis Lake water, Shifted Right Harbor concrete, and on asphalt roads
  assert.equal(evaluateBlitzGrassMask(-31.0, 0.0), 0.0);
  assert.equal(evaluateBlitzGrassMask(90.0, 10.0), 0.0);
  assert.equal(evaluateBlitzGrassMask(-13.0, 0.0), 0.0);
  assert.equal(evaluateBlitzGrassMask(70.0, 0.0), 0.0);
});

test('applyTerrainSculptBrush raises, lowers, and flattens terrain elevation cleanly for Map Editor', () => {
  resetTerrainSculptGrid();
  const baseElevation = getRawGroundElevation(-24, -22);
  assert.equal(baseElevation, 0.0);

  applyTerrainSculptBrush(-24, -22, 10, 'sculpt_raise', 1.2);
  const raisedElevation = getRawGroundElevation(-24, -22);
  assert.ok(raisedElevation > 0.5, 'Sculpt raise should elevate terrain');

  applyTerrainSculptBrush(-24, -22, 10, 'sculpt_lower', 2.4);
  const loweredElevation = getRawGroundElevation(-24, -22);
  assert.ok(loweredElevation < -0.3, 'Sculpt lower should carve terrain basin');

  applyTerrainSculptBrush(-24, -22, 10, 'sculpt_flatten', 1.0);
  const flattenedElevation = getRawGroundElevation(-24, -22);
  assert.ok(Math.abs(flattenedElevation) < Math.abs(loweredElevation));

  resetTerrainSculptGrid();
  assert.equal(getRawGroundElevation(-24, -22), 0.0);

  const sample = samplePlanetCurvature(10, 20, 0, 0, 0);
  assert.equal(sample.yOffset, 0);
  assert.equal(sample.finalY, 0);
});

test('isPointOnZebraCrosswalk and isPointOnAsphaltRoadOrZebraCross detect all 13 zebra crosswalks and asphalt highways with N/S symmetry', () => {
  assert.equal(ZEBRA_CROSSWALK_ZONES.length, 13);
  for (const zone of ZEBRA_CROSSWALK_ZONES) {
    assert.equal(isPointOnZebraCrosswalk(zone.cx, zone.cz), true);
    assert.equal(isPointOnZebraCrosswalk(zone.cx, -zone.cz), true);
    assert.equal(isPointOnAsphaltRoadOrZebraCross(zone.cx, zone.cz), true);
    assert.equal(isPointOnAsphaltRoadOrZebraCross(zone.cx, -zone.cz), true);
  }

  // Off-road grass island at (0, 0) is neither asphalt road nor zebra crosswalk
  assert.equal(isPointOnZebraCrosswalk(0, 0), false);
  assert.equal(isPointOnAsphaltRoadOrZebraCross(0, 0), false);

  // Asphalt highway at (-13, 0) is on asphalt road
  assert.equal(isPointOnAsphaltRoadOrZebraCross(-13, 0), true);
});

