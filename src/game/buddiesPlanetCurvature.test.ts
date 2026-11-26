import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  PLANET_CURVATURE_STRENGTH,
  PLANET_RIVERBED_DEPTH,
  PLANET_WATER_SURFACE_Y,
  EAST_WATER_SURFACE_Y,
  HARBOR_SEABED_DEEP_Y,
  evaluateEastCoastalSandyMask,
  evaluateHarborSeabedDrop,
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
  evaluatePlanetWaterField,
  evaluateBlitzGrassMask,
  ZEBRA_CROSSWALK_ZONES,
  isPointOnZebraCrosswalk,
  isPointOnAsphaltRoadOrZebraCross,
  OUTER_TRAM_SIDEWALK_WIDTH_M,
  evaluateOuterTramSidewalkSdf,
  isPointOnOuterTramSidewalk,
  INNER_TRAM_SIDEWALK_WIDTH_M,
  evaluateInnerTramSidewalkSdf,
  isPointOnInnerTramSidewalk,
  createHorizontalPolygonSlabGeometry,
  applyTerrainSculptBrush,
  resetTerrainSculptGrid,
  BEACHFRONT_STILT_CABIN_SPEC,
  isPointOnBeachfrontStiltCabinDeck,
  evaluateBeachfrontStiltCabinElevation,
  getBaseProceduralGroundElevation,
  URBAN_SIDEWALK_TOP_Y,
  evaluateUrbanSidewalkElevation,
} from './buddiesPlanetCurvature';
import {
  bakeStaticGroupMeshes,
  createBlitzStrokeMesh,
  createUnifiedWaterSurfaceMaterial,
  upgradeMeshToBlitzWorldMaterial,
  type BlitzWindUniforms,
} from './buddiesBlitzShadersAndAssets';
import { buildStaticWorldStructuresList } from './buddiesBlitzWorldBuilder';
import {
  generateUnderwaterEcologyPlacements,
  isPointClearOfPierAndQuay,
} from './buddiesUnderwaterEcology';
import { buildSouthEastCoastalBeachfront3D } from './buddiesCoastalBeachBuilder';
import { buildCoastalBeachClub3D } from './buddiesBeachClubBuilder';
import { BEACH_CLUB_MASTERPLAN, evaluateBeachClubElevation } from './buddiesBeachClubRules';

test('PLANET_CURVATURE_STRENGTH is 0.0 for 100% flat Buddies Blitz ground', () => {
  assert.equal(PLANET_CURVATURE_STRENGTH, 0.0);
  assert.equal(PLANET_RIVERBED_DEPTH, 0.0);
  assert.equal(PLANET_WATER_SURFACE_Y, 0.0);
  assert.equal(computePlanetYOffset(25, 12, 5, 12), 0.0);
});

