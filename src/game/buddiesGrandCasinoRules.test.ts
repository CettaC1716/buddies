import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAND_CASINO_MASTERPLAN,
  evaluateGrandCasinoValetLoopSdf,
  evaluateGrandCasinoPavedPlatformSdf,
  isInsideNorthGrandCasinoFootprint,
  isPointOnGrandCasinoCrosswalk,
  getGrandCasinoObstacles,
} from './buddiesGrandCasinoRules';
import {
  evaluateOuterEmbankmentSdf,
  evaluateRoadNetworkSdf,
  evaluateBlitzGrassMask,
  getTerrainElevation,
  isPointOnAsphaltRoadOrZebraCross,
  resetTerrainSculptGrid,
} from './buddiesPlanetCurvature';
import { DEFAULT_ARENA_MAP_LAYOUT } from './buddiesBlitzWorldBuilder';

test('Grand Casino sits strictly North of Central Plaza (worldZ < -38) at monumental Buddy scale', () => {
  const mb = GRAND_CASINO_MASTERPLAN.mainBuilding;
  const pc = GRAND_CASINO_MASTERPLAN.porteCochere;

  assert.ok(mb.maxZ < -50.0, 'Main Casino building must sit strictly North of Central Plaza (z = -38)');
  assert.ok(mb.widthZ >= 32.0, 'Main Casino building width should be monumental (>= 32m)');
  assert.ok(mb.depthX >= 16.0, 'Main Casino building depth should be monumental (>= 16m)');
  assert.ok(mb.domeFinialTopY >= 20.0, 'Verdigris Copper Dome should rise >= 20m');
  assert.ok(
    pc.valetClearanceY >= 5.2,
    'Porte-Cochere valet clearance must exceed 3.85m Buddy character & 5.05m Halte benchmark',
  );
});

test('Graded NW Hill Toe ("kaki bukit dirapikan") leaves flat 0.0m ground across entire Casino, rear service sidewalk, and curved North garden', () => {
  resetTerrainSculptGrid();

  const flatCheckPoints: [number, number][] = [
    [-88.8, -70.6], // Main Casino center
    [-97.8, -54.0], // SW building corner
    [-97.8, -87.2], // NW building corner
    [-101.2, -70.6], // Rear West service sidewalk
    [-101.0, -90.2], // Rear NW service sidewalk corner
    [-85.4, -95.6], // Curved North garden urn centerpiece
    [-80.2, -100.2], // Curved North garden apex
    [-73.5, -70.6], // Porte-Cochere Valet Drop-Off lane
    [-75.6, -42.0], // Curved South connector sidewalk to Central Plaza
  ];

  for (const [wx, wz] of flatCheckPoints) {
    const embSdf = evaluateOuterEmbankmentSdf(wx, wz);
    const elev = getTerrainElevation(wx, wz);
    assert.ok(
      embSdf < -0.5,
      `Expected graded hill toe clear of (${wx}, ${wz}), got embSdf=${embSdf.toFixed(3)}`,
    );
    assert.equal(elev, 0.0, `Expected flat 0.0m ground at (${wx}, ${wz}), got ${elev}`);
  }

  // Farther West beyond the graded Casino toe (x = -116, z = -70.6), the 4-tier hill embankment still rises naturally!
  assert.ok(evaluateOuterEmbankmentSdf(-116.0, -70.6) > 3.0);
  assert.ok(getTerrainElevation(-116.0, -70.6) > 5.0);
});

test('Casino Valet Loop never overlaps the Tram Road and SE island is paved sidewalk ("PENUHI JUGA TANAH INI MENJADI TROTOAR")', () => {
  // Autonomous City Tram Road North-West corner & collector spans z = -52.0 (northernmost asphalt at z = -55.90).
  // Between z = -59.8 and z = -56.2 across x in [-74.5 .. -64.5] (West of x = -60.0 Main Road),
  // there must be ZERO asphalt road overlap AND the entire separation island is now continuous paved sidewalk
  // with zero grass blades poking through, while the West lawn beside Central Plaza stays lush green!
  const sePavedSidewalkSamples: [number, number][] = [
    [-66.0, -58.2],
    [-68.5, -58.2],
    [-71.5, -57.5],
    [-73.5, -56.0],
    [-71.0, -52.8],
    [-75.2, -38.15], // Flush Plaza-to-Casino sidewalk junction
  ];
  for (const [bx, bz] of sePavedSidewalkSamples) {
    if (bz < -55.0) {
      const valetSdf = evaluateGrandCasinoValetLoopSdf(bx, bz);
      const roadSdf = evaluateRoadNetworkSdf(bx, bz);
      assert.ok(
        valetSdf > 2.0,
        `Expected Valet Loop well North of (${bx}, ${bz}), got valetSdf=${valetSdf.toFixed(3)}`,
      );
      assert.ok(
        roadSdf > 0.85,
        `Expected non-asphalt sidewalk separation between Tram Road and Casino Valet Loop at (${bx}, ${bz}), got roadSdf=${roadSdf.toFixed(3)}`,
      );
    }
    assert.ok(
      evaluateGrandCasinoPavedPlatformSdf(bx, bz) < -0.25,
      `Expected SE sidewalk platform SDF < -0.25 at (${bx}, ${bz}), got ${evaluateGrandCasinoPavedPlatformSdf(bx, bz).toFixed(3)}`,
    );
    assert.equal(
      evaluateBlitzGrassMask(bx, bz),
      0.0,
      `Expected zero InfiniteGrass on newly paved SE sidewalk at (${bx}, ${bz})`,
    );
  }

  // Meanwhile, the garden lawn West of the sidewalk (beside Central Plaza North railing & shrubs) stays lush green!
  for (const [gx, gz] of [
    [-82.5, -44.5],
    [-78.6, -43.5],
  ] as [number, number][]) {
    assert.ok(
      evaluateBlitzGrassMask(gx, gz) > 0.85,
      `Expected lush green lawn West of South connector sidewalk at (${gx}, ${gz}), got ${evaluateBlitzGrassMask(gx, gz).toFixed(3)}`,
    );
  }
});

