import type { StaticWorldStructureObb } from './buddiesBlitzTypes';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function sdSegment2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const pax = px - ax;
  const paz = pz - az;
  const bax = bx - ax;
  const baz = bz - az;
  const denom = bax * bax + baz * baz;
  const h = denom > 1e-8 ? clamp01((pax * bax + paz * baz) / denom) : 0;
  return Math.hypot(pax - bax * h, paz - baz * h);
}

function sdRoundedBox2D(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  r: number,
): number {
  const qx = Math.abs(px - cx) - hx + r;
  const qz = Math.abs(pz - cz) - hz + r;
  const outLen = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  const inMax = Math.min(Math.max(qx, qz), 0);
  return outLen + inMax - r;
}

/**
 * Architectural Masterplan for the Beaux-Arts / Second Empire Grand Casino
 * located in the North-of-Plaza District (`worldZ < -38.0`, `worldX < -60.0`),
 * calibrated to the 3.85m Buddy outdoor character scale ("bangunan besar ya").
 *
 * Positioned at `centerZ = -70.60` so:
 * - Both Valet Drop-Off Loop throats (`z = -63.25` & `z = -77.95`) connect
 *   exclusively to the straight `x = -60.0` Two-Lane Main Road (`dBaseWestOuter`)
 *   with >= 4.65m of lush green grass separating the South throat (`z = -60.55`
 *   outer asphalt edge) from the Autonomous City Tram Road (`z = -55.90` outer edge).
 * - Both Porte-Cochere outer column pedestals (`x = -68.85, z = -70.60 ± 2.72`)
 *   sit 100% inside the flat stone D-Shaped Median Island (`>= 0.75m` clear of asphalt).
 */