test('wrapPlanetCoord clamps within [-156, +156] and getPlanetShortestDelta is flat Euclidean delta', () => {
  assert.equal(wrapPlanetCoord(24), 24);
  assert.equal(wrapPlanetCoord(145), 145);
  assert.equal(wrapPlanetCoord(175), 156);
  assert.equal(wrapPlanetCoord(-175), -156);

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

  // Outer Coastal Hills rise around North, West, and South borders; Switchbacks, Ridge Highway & Villa Plateaus are walkable
  assert.ok(evaluateOuterEmbankmentSdf(0, 0) < -80);
  assert.ok(evaluateOuterEmbankmentSdf(0, 115.5) > 0.5);
  assert.ok(evaluateOuterEmbankmentSdf(0, -115.5) > 0.5);
  assert.ok(evaluateOuterEmbankmentSdf(0, 154) > 2.0);
  assert.ok(evaluateOuterEmbankmentSdf(0, -154) > 2.0);
  assert.ok(evaluateOuterEmbankmentSdf(-112, 0) > 4.0);
  assert.ok(evaluateOuterEmbankmentSdf(-153, 0) > 1.5);
  // East boundary (x > 133.2) is the Impassable Open Ocean past the widened 134m shoreline
  assert.ok(evaluateOuterEmbankmentSdf(140, 0) > 4.0);

  // Walkable +8.50m Twin Peaks Ridge Highway & 3 flat (+8.50m) Hilltop Villa Plateaus
  assert.ok(evaluateOuterEmbankmentSdf(0, 125) < -3.0);
  assert.ok(evaluateOuterEmbankmentSdf(0, -125) < -3.0);
  assert.ok(evaluateOuterEmbankmentSdf(-140, 0) < -3.0);
  assert.ok(evaluateOuterEmbankmentSdf(-126.5, 0) < -3.0);
  assert.equal(getTerrainElevation(0, 125), 8.5);
  assert.equal(getTerrainElevation(0, -125), 8.5);
  assert.equal(getTerrainElevation(-140, 0), 8.5);
  assert.equal(getTerrainElevation(-126.5, 0), 8.5);
  assert.ok(getTerrainElevation(-112, 55) > 4.0);
  assert.ok(evaluateBlitzGrassMask(0, 125) > 0.85, 'South Villa Plateau should grow lush grass');
  assert.ok(evaluateBlitzGrassMask(0, -125) > 0.85, 'North Villa Plateau should grow lush grass');
  assert.ok(evaluateBlitzGrassMask(-140, 0) > 0.85, 'West Villa Plateau should grow lush grass');
  assert.equal(evaluateBlitzGrassMask(-126.5, 0), 0.0, 'Ridge highway must have zero grass');

  // Widened West Elevated Concrete Lobby & Shopping Plaza Platform is raised (+2.50m) across x ∈ [-104.5, -76.5], z ∈ [-38, +38]
  assert.ok(evaluateWestPowerPlantSdf(-88.5, 0.0) < -5.0);
  assert.ok(evaluateWestPowerPlantSdf(-96.0, 25.0) < -5.0);
  assert.ok(Math.abs(getRawGroundElevation(-96.0, 0.0) - 2.50) < 0.05);
  assert.ok(Math.abs(getTerrainElevation(-96.0, 0.0) - 2.50) < 0.05);
  // Urban Plaza to Street Staircase (20m wide: z in [-10, +10]) descends from +2.50m Plaza through +1.32m Mid-Landing to 0.0m Street
  assert.ok(Math.abs(getTerrainElevation(-83.35, 0.0) - 1.32) < 0.05);
  assert.ok(getTerrainElevation(-80.75, 0.0) > 0.40 && getTerrainElevation(-80.75, 0.0) < 1.10);
  assert.equal(getTerrainElevation(-73.8, 0.0), 0.0);

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
  // Central S-Curves (West s1-s3 North-only: South branch closed into park lawn; East & x=-18 connectors mirrored N/S)
  assert.ok(evaluateRoadNetworkSdf(-13, 0) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, 14) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, -14) < 0);
  assert.ok(evaluateRoadNetworkSdf(-33, -26) < 0, 'West-North S-curve s3 remains open road');
  assert.ok(evaluateRoadNetworkSdf(-33, 26) > 0, 'Closed West-South S-curve s3 is now park lawn');
  assert.ok(evaluateRoadNetworkSdf(-55, 15) > 0, 'Closed West-South S-curve s1 is now park/sidewalk');
  assert.ok(evaluateRoadNetworkSdf(-45, 22) > 0, 'Closed West-South S-curve s2 is now park lawn');
  assert.ok(evaluateRoadNetworkSdf(26, 24) < 0);
  assert.ok(evaluateRoadNetworkSdf(26, -24) < 0);
  assert.ok(evaluateRoadNetworkSdf(-18, 40) < 0);
  assert.ok(evaluateRoadNetworkSdf(-18, -40) < 0);
  assert.ok(evaluateRoadNetworkSdf(19, 40) < 0);
  assert.ok(evaluateRoadNetworkSdf(19, -40) < 0);

  // Widened Commercial Avenues at x = -60, 0, +60 (divider Roads 2 & 4 at x = -30, +30 are closed for the 4-lot block layout)
  for (const roadX of [-60, 0, 60]) {
    assert.ok(evaluateRoadNetworkSdf(roadX, 80) < 0, `Expected widened avenue at (${roadX}, 80)`);
    assert.ok(evaluateRoadNetworkSdf(roadX, -80) < 0, `Expected widened avenue at (${roadX}, -80)`);
  }
  for (const closedX of [-30, 30]) {
    assert.ok(evaluateRoadNetworkSdf(closedX, 80) > 0, `Expected closed divider road at (${closedX}, 80)`);
    assert.ok(evaluateRoadNetworkSdf(closedX, -80) > 0, `Expected closed divider road at (${closedX}, -80)`);
  }
  assert.ok(evaluateRoadNetworkSdf(0, 108) < 0);
  assert.ok(evaluateRoadNetworkSdf(0, -108) < 0);
  assert.ok(evaluateRoadNetworkSdf(80, 108) < 0, 'Extended South rear road must reach East coast');
  assert.ok(evaluateRoadNetworkSdf(80, -108) < 0, 'Extended North rear road must reach East coast');
  assert.ok(evaluateRoadNetworkSdf(96, 108) < 0);
  assert.ok(evaluateRoadNetworkSdf(96, -108) < 0);
  assert.equal(getTerrainElevation(80, 108), 0.0);
  assert.equal(getTerrainElevation(80, -108), 0.0);
  assert.ok(evaluateRoadNetworkSdf(-126.5, 0) < 0, 'Twin Peaks West crest road must register on road SDF');
  assert.ok(evaluateRoadNetworkSdf(-15.0, 144.5) < 0, 'South Ridge road must register on road SDF');
  assert.ok(evaluateRoadNetworkSdf(-15.0, -144.5) < 0, 'North Ridge road must register on road SDF');

  // North-South Mirror Symmetry on all mirrored segments (excluding intentionally North-only West s1-s3)
  for (const [rx, rz] of [
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
  assert.ok(evaluatePlanetWaterField(-31.0, 0.0) > 0.9);
  assert.ok(Math.abs(evaluateNwLakeSdf(-31.0, 6.5) - evaluateNwLakeSdf(-31.0, -6.5)) < 1e-6);

  // 3. Widened Continuous East Coast Beach & Beach Club Terrace (shoreline = 134.0m across z in [-104.2..+104.2]) & Open East Ocean (x > 134)
  const beachClubLand = evaluateSeHarborSdf(95, 0);
  assert.ok(beachClubLand.waterSdf > 10.0);

  const widenedSandSouth = evaluateSeHarborSdf(126, 75);
  assert.ok(widenedSandSouth.waterSdf > 5.0);

  const coastalSeawallTail = evaluateSeHarborSdf(106, 120);
  assert.ok(coastalSeawallTail.waterSdf > 0);

  const seaEast = evaluateSeHarborSdf(140, 0);
  assert.ok(seaEast.waterSdf < 0);
  assert.ok(evaluatePlanetWaterField(140, 0) > 0.9);
  assert.ok(evaluatePlanetWaterField(140, 95) > 0.9);

  // 4. Widened NE Beach Club Sand vs Open Ocean past 134m shoreline
  const reclaimedSand = evaluateSeHarborSdf(126, -75);
  assert.ok(reclaimedSand.waterSdf > 5.0, 'Widened NE beach sand at (126, -75) must be dry land');
  assert.ok(evaluateOuterEmbankmentSdf(126, -75) < -4.0, 'Player must be able to walk onto widened NE sand');
  assert.equal(evaluateBlitzGrassMask(126, -75), 0.0, 'Widened NE beach sand must have zero grass');

  // Ocean beyond widened shoreline (x >= 138) remains ocean water & impassable outside stilt cabin
  assert.ok(evaluateSeHarborSdf(138, -75).waterSdf < 0);
  assert.ok(evaluateOuterEmbankmentSdf(138, -75) > 1.5);
  assert.ok(evaluatePlanetWaterField(138, -75) > 0.9);
});