test('Porte-Cochere outer column pedestals sit 100% inside the Median Island without touching the asphalt road', () => {
  const pc = GRAND_CASINO_MASTERPLAN.porteCochere;
  for (const zSign of [-1, 1] as const) {
    const cz = pc.centerZ + zSign * pc.frontColumnOffsetZ;
    const cx = pc.frontColumnX;
    // Check all 4 corners of each pedestal
    for (const dx of [-pc.pedestalHalfX, pc.pedestalHalfX]) {
      for (const dz of [-pc.pedestalHalfZ, pc.pedestalHalfZ]) {
        const cornerX = cx + dx;
        const cornerZ = cz + dz;
        const valetRoadSdf = evaluateGrandCasinoValetLoopSdf(cornerX, cornerZ);
        const fullRoadSdf = evaluateRoadNetworkSdf(cornerX, cornerZ);
        assert.ok(
          valetRoadSdf >= 0.7,
          `Pedestal corner (${cornerX.toFixed(2)}, ${cornerZ.toFixed(2)}) must stay >= 0.7m clear of Valet Loop asphalt, got ${valetRoadSdf.toFixed(3)}`,
        );
        assert.ok(
          fullRoadSdf >= 0.7,
          `Pedestal corner (${cornerX.toFixed(2)}, ${cornerZ.toFixed(2)}) must stay >= 0.7m clear of all roads, got ${fullRoadSdf.toFixed(3)}`,
        );
      }
    }
  }
});

test('Semi-Circular Valet Drop-Off Loop connects continuously to x = -60.0 Main Road with 2 crosswalks and zero grass intrusion', () => {
  const vl = GRAND_CASINO_MASTERPLAN.valetLoop;
  const roadSamples: [number, number][] = [
    [-60.0, vl.southThroatZ],
    [-64.0, vl.southThroatZ],
    [-68.3, vl.southThroatZ],
    [-73.5, GRAND_CASINO_MASTERPLAN.centerZ],
    [-68.3, vl.northThroatZ],
    [-64.0, vl.northThroatZ],
    [-60.0, vl.northThroatZ],
  ];
  for (const [rx, rz] of roadSamples) {
    assert.ok(
      evaluateRoadNetworkSdf(rx, rz) < -1.2,
      `Expected continuous asphalt road at (${rx}, ${rz}), got sdf=${evaluateRoadNetworkSdf(rx, rz)}`,
    );
    assert.equal(isPointOnAsphaltRoadOrZebraCross(rx, rz), true);
    assert.equal(evaluateBlitzGrassMask(rx, rz), 0.0);
  }

  // Both Valet Loop throat Zebra Crosswalks register cleanly
  assert.equal(isPointOnGrandCasinoCrosswalk(-65.45, vl.southThroatZ), true);
  assert.equal(isPointOnGrandCasinoCrosswalk(-65.45, vl.northThroatZ), true);
  assert.equal(isPointOnGrandCasinoCrosswalk(-73.5, GRAND_CASINO_MASTERPLAN.centerZ), false);

  // Zero grass inside Casino building, sidewalks, Median Island, South connector & North garden
  for (const [px, pz] of [
    [-88.8, -70.6],
    [-100.2, -70.6],
    [-67.4, -70.6],
    [-75.6, -40.5],
    [-85.4, -95.6],
  ]) {
    assert.equal(
      evaluateBlitzGrassMask(px, pz),
      0.0,
      `Expected zero InfiniteGrass on paved Casino zone at (${px}, ${pz})`,
    );
  }

  // Existing North-of-loop roadside lawn at (-66.5, -82.0) remains lush green grass (> 0.85)
  assert.ok(evaluateBlitzGrassMask(-66.5, -82.0) > 0.85);
  assert.ok(evaluateGrandCasinoValetLoopSdf(-73.5, -70.6) < -2.5);
  assert.ok(evaluateGrandCasinoPavedPlatformSdf(-88.8, -70.6) < -5.0);
});

test('Grand Casino OBB colliders keep the 5.40m Porte-Cochere Valet Drop-Off lane unobstructed and default map props do not overlap', () => {
  const obstacles = getGrandCasinoObstacles();
  assert.ok(obstacles.length >= 12);

  // Verify no OBB collider overlaps the Valet Drop-Off drive-through lane (x = -73.5, z in [-74.5 .. -66.5])
  for (let z = -74.5; z <= -66.5; z += 1.0) {
    const laneX = -73.5;
    for (const obb of obstacles) {
      const overlaps =
        Math.abs(laneX - obb.x) < obb.halfX + 1.1 &&
        Math.abs(z - obb.z) < obb.halfZ + 0.1;
      assert.equal(
        overlaps,
        false,
        `OBB ${obb.id} should not block the Porte-Cochere Valet Drop-Off lane at (${laneX}, ${z})`,
      );
    }
  }

  // Verify zero props in DEFAULT_ARENA_MAP_LAYOUT overlap the Grand Casino or Valet Drop-Off Loop
  const overlappingProps = DEFAULT_ARENA_MAP_LAYOUT.props.filter((p) =>
    isInsideNorthGrandCasinoFootprint(p.x, p.z),
  );
  assert.equal(
    overlappingProps.length,
    0,
    `Expected 0 default map props inside Grand Casino footprint, found: ${JSON.stringify(overlappingProps)}`,
  );
});