export const GRAND_CASINO_MASTERPLAN = {
  centerX: -88.8,
  centerZ: -70.6,
  // Overall footprint filter bounds for Map Editor default props
  lotFilterBounds: {
    minX: -104.0,
    maxX: -62.5,
    minZ: -102.5,
    maxZ: -38.4,
  },
  // Monumental Main Building Envelope (33.6m N-S width x 18.0m E-W depth)
  mainBuilding: {
    minX: -97.8,
    maxX: -79.8,
    minZ: -87.4,
    maxZ: -53.8,
    widthZ: 33.6,
    depthX: 18.0,
    // Projecting Central Foyer Pavilion on the East (front) & West (rear) elevations
    foyerEastMaxX: -78.4,
    foyerWestMinX: -98.7,
    foyerHalfZ: 7.2, // z in [-77.8, -63.4] (14.4m wide central bay)
    plinthHeightY: 0.64,
    groundStoryTopY: 6.55,
    entablatureTopY: 12.8,
    balustradeTopY: 13.95,
    mansardTopY: 17.55,
    domeFinialTopY: 23.25,
  },
  // Grand Covered Porte-Cochere projecting East over the Valet Drop-Off Lane onto the Median Island
  porteCochere: {
    minX: -78.4,
    maxX: -68.05,
    centerZ: -70.6,
    halfZ: 4.15, // 8.30m wide canopy (z in [-74.75, -66.45])
    valetClearanceY: 5.45, // Generous > 5.05m clearance above 3.85m Buddy character & vehicles
    entablatureTopY: 6.55,
    pedimentPeakY: 8.45,
    frontColumnX: -68.85,
    frontColumnOffsetZ: 2.72, // Pedestal centers at (-68.85, -73.32) and (-68.85, -67.88) inside Median Island
    pedestalHalfX: 0.65,
    pedestalHalfZ: 0.70,
  },
  // Semi-Circular / Rounded U-Shaped Valet Drop-Off Loop connected exclusively to x = -60.0 Main Road
  valetLoop: {
    boxCenterX: -64.05,
    boxCenterZ: -70.6,
    boxHalfX: 9.45, // West lane centerline at x = -73.5
    boxHalfZ: 7.35, // South throat at z = -63.25, North throat at z = -77.95
    cornerRadius: 5.2,
    laneHalfWidth: 2.7, // 5.40m wide two-car valet carriageway (x in [-76.2, -70.8])
    roadJoinX: -60.0,
    southThroatZ: -63.25,
    northThroatZ: -77.95,
    // Throat Zebra Crosswalks (stripes running East-West for N-S roadside pedestrians)
    throatCrosswalks: [
      { cx: -65.45, cz: -63.25, hx: 1.35, hz: 2.15 },
      { cx: -65.45, cz: -77.95, hx: 1.35, hz: 2.15 },
    ],
    // D-Shaped Landscaped Median Island between Valet Loop and x = -60.0 Main Road
    medianIsland: {
      minX: -70.8,
      maxX: -63.95,
      minZ: -75.25,
      maxZ: -65.95,
      topiaryX: -65.55,
      topiaryZs: [-73.55, -71.58, -69.62, -67.65] as readonly number[],
    },
  },
  // Wrap-Around Pedestrian Sidewalk, Curved South Plaza Connector & Curved North Hill Garden
  promenade: {
    perimeterMinX: -101.6,
    perimeterMaxX: -76.2,
    perimeterMinZ: -91.0,
    perimeterMaxZ: -50.2,
    // Curved South sidewalk linking Casino SE corner to Central Plaza NE sidewalk (-75.25, -38.2)
    // along the outer West side of the Tram Road without touching it
    southConnectorCenterX: -75.9,
    southConnectorCenterZ: -44.2,
    southConnectorHalfX: 2.15,
    southConnectorHalfZ: 6.2,
    // Curved North formal garden court tapering along the graded NW hill toe
    northGardenSegments: [
      { ax: -92.1, az: -90.8, bx: -83.6, bz: -97.6, radius: 5.8 },
      { ax: -83.6, az: -97.6, bx: -76.8, bz: -100.2, radius: 3.8 },
    ] as const,
  },
  // Bellhop Luggage Carts & Plaza Vintage Park Benches (bench-only, no flower pots) on Front Sidewalk
  luggageCarts: [
    { id: 'grand_casino_luggage_cart_s', x: -77.85, z: -61.8, yaw: 0.08 },
    { id: 'grand_casino_luggage_cart_n', x: -77.85, z: -79.4, yaw: -0.08 },
  ] as const,
  stagingBenches: [
    { id: 'grand_casino_staging_bench_s', x: -78.55, z: -56.6, rotY: Math.PI / 2 },
    { id: 'grand_casino_staging_bench_n', x: -78.55, z: -84.6, rotY: Math.PI / 2 },
  ] as const,
  // Street Lamps framing the Valet Loop, Sidewalks & Curved Gardens
  streetLamps: [
    { id: 'casino_lamp_se', x: -76.85, z: -53.2 },
    { id: 'casino_lamp_ne', x: -76.85, z: -88.0 },
    { id: 'casino_lamp_median_s', x: -65.15, z: -66.55 },
    { id: 'casino_lamp_median_n', x: -65.15, z: -74.65 },
    { id: 'casino_lamp_garden_n1', x: -76.8, z: -93.4 },
    { id: 'casino_lamp_garden_n2', x: -75.2, z: -99.2 },
  ] as const,
} as const;

/**
 * Smooth hill-toe grading term (`kaki bukit dirapikan`) subtracted from `d0` in
 * `evaluateEmbankmentTierOffsets` (synchronized between CPU TypeScript and GPU GLSL).
 * Recesses the West/NW terraced cliff toe behind the Grand Casino (`x ~ -108.5m`) across
 * `z in [-92 .. -48]` and tapers organically into the curved NE hill boundary (`z in [-92 .. -103]`),
 * while leaving `(-108, -40)` and `(-40, -122)` untouched (`0.0`).
 */
export function evaluateGrandCasinoHillClear(px: number, pz: number): number {
  return (
    smoothstep(-65.0, -94.5, px) *
    (19.5 - 8.5 * smoothstep(-104.5, -113.5, px)) *
    smoothstep(-41.5, -48.0, pz) *
    (1.0 - smoothstep(-99.5, -111.5, pz))
  );
}

/**
 * Exact C1-continuous Signed Distance to the Semi-Circular / U-Shaped Valet Drop-Off Loop
 * asphalt carriageway (`< 0` on asphalt). Joins the `x = -60.0` Two-Lane Main Road seamlessly
 * at `z = -63.25` and `z = -77.95` (strictly North of the `z = -52.0` Autonomous Tram Road!),
 * and fades cleanly to positive values East of `x = -60.0` so `evaluateRoadNetworkSdf`
 * N/S symmetry East of `x = -59.5` is 100% preserved.
 */