test('evaluateBlitzGrassMask preserves zero grass inside the single intact Bottom-Left Model Estate Base and renders lush green lawn across all 7 emptied base lots and Warzone islands', () => {
  // Open Warzone islands ((0, 0), (-53.5, 0.0), (53.5, 0.0)) have lush green grass (> 0.85)
  assert.ok(evaluateBlitzGrassMask(0, 0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(-53.5, 0.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(53.5, 0.0) > 0.85);

  // 1. Former Bottom-Left Model Estate area (plotX = -45.0) is now clean lush green grass (> 0.85) after WS20 removal
  assert.ok(evaluateBlitzGrassMask(-45.0, 86.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(-45.0, 72.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(-45.0, 64.0) > 0.85);

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

  // Lush InfiniteGrass on West Wind Farm hills (-54.0, ±32.0), Central Forest pockets (0.0, 32.0), and widened East Warzone (46.0, 0.0)
  assert.ok(evaluateBlitzGrassMask(-54.0, -32.0) > 0.85);
  assert.ok(evaluateBlitzGrassMask(-54.0, 32.0) > 0.85);
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

test('isPointOnZebraCrosswalk and isPointOnAsphaltRoadOrZebraCross detect all 13 zebra crosswalks and asphalt highways accurately', () => {
  assert.equal(ZEBRA_CROSSWALK_ZONES.length, 13);
  for (const zone of ZEBRA_CROSSWALK_ZONES) {
    assert.equal(isPointOnZebraCrosswalk(zone.cx, zone.cz), true);
    assert.equal(isPointOnAsphaltRoadOrZebraCross(zone.cx, zone.cz), true);
    if (zone.mirroredZ) {
      assert.equal(isPointOnZebraCrosswalk(zone.cx, -zone.cz), true);
      assert.equal(isPointOnAsphaltRoadOrZebraCross(zone.cx, -zone.cz), true);
    }
  }
  // Deleted South Plaza & West-South S-curve crosswalks must NOT register
  assert.equal(isPointOnZebraCrosswalk(-68.05, 8.6), false);
  assert.equal(isPointOnZebraCrosswalk(-60.0, 15.0), false);
  // New North Residence crosswalk must register
  assert.equal(isPointOnZebraCrosswalk(9.8, -50.05), true);

  // Off-road grass island at (0, 0) is neither asphalt road nor zebra crosswalk
  assert.equal(isPointOnZebraCrosswalk(0, 0), false);
  assert.equal(isPointOnAsphaltRoadOrZebraCross(0, 0), false);

  // Asphalt highway at (-13, 0) is on asphalt road
  assert.equal(isPointOnAsphaltRoadOrZebraCross(-13, 0), true);
});

test('Outer Tram Ring Sidewalk spans 4.40m matching main zebra crosswalks and suppresses grass cleanly', () => {
  assert.equal(OUTER_TRAM_SIDEWALK_WIDTH_M, 4.4);
  const collectorMidpointsX = [-51.85, -38.15, -21.85, -8.15, 8.15, 21.85, 38.15, 51.85];

  for (const mx of collectorMidpointsX) {
    for (const sz of [-58.13, 58.13]) {
      assert.equal(
        isPointOnOuterTramSidewalk(mx, sz),
        true,
        `Expected collector sidewalk block at (${mx}, ${sz})`,
      );
      assert.ok(
        evaluateOuterTramSidewalkSdf(mx, sz) <= 0,
        `Expected negative SDF inside sidewalk block (${mx}, ${sz})`,
      );
      assert.equal(
        evaluateBlitzGrassMask(mx, sz),
        0.0,
        `Expected zero grass inside outer tram sidewalk at (${mx}, ${sz})`,
      );
    }
  }

  // East-Central, SW corner, NE corner, and Beachfront Halte apron
  for (const [sx, sz] of [
    [76.13, 0.0],
    [-68.5, 58.5],
    [76.13, -30.0],
    [75.0, 29.5],
  ] as const) {
    assert.equal(isPointOnOuterTramSidewalk(sx, sz), true, `Expected sidewalk at (${sx}, ${sz})`);
    assert.equal(evaluateBlitzGrassMask(sx, sz), 0.0, `Expected zero grass at (${sx}, ${sz})`);
  }

  // Exclusions: widened avenues (-60, 0, +60), East Harbor spurs, Beachfront Halte, SE Beachfront walkway, NW Casino, West Plaza
  for (const [ex, ez] of [
    [-60.0, -58.0],
    [0.0, -58.0],
    [60.0, 58.0],
    [76.13, -15.0],
    [76.13, 15.0],
    [79.6, 29.5],
    [76.6, 52.0],
    [-76.0, -58.13],
    [-76.0, 0.0],
  ] as const) {
    assert.equal(
      isPointOnOuterTramSidewalk(ex, ez),
      false,
      `Expected excluded zone at (${ex}, ${ez}) not to be marked as outer tram sidewalk`,
    );
  }
});

test('createHorizontalPolygonSlabGeometry produces finite positions, normals, and metric planar UVs', () => {
  const slab = createHorizontalPolygonSlabGeometry(
    [
      [-2.2, -4.4],
      [2.2, -4.4],
      [2.2, 4.4],
      [-2.2, 4.4],
    ],
    -0.06,
    0.09,
    2.2,
  );
  const pos = slab.getAttribute('position');
  const norm = slab.getAttribute('normal');
  const uv = slab.getAttribute('uv');
  assert.ok(pos && pos.count > 0);
  assert.ok(norm && norm.count === pos.count);
  assert.ok(uv && uv.count === pos.count);

  slab.computeBoundingBox();
  assert.ok(slab.boundingBox);
  assert.ok(Math.abs(slab.boundingBox.min.y - -0.06) < 1e-4);
  assert.ok(Math.abs(slab.boundingBox.max.y - 0.09) < 1e-4);

  for (let i = 0; i < pos.count; i++) {
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
    assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)));
  }
  slab.dispose();
});

test('Widened Tram+Car Ring Road & 4.40m Inner Tram Sidewalk span all 4 sides cleanly beside the preserved tram track', () => {
  assert.equal(INNER_TRAM_SIDEWALK_WIDTH_M, 4.4);

  // Preserved Tram Track Centerline & Outer Boundary (+3.90m)
  assert.ok(evaluateRoadNetworkSdf(-70.0, 0.0) < -3.0);
  assert.ok(evaluateRoadNetworkSdf(70.0, 0.0) < -3.0);
  assert.ok(evaluateRoadNetworkSdf(0.0, 52.0) < -3.0);
  assert.ok(evaluateRoadNetworkSdf(0.0, -52.0) < -3.0);

  // Newly widened parallel Car Lane inside the tram track (-3.90m .. -7.80m) across West, East, North & South
  for (const [cx, cz] of [
    [-64.5, -25.0],
    [-64.5, 25.0],
    [64.5, -25.0],
    [64.5, 25.0],
    [0.0, -46.5],
    [0.0, 46.5],
    [-40.0, -46.5],
    [40.0, 46.5],
  ] as const) {
    assert.ok(evaluateRoadNetworkSdf(cx, cz) < -1.0, `Expected widened car lane on asphalt at (${cx}, ${cz})`);
    assert.equal(evaluateBlitzGrassMask(cx, cz), 0.0, `Expected zero grass inside widened car lane at (${cx}, ${cz})`);
  }

  // Single North Plaza zebra crosswalk (-68.05, -8.6), new North Residence crosswalk (9.8, -50.05),
  // East Harbor crosswalk at (68.05, 0), and inner S-curve zebra crosswalks at (x, ±42.0)
  assert.equal(isPointOnZebraCrosswalk(-65.0, 0.0), false);
  assert.equal(isPointOnZebraCrosswalk(-65.0, -8.6), true);
  assert.equal(isPointOnZebraCrosswalk(-70.0, -8.6), true);
  assert.equal(isPointOnZebraCrosswalk(-65.0, 8.6), false);
  assert.equal(isPointOnZebraCrosswalk(-70.0, 8.6), false);
  assert.equal(isPointOnZebraCrosswalk(9.8, -47.0), true);
  assert.equal(isPointOnZebraCrosswalk(9.8, -53.0), true);
  assert.equal(isPointOnZebraCrosswalk(65.0, 0.0), true);
  assert.equal(isPointOnZebraCrosswalk(70.0, 0.0), true);
  for (const sx of [-18.0, 19.0, 42.0]) {
    assert.equal(isPointOnZebraCrosswalk(sx, 42.0), true);
    assert.equal(isPointOnZebraCrosswalk(sx, -42.0), true);
  }

  // 4.40m Inner Tram Ring Sidewalk across all 4 straight segments (including continuous closed West-South z=+15) & 4 inner L-corners + zero grass
  for (const [ix, iz] of [
    [-60.0, -30.0],
    [-60.0, 30.0],
    [-60.0, -7.5],
    [-60.0, 15.0],
    [60.0, 0.0],
    [60.0, -30.0],
    [-40.0, -42.0],
    [-9.5, -42.0],
    [13.7, -42.0],
    [30.0, -42.0],
    [-25.0, 42.0],
    [0.0, 42.0],
    [30.0, 42.0],
    [-59.0, -41.0],
    [59.0, -41.0],
    [59.0, 41.0],
    [-59.0, 41.0],
  ] as const) {
    assert.equal(isPointOnInnerTramSidewalk(ix, iz), true, `Expected inner tram sidewalk at (${ix}, ${iz})`);
    assert.ok(evaluateInnerTramSidewalkSdf(ix, iz) <= 0.0, `Expected negative SDF on inner sidewalk at (${ix}, ${iz})`);
    assert.equal(evaluateBlitzGrassMask(ix, iz), 0.0, `Expected zero grass on inner sidewalk at (${ix}, ${iz})`);
  }

  // Exclusions: open intersecting S-curve roads & 4 inner Halte decks (including relocated Beachfront Harbor Halte at (58.9, 28.6))
  for (const [ex, ez] of [
    [-60.0, -15.0],
    [60.0, -15.0],
    [60.0, 15.0],
    [-18.0, -42.0],
    [19.0, -42.0],
    [42.0, -42.0],
    [-18.0, 42.0],
    [19.0, 42.0],
    [42.0, 42.0],
    [-58.9, 4.6],
    [3.5, -40.87],
    [-36.5, 40.87],
    [58.9, 28.6],
  ] as const) {
    assert.equal(
      isPointOnInnerTramSidewalk(ex, ez),
      false,
      `Expected street/Halte exclusion at (${ex}, ${ez}) not to be marked as inner sidewalk`,
    );
  }
});

test('East coastal seabed slopes gently continuously from 134.0m (-2.00m Box 2) shoreline through crystal shallows to -3.65m ocean while N/S seawalls drop steeply', () => {
  resetTerrainSculptGrid();
  assert.equal(EAST_WATER_SURFACE_Y, -2.16);
  assert.equal(HARBOR_SEABED_DEEP_Y, -3.65);

  // 1. SE Beachfront (z = 75.0 in [-104.2..+104.2]): Box 1 (-1.00m) -> Box 2 (-2.00m) -> smooth 14m sandy seabed slope off widened x=134.0
  assert.equal(evaluateEastCoastalSandyMask(75.0), 1.0);
  const seBox1 = getTerrainElevation(110.0, 75.0);
  const seDry = getTerrainElevation(132.5, 75.0);
  const seShore = getTerrainElevation(134.0, 75.0);
  const seShallowNear = getTerrainElevation(138.5, 75.0);
  const seShallowMid = getTerrainElevation(141.5, 75.0);
  const seDeep = getTerrainElevation(148.5, 75.0);

  assert.equal(seBox1, -1.0);
  assert.equal(seDry, -2.0);
  assert.ok(seShore > -2.02 && seShore <= -2.0, `SE shoreline expected near -2.0m, got ${seShore}`);
  const depthNear = EAST_WATER_SURFACE_Y - seShallowNear;
  const depthMid = EAST_WATER_SURFACE_Y - seShallowMid;
  assert.ok(depthNear >= 0.2 && depthNear <= 0.55, `Expected 0.2-0.55m shallow depth at x=138.5, got ${depthNear}`);
  assert.ok(depthMid >= 0.65 && depthMid <= 0.95, `Expected 0.65-0.95m mid shallow depth at x=141.5, got ${depthMid}`);
  assert.ok(seShore > seShallowNear && seShallowNear > seShallowMid && seShallowMid > seDeep);
  assert.ok(Math.abs(seDeep - -3.65) < 1e-5, `Expected -3.65m deep ocean at x=148.5, got ${seDeep}`);

  // 2. Central Beach Club Coast (z = 0.0) & North Beach (z = -75.0): continuous widened beach slope!
  for (const bz of [0.0, -75.0]) {
    assert.equal(evaluateEastCoastalSandyMask(bz), 1.0);
    assert.equal(getTerrainElevation(128.0, bz), -2.0);
    const shore = getTerrainElevation(134.0, bz);
    const shallow = getTerrainElevation(140.0, bz);
    const deep = getTerrainElevation(148.5, bz);
    const shallowDepth = EAST_WATER_SURFACE_Y - shallow;
    assert.ok(shore > -2.02 && shore <= -2.0, `Shoreline at z=${bz} expected near -2.0m, got ${shore}`);
    assert.ok(shallowDepth >= 0.35 && shallowDepth <= 0.85, `Expected crystal shallow depth at z=${bz}, got ${shallowDepth}`);
    assert.ok(Math.abs(deep - -3.65) < 1e-5, `Expected -3.65m deep ocean at z=${bz}, got ${deep}`);
  }

  // 3. North/South outer seawall tails (|z| > 105.2) keep steep -3.65m drop
  for (const tailZ of [-120.0, 120.0]) {
    assert.equal(evaluateEastCoastalSandyMask(tailZ), 0.0, `Expected seawall mask 0 at z=${tailZ}`);
    const tailDrop = evaluateHarborSeabedDrop(111.3, tailZ);
    assert.ok(Math.abs(tailDrop - -3.65) < 1e-5, `Expected steep -3.65m drop at (111.3, ${tailZ}), got ${tailDrop}`);
  }
});

test('createUnifiedWaterSurfaceMaterial configures Beer-Lambert depth, Voronoi foam, Fresnel/sun glint, weather uniforms, and Linear THREE.Fog', () => {
  const windUniforms: BlitzWindUniforms = {
    uTime: { value: 0 },
    uWindPhase: { value: 0 },
    uWindDirection: { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) },
    uWindStrength: { value: 0.35 },
    uWindGust: { value: 0.0 },
    uLightDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uLightColor: { value: new THREE.Color('#fff4c8') },
    uShadowColor: { value: new THREE.Color('#3b6e52') },
  };

  for (const kind of ['ocean', 'lake'] as const) {
    const mat = createUnifiedWaterSurfaceMaterial({ kind, windUniforms });
    assert.equal(mat.transparent, true);
    assert.equal(mat.depthWrite, false);
    assert.equal(mat.fog, true);
    for (const uniformKey of [
      'uTime',
      'uSunDirection',
      'uSunColor',
      'uSkyColor',
      'uFogColor',
      'uRainFactor',
      'uTimeOfDayNightFactor',
      'fogColor',
      'fogNear',
      'fogFar',
    ]) {
      assert.ok(uniformKey in mat.uniforms, `Missing uniform ${uniformKey} on ${kind} water material`);
    }
    assert.ok(mat.vertexShader.includes('#include <fog_pars_vertex>'));
    assert.ok(mat.vertexShader.includes('#include <fog_vertex>'));
    assert.ok(mat.fragmentShader.includes('#include <fog_pars_fragment>'));
    assert.ok(mat.fragmentShader.includes('#include <fog_fragment>'));
    assert.ok(mat.fragmentShader.includes('evalVoronoiFoamLace'));
    assert.ok(mat.fragmentShader.includes('evalWaterRainRipples'));
    assert.ok(mat.fragmentShader.includes('pow(max(ndoth, 1e-4), 96.0)'));
    assert.ok(mat.fragmentShader.includes('-0.16'));
    mat.dispose();
  }
});

test('BEACHFRONT_STILT_CABIN_SPEC provides walkable elevated deck, North stairs, and South ocean balcony', () => {
  const c = BEACHFRONT_STILT_CABIN_SPEC;
  assert.equal(c.centerX, 131.6);
  assert.equal(c.centerZ, 95.2);
  assert.equal(c.baseSandY, -2.0);
  assert.equal(c.deckTopY, -1.04);

  // North veranda & South-East overwater balcony sit cleanly at -1.04m (+0.96m above -2.00m Box 2 sand) and pass embankment walkability
  assert.equal(isPointOnBeachfrontStiltCabinDeck(132.4, 92.4), true);
  assert.equal(isPointOnBeachfrontStiltCabinDeck(134.8, 98.8), true);
  assert.equal(evaluateBeachfrontStiltCabinElevation(134.8, 98.8), c.deckTopY);
  assert.equal(getBaseProceduralGroundElevation(134.8, 98.8), c.deckTopY);
  assert.ok(
    evaluateOuterEmbankmentSdf(134.8, 98.8) < 0,
    'South-East ocean-facing balcony of BeachfrontStiltTimberCabin should remain walkable',
  );

  // Outside cabin deck over open ocean stays blocked by outer embankment SDF
  assert.equal(isPointOnBeachfrontStiltCabinDeck(138.5, 95.2), false);
  assert.ok(evaluateOuterEmbankmentSdf(138.5, 95.2) > 0);

  // North sand-to-porch staircase ramps smoothly from baseSandY (-2.00m) -> deckTopY (-1.04m)
  const stairMidX = (c.stairMinX + c.stairMaxX) * 0.5;
  const stairMidZ = (c.stairMinZ + c.stairMaxZ) * 0.5;
  const expectedMidElev = (c.baseSandY + c.deckTopY) * 0.5;
  assert.ok(Math.abs(evaluateBeachfrontStiltCabinElevation(stairMidX, stairMidZ) - expectedMidElev) < 1e-6);
  assert.ok(Math.abs(getBaseProceduralGroundElevation(stairMidX, stairMidZ) - expectedMidElev) < 1e-6);
});

test('buildStaticWorldStructuresList registers cabin body and railings while keeping stairs and veranda navigable', () => {
  const structures = buildStaticWorldStructuresList({
    blueBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: 86 },
    redBase: { baseGroup: new THREE.Group(), hqX: 0, hqZ: -86 },
    blueCommanderBases: [],
    redCommanderBases: [],
    isSafezoneMode: true,
  });

  const byId = new Map(structures.map((s) => [s.id, s]));
  for (const id of [
    'beach_stilt_cabin_body',
    'beach_stilt_cabin_rail_n',
    'beach_stilt_cabin_rail_s',
    'beach_stilt_cabin_rail_e',
    'beach_stilt_cabin_rail_w_n',
    'beach_stilt_cabin_rail_w_s',
    'beach_stilt_cabin_stair_rail_n',
    'beach_stilt_cabin_stair_rail_s',
  ]) {
    assert.ok(byId.has(id), `Expected collider ${id} in static structures`);
  }

  const hitsCabinCollider = (x: number, z: number): boolean =>
    structures.some(
      (s) =>
        s.id.startsWith('beach_stilt_cabin_') &&
        Math.abs(x - s.x) < s.halfX &&
        Math.abs(z - s.z) < s.halfZ,
    );

  assert.equal(hitsCabinCollider(132.4, 95.6), true, 'Interior cabin room must remain solid');
  assert.equal(hitsCabinCollider(132.4, 91.0), false, 'North stair entry must stay unobstructed');
  assert.equal(hitsCabinCollider(132.4, 92.4), false, 'North front veranda must stay unobstructed');
  assert.equal(hitsCabinCollider(131.6, 98.8), false, 'South ocean-facing balcony must stay unobstructed');
});

test('Underwater ecology avoids BeachfrontStiltTimberCabin piling footprint [127.6..135.6] x [91.5..100.0]', () => {
  assert.equal(isPointClearOfPierAndQuay(132.4, 95.2, 0), false);
  assert.equal(isPointClearOfPierAndQuay(139.0, 95.2, 0), true);

  const { pebbles, coralsAndKelp } = generateUnderwaterEcologyPlacements();
  for (const sample of [...pebbles, ...coralsAndKelp]) {
    const insideCabinFootprint =
      sample.x >= 127.6 && sample.x <= 135.6 && sample.z >= 91.5 && sample.z <= 100.0;
    assert.equal(
      insideCabinFootprint,
      false,
      `Ecology prop (${sample.x}, ${sample.z}) must not intersect cabin stilt pilings`,
    );
  }
});

test('Coastal Beachfront & Beach Club render timber, shingles, and BeachfrontStiltTimberCabin with 3-map PBR materials and zero black outlines or cel shaders', () => {
  const origDocument = (globalThis as { document?: unknown }).document;
  const noop = () => {};
  const stubCtx = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: () => ({ width: 100 }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
  if (!origDocument) {
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({ width: 256, height: 256, getContext: () => stubCtx }),
    };
  }

  const stubTex = new THREE.DataTexture(new Uint8Array([220, 210, 195, 255]), 1, 1, THREE.RGBAFormat);
  stubTex.needsUpdate = true;

  try {
    const windUniforms: BlitzWindUniforms = {
      uTime: { value: 0 },
      uWindPhase: { value: 0 },
      uWindDirection: { value: new THREE.Vector2(Math.SQRT1_2, Math.SQRT1_2) },
      uWindStrength: { value: 0.35 },
      uWindGust: { value: 0.0 },
      uLightDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
      uLightColor: { value: new THREE.Color('#fff4c8') },
      uShadowColor: { value: new THREE.Color('#3b6e52') },
    };

    const strokedGeos = new Set<THREE.BufferGeometry>();
    const celUpgradedMeshes = new Set<THREE.Mesh>();

    const spyCreateStroke: typeof createBlitzStrokeMesh = (geo, strokeWidth, strokeColorHex) => {
      strokedGeos.add(geo);
      return createBlitzStrokeMesh(geo, strokeWidth, strokeColorHex);
    };
    const spyUpgradeMat = (
      mesh: THREE.Mesh,
      wind: typeof windUniforms,
      tintHex?: string,
      bounceStrength?: number,
    ) => {
      celUpgradedMeshes.add(mesh);
      upgradeMeshToBlitzWorldMaterial(mesh, wind, tintHex, bounceStrength);
    };

    const parentGroup = new THREE.Group();
    const roadsGroup = new THREE.Group();
    const beachHandle = buildSouthEastCoastalBeachfront3D({
      parentGroup,
      roadsGroup,
      windUniforms,
      isSoftwareGl: false,
      lobbyConcreteTex: stubTex,
      lobbyLouverTex: stubTex,
      createBlitzStrokeMesh: spyCreateStroke,
      upgradeMeshToBlitzWorldMaterial: spyUpgradeMat,
    });

    const cabin = beachHandle.seBeachGroup.getObjectByName('BeachfrontStiltTimberCabin');
    assert.ok(cabin, 'Expected BeachfrontStiltTimberCabin group in SE Beachfront');
    assert.equal(cabin.position.x, BEACHFRONT_STILT_CABIN_SPEC.centerX);
    assert.equal(cabin.position.z, BEACHFRONT_STILT_CABIN_SPEC.centerZ);

    let beachPbrMeshCount = 0;
    const beachPbrMats = new Set<THREE.MeshStandardMaterial>();
    beachHandle.seBeachGroup.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial && mat.bumpMap && mat.roughnessMap && mat.map) {
        beachPbrMeshCount++;
        beachPbrMats.add(mat);
        assert.notEqual(mat.map.uuid, mat.bumpMap.uuid);
        assert.notEqual(mat.map.uuid, mat.roughnessMap.uuid);
        assert.ok(mat.bumpScale >= 0.030 && mat.bumpScale <= 0.050, `Unexpected bumpScale ${mat.bumpScale}`);
        assert.ok(mat.metalness <= 0.05);
        assert.equal(mat.fog, true);
        assert.equal(mesh.receiveShadow, true);
        assert.equal(celUpgradedMeshes.has(mesh), false, 'PBR wood must not be overridden by cel shader');
        assert.equal(strokedGeos.has(mesh.geometry), false, 'PBR wood must not have cartoon stroke mesh');
        assert.equal(
          mesh.children.some((c) => Boolean(c.userData?.isModelStroke)),
          false,
          'PBR wood mesh must not carry black cartoon stroke child',
        );
      }
    });
    assert.ok(beachPbrMeshCount >= 90, `Expected >= 90 PBR wood/cabin meshes, got ${beachPbrMeshCount}`);
    assert.ok(beachPbrMats.size <= 28, `Expected tightly cached PBR materials, got ${beachPbrMats.size}`);

    // Verify Coastal Beach Club PBR timber + static batching budget
    strokedGeos.clear();
    celUpgradedMeshes.clear();
    const clubHandle = buildCoastalBeachClub3D({
      windUniforms,
      isSoftwareGl: false,
      upgradeMeshToBlitzWorldMaterial: spyUpgradeMat,
      createBlitzStrokeMesh: spyCreateStroke,
      bakeStaticGroupMeshes,
    });

    let clubTotalMeshes = 0;
    let clubPbrWoodMeshes = 0;
    let clubInstancedBatches = 0;
    clubHandle.group.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh) {
        clubInstancedBatches++;
      }
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      if (!(obj as THREE.InstancedMesh).isInstancedMesh) {
        clubTotalMeshes++;
      }
      const mat = mesh.material;
      if (mat instanceof THREE.MeshStandardMaterial && mat.bumpMap && mat.roughnessMap && mat.map) {
        clubPbrWoodMeshes++;
        assert.ok(mat.bumpScale >= 0.025 && mat.bumpScale <= 0.045, `Unexpected club bumpScale ${mat.bumpScale}`);
        assert.equal(mat.metalness, 0.02);
        assert.equal(mat.fog, true);
        assert.equal(mesh.receiveShadow, true);
        assert.equal(celUpgradedMeshes.has(mesh), false, 'Beach Club PBR wood must not get cel shader override');
        assert.equal(
          mesh.children.some((c) => Boolean(c.userData?.isModelStroke)),
          false,
          'Beach Club PBR wood must not carry black cartoon stroke child',
        );
      }
    });
    assert.ok(clubInstancedBatches >= 14, `Expected >= 14 instanced batches in Beach Club, got ${clubInstancedBatches}`);
    assert.ok(clubPbrWoodMeshes >= 5, `Expected >= 5 PBR wood batches/parts in Beach Club, got ${clubPbrWoodMeshes}`);
    assert.ok(clubTotalMeshes <= 160, `Expected <= 160 non-instanced Beach Club meshes after baking, got ${clubTotalMeshes}`);
    clubHandle.dispose();
  } finally {
    stubTex.dispose();
    if (!origDocument) {
      delete (globalThis as { document?: unknown }).document;
    }
  }
});