export function evaluateGrandCasinoValetLoopSdf(px: number, pz: number): number {
  if (px > -56.0 || pz > -56.5 || pz < -85.0) {
    return 999.0;
  }
  const clampedX = Math.min(px, -60.0);
  const eastFade = Math.max(0.0, px + 60.0) * 4.0;
  const boxSdf = sdRoundedBox2D(clampedX, pz, -64.05, -70.6, 9.45, 7.35, 5.2);
  return Math.abs(boxSdf) - 2.7 + eastFade;
}

/**
 * Signed distance (`< 0` inside) to all Grand Casino paved platforms, building envelope,
 * median curb island, flush Central Plaza connector, SE road-hugging sidewalk plaza,
 * and North curved garden court so `InfiniteGrass` blades never poke through stone pavers or steps.
 * Carefully keeps `(-66.5, -82.0)` (`> 7.5m` away) and the West Plaza-to-Casino green lawn
 * (`x < -76.58`, `z in [-50.2 .. -38.1]`) 100% lush green grass!
 */
export function evaluateGrandCasinoPavedPlatformSdf(px: number, pz: number): number {
  if (px > -62.5 || pz > -36.8 || pz < -105.5) {
    return 50.0;
  }
  // 1. Main Building + Wrap-Around North/South/West/East Sidewalks
  const dMainPerimeter = sdRoundedBox2D(px, pz, -88.9, -70.6, 12.75, 20.45, 0.8);
  // 2. D-Shaped Landscaped Median Curb Island & Porte-Cochere Outer Pier Apron
  const dMedianIsland = sdRoundedBox2D(px, pz, -67.4, -70.6, 3.45, 4.7, 2.45);
  // 3. Flush Central Plaza Connector + Full Road-Hugging SE Sidewalk Plaza
  //    (spans from West curb `x = -76.58` out to `dWest` `x = -73.85`, curved `dCornerW` `R = 11.85`,
  //    `dBaseWestOuter` `x = -63.85`, and South Valet Loop throat `z = -60.55 .. -68.60`)
  const westEdgeX = -76.58 - 0.87 * smoothstep(-46.8, -50.2, pz);
  const dTramClear =
    11.85 - Math.hypot(Math.min(px + 62.0, 0.0), Math.min(pz + 44.0, 0.0));
  const dSeSidewalk = Math.max(
    Math.max(westEdgeX - px, px + 63.85),
    Math.max(Math.max(pz + 37.5, -68.6 - pz), dTramClear),
  );
  // 4. Curved North Formal Garden Court tapering along the NW hillside
  const dNorthGarden1 = sdSegment2D(px, pz, -92.1, -90.8, -83.6, -97.6) - 5.8;
  const dNorthGarden2 = sdSegment2D(px, pz, -83.6, -97.6, -76.8, -100.2) - 3.8;

  return Math.min(
    Math.min(dMainPerimeter, dMedianIsland),
    Math.min(dSeSidewalk, Math.min(dNorthGarden1, dNorthGarden2)),
  );
}

/**
 * Returns true if `(worldX, worldZ)` lies inside either of the 2 painted Grand Casino
 * Valet Loop throat Zebra Crosswalks.
 */
export function isPointOnGrandCasinoCrosswalk(worldX: number, worldZ: number): boolean {
  for (const zc of GRAND_CASINO_MASTERPLAN.valetLoop.throatCrosswalks) {
    if (Math.abs(worldX - zc.cx) <= zc.hx && Math.abs(worldZ - zc.cz) <= zc.hz) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if a Map Editor prop at `(x, z)` overlaps the Grand Casino building,
 * Valet Drop-Off Loop, or formal promenade so default/saved props do not clip inside walls/lanes.
 */
export function isInsideNorthGrandCasinoFootprint(x: number, z: number): boolean {
  if (
    x < GRAND_CASINO_MASTERPLAN.lotFilterBounds.minX ||
    x > GRAND_CASINO_MASTERPLAN.lotFilterBounds.maxX ||
    z < GRAND_CASINO_MASTERPLAN.lotFilterBounds.minZ ||
    z > GRAND_CASINO_MASTERPLAN.lotFilterBounds.maxZ
  ) {
    return false;
  }
  if (evaluateGrandCasinoValetLoopSdf(x, z) <= 1.35) {
    return true;
  }
  if (evaluateGrandCasinoPavedPlatformSdf(x, z) <= 0.85) {
    return true;
  }
  return false;
}

/**
 * Emits accurate 3D OBB colliders for the Grand Casino main building, projecting foyer,
 * Porte-Cochere outer column pedestals, luggage carts, vintage benches, and street lamps,
 * while leaving the 5.40m x 5.45m Porte-Cochere Valet Drop-Off lane 100% open!
 */
export function getGrandCasinoObstacles(): StaticWorldStructureObb[] {
  const mb = GRAND_CASINO_MASTERPLAN.mainBuilding;
  const pc = GRAND_CASINO_MASTERPLAN.porteCochere;

  const obstacles: StaticWorldStructureObb[] = [
    // 1. Main Beaux-Arts Building Body (x in [-97.8, -79.8], z in [-87.4, -53.8])
    {
      id: 'grand_casino_main_body',
      x: (mb.minX + mb.maxX) * 0.5,
      z: GRAND_CASINO_MASTERPLAN.centerZ,
      halfX: (mb.maxX - mb.minX) * 0.5,
      halfZ: (mb.maxZ - mb.minZ) * 0.5,
      rotY: 0,
      heightY: mb.mansardTopY,
      mat: 'concrete',
    },
    // 2. Central Foyer Pavilion Projection (flanking the Grand Lobby Steps; x in [-79.8, -78.4])
    {
      id: 'grand_casino_foyer_pavilion',
      x: -79.1,
      z: GRAND_CASINO_MASTERPLAN.centerZ,
      halfX: 0.72,
      halfZ: mb.foyerHalfZ,
      rotY: 0,
      heightY: mb.mansardTopY,
      mat: 'concrete',
    },
    // 3. Rear West Central Pavilion Projection (x in [-98.7, -97.8])
    {
      id: 'grand_casino_rear_pavilion',
      x: -98.25,
      z: GRAND_CASINO_MASTERPLAN.centerZ,
      halfX: 0.48,
      halfZ: 6.4,
      rotY: 0,
      heightY: mb.entablatureTopY,
      mat: 'concrete',
    },
    // 4. Porte-Cochere Twin Clustered Corinthian Column Pedestals (squarely inside Median Island;
    //    leaves x in [-76.2, -70.8] Valet Drop-Off Lane 100% open underneath 5.45m canopy!)
    {
      id: 'grand_casino_portecochere_pier_n',
      x: pc.frontColumnX,
      z: pc.centerZ - pc.frontColumnOffsetZ,
      halfX: pc.pedestalHalfX,
      halfZ: pc.pedestalHalfZ,
      rotY: 0,
      heightY: pc.entablatureTopY,
      mat: 'concrete',
    },
    {
      id: 'grand_casino_portecochere_pier_s',
      x: pc.frontColumnX,
      z: pc.centerZ + pc.frontColumnOffsetZ,
      halfX: pc.pedestalHalfX,
      halfZ: pc.pedestalHalfZ,
      rotY: 0,
      heightY: pc.entablatureTopY,
      mat: 'concrete',
    },
    // 5. Brass Birdcage Bellhop Luggage Carts & Central Plaza Vintage Park Benches on Front Sidewalk
    ...GRAND_CASINO_MASTERPLAN.luggageCarts.map((cart) => ({
      id: cart.id,
      x: cart.x,
      z: cart.z,
      halfX: 0.48,
      halfZ: 0.78,
      rotY: cart.yaw,
      heightY: 2.48,
      mat: 'metal' as const,
    })),
    ...GRAND_CASINO_MASTERPLAN.stagingBenches.map((bench) => ({
      id: bench.id,
      x: bench.x,
      z: bench.z,
      halfX: 0.52,
      halfZ: 1.62,
      rotY: 0,
      heightY: 1.75,
      mat: 'wood' as const,
    })),
    // 6. Curved North Garden Ornamental Fountain / Urn Plinth
    {
      id: 'grand_casino_north_garden_urn',
      x: -85.4,
      z: -95.6,
      halfX: 1.35,
      halfZ: 1.35,
      rotY: 0,
      heightY: 3.1,
      mat: 'concrete',
    },
  ];

  for (const lamp of GRAND_CASINO_MASTERPLAN.streetLamps) {
    obstacles.push({
      id: lamp.id,
      x: lamp.x,
      z: lamp.z,
      halfX: 0.28,
      halfZ: 0.28,
      rotY: 0,
      heightY: 5.05,
      mat: 'metal',
    });
  }

  return obstacles;
}