test('all urban sidewalks (trotoar) have exact +0.09m terrain collision elevation while adjacent roads & lawns stay 0.0m', () => {
  resetTerrainSculptGrid();
  assert.equal(URBAN_SIDEWALK_TOP_Y, 0.09);

  // 1. Central Plaza Roadside Pedestrian Sidewalk (Center Landing, North, South)
  for (const [x, z] of [
    [-76.5, 0.0],
    [-74.2, 0.0],
    [-76.5, -24.0],
    [-74.5, -36.0],
    [-76.5, 24.0],
    [-74.5, 36.0],
  ]) {
    assert.ok(
      Math.abs(getTerrainElevation(x, z) - 0.09) < 1e-6,
      `Central Plaza sidewalk (${x}, ${z}) must collide at +0.09m, got ${getTerrainElevation(x, z)}`,
    );
  }

  // 2. Tennis Club Perimeter Sidewalks (+0.09m) & Scenic Clay Court (+0.108m)
  for (const [x, z] of [
    [-76.0, 50.0],
    [-90.0, 64.0],
    [-102.0, 50.0],
  ]) {
    assert.ok(
      Math.abs(getTerrainElevation(x, z) - 0.09) < 1e-6,
      `Tennis Club sidewalk (${x}, ${z}) must collide at +0.09m, got ${getTerrainElevation(x, z)}`,
    );
  }
  assert.ok(
    Math.abs(getTerrainElevation(-88.0, 50.0) - 0.108) < 1e-6,
    `Tennis Club clay court must collide at +0.108m, got ${getTerrainElevation(-88.0, 50.0)}`,
  );

  // 3. Outer & Inner Tram Ring 4.40m Sidewalks (+0.09m)
  for (const [x, z] of [
    [-52.0, -58.0], // North outer collector block
    [52.0, 58.0],   // South outer collector block
    [76.0, 0.0],    // East-Central harbor sidewalk block
    [76.0, -30.0],  // NE outer block
    [60.0, 0.0],    // Inner East-Central block
    [-60.0, 28.0],  // Inner West-South block
    [-60.0, -28.0], // Inner West-North block
    [30.0, 42.0],   // Inner South-East block
    [-9.0, -42.0],  // Inner North collector block
  ]) {
    assert.ok(
      Math.abs(getTerrainElevation(x, z) - 0.09) < 1e-6,
      `Tram sidewalk (${x}, ${z}) must collide at +0.09m, got ${getTerrainElevation(x, z)}`,
    );
  }

  // 4. Grand Casino Sidewalk (+0.09m), Median Island (+0.14m), & Cobblestone Apron (+0.022m)
  for (const [x, z] of [
    [-75.0, -42.0], // Flush Plaza-to-Casino connector
    [-67.0, -57.0], // SE Casino sidewalk plaza
    [-77.8, -56.0], // Casino East front sidewalk
    [-77.8, -84.0], // Casino NE sidewalk
    [-99.5, -70.0], // Casino West rear service sidewalk
    [-80.0, -98.0], // Curved North garden promenade
  ]) {
    assert.ok(
      Math.abs(getTerrainElevation(x, z) - 0.09) < 1e-6,
      `Grand Casino sidewalk (${x}, ${z}) must collide at +0.09m, got ${getTerrainElevation(x, z)}`,
    );
  }
  assert.ok(
    Math.abs(getTerrainElevation(-67.0, -70.6) - 0.14) < 1e-6,
    `Grand Casino median island must collide at +0.14m, got ${getTerrainElevation(-67.0, -70.6)}`,
  );
  assert.ok(
    Math.abs(getTerrainElevation(-73.5, -70.6) - 0.022) < 1e-6,
    `Grand Casino Porte-Cochere cobble apron must collide at +0.022m`,
  );

  // 5. Asphalt carriageways, zebra crosswalks, and lawns adjacent to sidewalks MUST remain 0.0m
  //    (Closed West-South entrance at (-60.0, 15.0) is now continuous +0.09m inner sidewalk!)
  assert.ok(
    Math.abs(getTerrainElevation(-60.0, 15.0) - 0.09) < 1e-6,
    `Closed West-South entrance (-60.0, 15.0) must collide at +0.09m inner sidewalk, got ${getTerrainElevation(-60.0, 15.0)}`,
  );
  for (const [x, z] of [
    [-73.8, 0.0],    // West Ring asphalt right outside Plaza curb
    [-70.0, 0.0],    // West Tram track centerline
    [-60.0, -15.0],  // Open Inner West-North S-curve crosswalk
    [-18.0, 42.0],   // Inner South S-curve crosswalk
    [19.0, -42.0],   // Inner North S-curve crosswalk
    [-60.0, 58.0],   // Outer South collector crosswalk
    [-66.0, -63.25], // Grand Casino South Valet Loop asphalt throat
    [-66.0, -77.95], // Grand Casino North Valet Loop asphalt throat
    [-66.5, -82.0],  // NE Grand Casino green lawn
    [-78.0, -45.0],  // West green lawn south of Grand Casino
  ]) {
    assert.equal(
      getTerrainElevation(x, z),
      0.0,
      `Road/lawn (${x}, ${z}) must remain strictly 0.0m, got ${getTerrainElevation(x, z)}`,
    );
  }

  // 6. Raised Shifted Central Halte platform (z = 4.6) remains +0.26m and ramps bridge smoothly onto +0.09m sidewalks
  assert.ok(Math.abs(evaluateUrbanSidewalkElevation(-76.5, 0.0) - 0.09) < 1e-6);
  assert.ok(Math.abs(getTerrainElevation(-58.9, 4.6) - 0.26) < 1e-6);
  const rampMid = getTerrainElevation(-58.9, 12.8);
  const rampEnd = getTerrainElevation(-58.9, 13.8);
  assert.ok(rampMid > 0.09 && rampMid < 0.26, `Halte ramp mid (${rampMid}) should bridge 0.09..0.26`);
  assert.ok(Math.abs(rampEnd - 0.09) < 1e-6, `Halte ramp bottom (${rampEnd}) should meet inner sidewalk at +0.09m`);
});

test('Beach Club coastal seabed depression stays strictly below all terrace decks & pool floors with seamless Kai Boardwalk perimeter blending', () => {
  resetTerrainSculptGrid();
  const mp = BEACH_CLUB_MASTERPLAN;

  // 1. Subsurface terrain stays strictly below every built Beach Club pool floor (>= 0.40m clearance)
  const poolBasins = [
    mp.pools.cascadeTier1,
    mp.pools.cascadeTier2,
    mp.pools.cascadeTier3,
    { ...mp.pools.westFlankNorth, floorY: 0.14 },
    { ...mp.pools.westFlankSouth, floorY: 0.14 },
    { ...mp.pools.lapChannels[0], floorY: -0.96 },
    { ...mp.pools.lapChannels[1], floorY: -1.36 },
    { ...mp.pools.lapChannels[2], floorY: -1.36 },
    {
      id: 'southSeaPool',
      minX: mp.pools.southSeaPool.cx - mp.pools.southSeaPool.halfX,
      maxX: mp.pools.southSeaPool.cx + mp.pools.southSeaPool.halfX,
      minZ: mp.pools.southSeaPool.cz - mp.pools.southSeaPool.halfZ,
      maxZ: mp.pools.southSeaPool.cz + mp.pools.southSeaPool.halfZ,
      floorY: -1.4,
    },
  ];
  for (const basin of poolBasins) {
    for (let x = basin.minX; x <= basin.maxX; x += 1.0) {
      for (let z = basin.minZ; z <= basin.maxZ; z += 2.0) {
        const bed = evaluateHarborSeabedDrop(x, z);
        assert.ok(
          bed <= basin.floorY - 0.4,
          `Coastal seabed (${bed.toFixed(3)}) must sit >= 0.40m below ${basin.id} floor (${basin.floorY}) at (${x}, ${z})`,
        );
      }
    }
  }

  // 2. Zero trench along Promenade -> Kai Boardwalk seam (x = 78.33..91.2, z = 46.2)
  for (const sx of [78.33, 78.35, 84.0, 91.1, 91.2]) {
    assert.ok(
      Math.abs(getTerrainElevation(sx, 46.2) - 0.82) < 1e-4,
      `Expected flush +0.82m Kai Boardwalk seam at (${sx}, 46.2), got ${getTerrainElevation(sx, 46.2)}`,
    );
  }

  // 3. Smooth ramp joining VIP Mezzanine (+0.64m at z=45.2) to Kai Boardwalk (+0.82m at z=46.2) for x in (91.2..92.2]
  let prevZ = getTerrainElevation(91.7, 45.15);
  assert.ok(Math.abs(prevZ - 0.64) < 1e-4);
  for (let z = 45.25; z <= 46.25; z += 0.1) {
    const cur = getTerrainElevation(91.7, z);
    assert.ok(cur >= prevZ - 1e-6 && cur - prevZ <= 0.08, `Trench/cliff at (91.7, ${z}): ${prevZ} -> ${cur}`);
    prevZ = cur;
  }
  assert.ok(Math.abs(getTerrainElevation(91.7, 46.2) - 0.82) < 1e-4);

  // 4. Every Beach Club terrace tier center sits above evaluateHarborSeabedDrop
  for (const tier of mp.terraceTiers) {
    const cx = (tier.minX + tier.maxX) * 0.5;
    const cz = (tier.minZ + tier.maxZ) * 0.5;
    assert.ok(evaluateHarborSeabedDrop(cx, cz) < evaluateBeachClubElevation(cx, cz));
  }
});


