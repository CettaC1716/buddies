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
 * World-space trigger & compact 3D interaction triangle ("segitiga interaksi")
 * anchored directly in front of the Grand Casino red-carpeted granite steps
 * under the Porte-Cochere entrance (x = -76.18, z = -70.60).
 */
export const GRAND_CASINO_DOOR_TRIGGER = {
  x: -76.18,
  z: GRAND_CASINO_MASTERPLAN.centerZ,
  deckY: 0.09,
  markerOffsetY: 0.48,
  triggerRadius: 3.35,
} as const;

export function evaluateGrandCasinoDoorProximity(
  actorX: number,
  actorZ: number,
  worldMode: string,
  npcCameraMode: string,
  radius: number = GRAND_CASINO_DOOR_TRIGGER.triggerRadius,
): { isNear: boolean; distanceM: number } {
  const distanceM = Math.hypot(
    actorX - GRAND_CASINO_DOOR_TRIGGER.x,
    actorZ - GRAND_CASINO_DOOR_TRIGGER.z,
  );
  const isValidMode = worldMode !== 'warzone' && npcCameraMode === 'none';
  return {
    isNear: isValidMode && distanceM <= radius,
    distanceM,
  };
}

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

const GRAND_CASINO_SIDEWALK_POLYGON: ReadonlyArray<readonly [number, number]> = (() => {
  const cz = GRAND_CASINO_MASTERPLAN.centerZ;
  const vl = GRAND_CASINO_MASTERPLAN.valetLoop;
  const innerCurbX = vl.boxCenterX - vl.boxHalfX - vl.laneHalfWidth; // -76.20
  const valetArcCx = vl.boxCenterX - vl.boxHalfX + vl.cornerRadius; // -68.30
  const valetArcSouthCz = cz + vl.boxHalfZ - vl.cornerRadius; // -68.45
  const valetOuterCurbR = vl.cornerRadius + vl.laneHalfWidth + 0.01; // 7.91

  const pts: Array<readonly [number, number]> = [
    [-73.93, -38.10],
    [-73.93, -44.00],
  ];
  const tramArcTheta0 = Math.PI;
  const tramArcTheta1 = Math.acos(-1.93 / 11.93);
  for (let s = 1; s <= 14; s++) {
    const th = tramArcTheta0 + (s / 14) * (tramArcTheta1 - tramArcTheta0);
    pts.push([-62.0 + Math.cos(th) * 11.93, -44.0 - Math.sin(th) * 11.93]);
  }
  pts.push([-63.93, -60.56]);
  for (let s = 0; s <= 12; s++) {
    const ang = Math.PI * 0.5 + (s / 12) * (Math.PI * 0.5);
    pts.push([
      valetArcCx + Math.cos(ang) * valetOuterCurbR,
      valetArcSouthCz + Math.sin(ang) * valetOuterCurbR,
    ]);
  }
  pts.push(
    [innerCurbX, -87.20],
    [-75.05, -90.60],
    [-74.85, -95.20],
    [-76.50, -100.20],
    [-80.40, -101.40],
    [-87.20, -98.80],
    [-94.80, -94.80],
    [-101.55, -90.80],
    [-101.55, -50.20],
    [-77.45, -50.20],
    [-76.58, -46.80],
    [-76.58, -38.10],
  );
  return pts;
})();

function pointInCasinoSidewalkPolygon(px: number, pz: number): boolean {
  let inside = false;
  const poly = GRAND_CASINO_SIDEWALK_POLYGON;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const zi = poly[i][1];
    const xj = poly[j][0];
    const zj = poly[j][1];
    const intersect =
      zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Evaluates exact walkable ground elevation across the Grand Casino District:
 * - `+0.14m` on the D-shaped Landscaped Median Island
 * - `+0.09m` on the continuous Urban Sidewalk & North Garden slab (`mainSidewalkSlabGeo`)
 * - `+0.022m` on the Porte-Cochere Fan-Pattern Cobblestone Valet Apron
 * - `0.0m` on the Valet Loop asphalt road & surrounding lawns
 */
export function evaluateGrandCasinoSidewalkElevation(px: number, pz: number): number {
  if (px > -63.5 || px < -101.65 || pz > -38.05 || pz < -101.5) {
    return 0.0;
  }
  const vl = GRAND_CASINO_MASTERPLAN.valetLoop;
  const cz = GRAND_CASINO_MASTERPLAN.centerZ;
  const arcCx = vl.boxCenterX - vl.boxHalfX + vl.cornerRadius; // -68.30
  const arcSouthCz = cz + vl.boxHalfZ - vl.cornerRadius; // -68.45
  const arcNorthCz = cz - vl.boxHalfZ + vl.cornerRadius; // -72.75
  const islandArcRad = vl.cornerRadius - vl.laneHalfWidth - 0.10; // 2.40

  // 1. D-Shaped Landscaped Median Island (yTop = +0.14m)
  if (
    px <= -64.05 &&
    pz >= arcNorthCz - islandArcRad &&
    pz <= arcSouthCz + islandArcRad
  ) {
    if (px >= arcCx) {
      return 0.14;
    }
    const clampedZ = Math.max(arcNorthCz, Math.min(arcSouthCz, pz));
    if (Math.hypot(px - arcCx, pz - clampedZ) <= islandArcRad + 0.02) {
      return 0.14;
    }
  }

  // 2. Continuous Grand Casino Pedestrian Sidewalk & North Garden (yTop = +0.09m)
  if (pointInCasinoSidewalkPolygon(px, pz)) {
    return 0.09;
  }

  // 3. Porte-Cochere Cobblestone Valet Drop-Off Apron (yTop = +0.022m)
  const innerCurbX = vl.boxCenterX - vl.boxHalfX - vl.laneHalfWidth; // -76.20
  const outerIslandWestX = vl.boxCenterX - vl.boxHalfX + vl.laneHalfWidth; // -70.80
  const cobbleHalfZ = GRAND_CASINO_MASTERPLAN.porteCochere.halfZ + 0.35; // 4.50
  if (
    px >= innerCurbX &&
    px <= outerIslandWestX &&
    pz >= cz - cobbleHalfZ &&
    pz <= cz + cobbleHalfZ
  ) {
    return 0.022;
  }

  return 0.0;
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

// =============================================================================
// GRAND CASINO LUXURY SINGLE-STORY INTERIOR (1:1 Reference Blueprints)
// =============================================================================

export const CASINO_ORIGIN_Y = 285.0;

export const CASINO_INTERIOR_BOUNDS = {
  minX: -9.85,
  maxX: 9.85,
  minZ: -6.85,
  maxZ: 6.85,
  // Player spawns right inside the Grand Mahogany Double Entrance/Exit Door (North Wall, rear-left bay)
  spawnX: -2.85,
  spawnZ: -5.25,
  spawnYaw: -Math.PI * 0.5, // Facing South (+Z) into the luxury hall
  exitDoorX: -2.85,
  exitDoorZ: -6.28,
  ceilingHeightY: 5.25,
} as const;

export type CasinoStationInteractionKind =
  | 'exit_door'
  | 'roulette_table'
  | 'blackjack_table'
  | 'slot_machine'
  | 'cashier_cage'
  | 'luxury_bar';

export interface CasinoInteriorObbCollider {
  id: string;
  x: number;
  z: number;
  hw: number;
  hd: number;
  ry: number;
}

export interface CasinoInteriorSeatSpot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  seatLiftY: number;
  indicatorHeightY: number;
  chairKind: 'slot_stool' | 'table_armchair' | 'roulette_stool';
}

export interface CasinoSlotMachinePlacement {
  id: string;
  x: number;
  z: number;
  rotY: number; // +Y rotation where local +Z is machine front
  stoolOffsetZ: number;
}

/**
 * All 20 Electronic Slot Machines matching screen_07df789a.png:
 * - Far-Left Wall Bank (4 facing +X into hall)
 * - Center-Left Double-Sided Island Bank (4 facing -X, 4 facing +X)
 * - Rear-Center Back Bank beside Cashier (4 facing +Z into hall)
 * - Far-Right Wall Bank (4 facing -X into hall)
 */
export const CASINO_SLOT_PLACEMENTS: ReadonlyArray<CasinoSlotMachinePlacement> = [
  // Far-Left Wall Bank (x = -9.18, facing +X -> rotY = +PI/2)
  { id: 'slot_w1', x: -9.18, z: -1.15, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_w2', x: -9.18, z: -0.35, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_w3', x: -9.18, z: 0.45, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_w4', x: -9.18, z: 1.25, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },

  // Center-Left 2-Sided Island Bank — West Side (x = -5.85, facing -X -> rotY = -PI/2)
  { id: 'slot_il1', x: -5.85, z: 0.55, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_il2', x: -5.85, z: 1.35, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_il3', x: -5.85, z: 2.15, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_il4', x: -5.85, z: 2.95, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },

  // Center-Left 2-Sided Island Bank — East Side (x = -5.25, facing +X -> rotY = +PI/2)
  { id: 'slot_ir1', x: -5.25, z: 0.55, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_ir2', x: -5.25, z: 1.35, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_ir3', x: -5.25, z: 2.15, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_ir4', x: -5.25, z: 2.95, rotY: Math.PI * 0.5, stoolOffsetZ: 0.78 },

  // Rear-Center Back Bank (z = -6.05, facing +Z -> rotY = 0)
  { id: 'slot_n1', x: -0.25, z: -6.05, rotY: 0, stoolOffsetZ: 0.78 },
  { id: 'slot_n2', x: 0.55, z: -6.05, rotY: 0, stoolOffsetZ: 0.78 },
  { id: 'slot_n3', x: 1.35, z: -6.05, rotY: 0, stoolOffsetZ: 0.78 },
  { id: 'slot_n4', x: 2.15, z: -6.05, rotY: 0, stoolOffsetZ: 0.78 },

  // Far-Right Wall Bank (x = +9.18, facing -X -> rotY = -PI/2)
  { id: 'slot_e1', x: 9.18, z: 0.25, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_e2', x: 9.18, z: 1.05, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_e3', x: 9.18, z: 1.85, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },
  { id: 'slot_e4', x: 9.18, z: 2.65, rotY: -Math.PI * 0.5, stoolOffsetZ: 0.78 },
] as const;

export const CASINO_BLACKJACK_TABLES = [
  { id: 'blackjack_center_mid', x: -0.35, z: -0.45, rotY: 0.04 },
  { id: 'blackjack_mid_right', x: 3.55, z: -0.75, rotY: -0.18 },
  { id: 'blackjack_east_salon', x: 5.55, z: 2.55, rotY: -0.48 },
] as const;

export const CASINO_ROULETTE_TABLE = {
  id: 'roulette_grand_center',
  x: 0.35,
  z: 3.65,
  rotY: 0.0,
} as const;

export const CASINO_CASHIER_BOOTH = {
  id: 'cashier_cage_booth',
  x: -6.55,
  z: -4.95,
  rotY: 0.0,
  queueRopeZ: -3.05,
} as const;

export const CASINO_LUXURY_BAR = {
  id: 'luxury_bar_counter',
  x: 6.15,
  z: -5.25,
  rotY: 0.0,
} as const;

export interface CasinoStaffNpcPlacement {
  id: string;
  role: 'cashier' | 'bartender' | 'blackjack_dealer' | 'roulette_croupier';
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/**
 * 3D Animated Female Plaza NPC Staff Placements inside the Grand Casino Hall:
 * - 1 Cashier Cage Teller
 * - 1 Luxury Bar Bartender
 * - 3 Blackjack / Baccarat Table Dealers
 * - 1 Grand Roulette Table Croupier
 */
export const CASINO_STAFF_NPC_PLACEMENTS: ReadonlyArray<CasinoStaffNpcPlacement> = [
  {
    id: 'casino_staff_cashier',
    role: 'cashier',
    x: CASINO_CASHIER_BOOTH.x,
    y: 0.04,
    z: Number((CASINO_CASHIER_BOOTH.z + 0.16).toFixed(3)),
    rotY: CASINO_CASHIER_BOOTH.rotY,
  },
  {
    id: 'casino_staff_bartender',
    role: 'bartender',
    x: CASINO_LUXURY_BAR.x,
    y: 0.0,
    z: Number((CASINO_LUXURY_BAR.z + 0.02).toFixed(3)),
    rotY: CASINO_LUXURY_BAR.rotY,
  },
  ...CASINO_BLACKJACK_TABLES.map((tbl, idx): CasinoStaffNpcPlacement => {
    const dealerLocalZ = -0.8;
    return {
      id: `casino_staff_blackjack_${idx}`,
      role: 'blackjack_dealer',
      x: Number((tbl.x + Math.sin(tbl.rotY) * dealerLocalZ).toFixed(3)),
      y: 0.0,
      z: Number((tbl.z + Math.cos(tbl.rotY) * dealerLocalZ).toFixed(3)),
      rotY: tbl.rotY,
    };
  }),
  {
    id: 'casino_staff_roulette',
    role: 'roulette_croupier',
    x: Number((CASINO_ROULETTE_TABLE.x - 0.15).toFixed(3)),
    y: 0.0,
    z: Number((CASINO_ROULETTE_TABLE.z - 0.94).toFixed(3)),
    rotY: CASINO_ROULETTE_TABLE.rotY,
  },
];

/**
 * Interactive 3D Marker Coordinates inside the Luxury Single-Story Grand Casino Hall.
 */
export const CASINO_STATION_TARGETS = {
  exitDoor: { x: CASINO_INTERIOR_BOUNDS.exitDoorX, markerY: 0.65, z: CASINO_INTERIOR_BOUNDS.exitDoorZ },
  cashierCage: { x: CASINO_CASHIER_BOOTH.x, markerY: 2.38, z: -3.55, interactX: CASINO_CASHIER_BOOTH.x, interactZ: -2.35 },
  luxuryBar: { x: CASINO_LUXURY_BAR.x, markerY: 1.82, z: -4.05, interactX: CASINO_LUXURY_BAR.x, interactZ: -3.15 },
  rouletteTable: { x: CASINO_ROULETTE_TABLE.x, markerY: 1.98, z: CASINO_ROULETTE_TABLE.z },
  blackjackCenter: { x: CASINO_BLACKJACK_TABLES[0].x, markerY: 1.92, z: CASINO_BLACKJACK_TABLES[0].z },
  blackjackMidRight: { x: CASINO_BLACKJACK_TABLES[1].x, markerY: 1.92, z: CASINO_BLACKJACK_TABLES[1].z },
  blackjackEastSalon: { x: CASINO_BLACKJACK_TABLES[2].x, markerY: 1.92, z: CASINO_BLACKJACK_TABLES[2].z },
  slotWestBank: { x: -9.15, markerY: 2.18, z: 0.05, interactX: -7.70, interactZ: 0.05 },
  slotIslandBank: { x: -5.55, markerY: 2.18, z: 1.75, interactX: -4.10, interactZ: 1.75 },
  slotNorthBank: { x: 0.95, markerY: 2.18, z: -6.05, interactX: 0.95, interactZ: -4.75 },
  slotEastBank: { x: 9.15, markerY: 2.18, z: 1.45, interactX: 7.70, interactZ: 1.45 },
} as const;

function buildSlotStoolSpot(s: CasinoSlotMachinePlacement): CasinoInteriorSeatSpot {
  const sinR = Math.sin(s.rotY);
  const cosR = Math.cos(s.rotY);
  const sx = s.x + sinR * s.stoolOffsetZ;
  const sz = s.z + cosR * s.stoolOffsetZ;
  // Buddy avatar fwd = (cos yaw, -sin yaw). To face machine from stool (+localZ -> -localZ):
  // desired fwd = (-sinR, -cosR) -> cos(yaw) = -sinR, sin(yaw) = cosR -> yaw = PI/2 + rotY
  const yaw = Math.PI * 0.5 + s.rotY;
  return {
    id: `seat_${s.id}`,
    x: Number(sx.toFixed(3)),
    z: Number(sz.toFixed(3)),
    yaw,
    seatLiftY: 0.25,
    indicatorHeightY: 0.82,
    chairKind: 'slot_stool',
  };
}

function buildBlackjackChairSpots(): CasinoInteriorSeatSpot[] {
  const spots: CasinoInteriorSeatSpot[] = [];
  const arcAngles = [-0.72, 0.0, 0.72]; // 3 plush armchairs along player D-arc
  for (const tbl of CASINO_BLACKJACK_TABLES) {
    const cosT = Math.cos(tbl.rotY);
    const sinT = Math.sin(tbl.rotY);
    arcAngles.forEach((a, idx) => {
      // Local chair offset around D-arc bolster center (0, -0.24) at R = 1.58m so avatars never clip table
      const lx = Math.sin(a) * 1.58;
      const lz = -0.24 + Math.cos(a) * 1.58;
      const wx = tbl.x + lx * cosT + lz * sinT;
      const wz = tbl.z - lx * sinT + lz * cosT;
      // Face inward toward dealer at (tbl.x, tbl.z)
      const dx = tbl.x - wx;
      const dz = tbl.z - wz;
      const yaw = Math.atan2(-dz, dx);
      spots.push({
        id: `seat_${tbl.id}_${idx + 1}`,
        x: Number(wx.toFixed(3)),
        z: Number(wz.toFixed(3)),
        yaw,
        seatLiftY: 0.21,
        indicatorHeightY: 0.76,
        chairKind: 'table_armchair',
      });
    });
  }
  return spots;
}

function buildRouletteChairSpots(): CasinoInteriorSeatSpot[] {
  const tbl = CASINO_ROULETTE_TABLE;
  const cosT = Math.cos(tbl.rotY);
  const sinT = Math.sin(tbl.rotY);
  const localXs = [-0.78, -0.25, 0.28];
  const lz = 1.04;
  return localXs.map((lx, idx) => {
    const wx = tbl.x + lx * cosT + lz * sinT;
    const wz = tbl.z - lx * sinT + lz * cosT;
    return {
      id: `seat_${tbl.id}_${idx + 1}`,
      x: Number(wx.toFixed(3)),
      z: Number(wz.toFixed(3)),
      yaw: Math.PI * 0.5 + tbl.rotY,
      seatLiftY: 0.23,
      indicatorHeightY: 0.78,
      chairKind: 'roulette_stool',
    };
  });
}

export const CASINO_INTERIOR_SEAT_SPOTS: ReadonlyArray<CasinoInteriorSeatSpot> = [
  ...CASINO_SLOT_PLACEMENTS.map(buildSlotStoolSpot),
  ...buildBlackjackChairSpots(),
  ...buildRouletteChairSpots(),
];

/**
 * Physical OBB colliders for every architectural enclosure, cashier cage, bar counter,
 * roulette table, blackjack table, slot cabinet, and seat pedestal inside the hall.
 */
export const CASINO_INTERIOR_COLLIDERS: ReadonlyArray<CasinoInteriorObbCollider> = [
  // Cashier Cage & Chip Exchange Booth + Stanchion Queue Barrier (North-West Corner)
  { id: 'casino_cashier_booth', x: CASINO_CASHIER_BOOTH.x, z: CASINO_CASHIER_BOOTH.z, hw: 1.85, hd: 1.38, ry: 0 },
  { id: 'casino_cashier_ropes', x: CASINO_CASHIER_BOOTH.x, z: -2.98, hw: 1.75, hd: 0.22, ry: 0 },
  // Luxury Curved Bar Counter & Back-Bar Display (North-East Corner)
  { id: 'casino_luxury_backbar', x: CASINO_LUXURY_BAR.x, z: -6.32, hw: 2.05, hd: 0.48, ry: 0 },
  { id: 'casino_luxury_bar_front', x: CASINO_LUXURY_BAR.x, z: -4.22, hw: 1.98, hd: 0.45, ry: 0 },
  { id: 'casino_luxury_bar_wings', x: CASINO_LUXURY_BAR.x, z: -4.95, hw: 1.98, hd: 0.90, ry: 0 },
  // Center-Left 2-Sided Slot Island Housing Spine + Endcaps
  { id: 'casino_slot_island_core', x: -5.55, z: 1.75, hw: 0.56, hd: 1.62, ry: 0 },
  // West, North & East Wall Slot Banks (unified bank OBBs for butter-smooth wall sliding)
  { id: 'casino_slot_bank_west', x: -9.18, z: 0.05, hw: 0.34, hd: 1.62, ry: 0 },
  { id: 'casino_slot_bank_north', x: 0.95, z: -6.05, hw: 1.58, hd: 0.34, ry: 0 },
  { id: 'casino_slot_bank_east', x: 9.18, z: 1.45, hw: 0.34, hd: 1.62, ry: 0 },
  // Grand Roulette Table & Mahogany Turret
  { id: 'casino_roulette_table', x: CASINO_ROULETTE_TABLE.x, z: CASINO_ROULETTE_TABLE.z, hw: 1.42, hd: 0.72, ry: CASINO_ROULETTE_TABLE.rotY },
  // Three Blackjack & Baccarat Tables
  ...CASINO_BLACKJACK_TABLES.map((t) => ({
    id: `casino_${t.id}`,
    x: t.x,
    z: t.z,
    hw: 1.24,
    hd: 0.66,
    ry: t.rotY,
  })),
  // Individual Seat Colliders (automatically bypassed while seated)
  ...CASINO_INTERIOR_SEAT_SPOTS.map((seat) => ({
    id: `casino_chair_${seat.id}`,
    x: seat.x,
    z: seat.z,
    hw: 0.25,
    hd: 0.25,
    ry: 0,
  })),
];

export const CASINO_SEAT_PROXIMITY_RADIUS = 1.65;
export const CASINO_CHAIR_STAND_UP_STEP_M = 0.66;

export function clampCasinoInteriorPosition(
  rawX: number,
  rawZ: number,
  wallMargin = 0.42,
): { x: number; z: number } {
  return {
    x: Math.max(
      CASINO_INTERIOR_BOUNDS.minX + wallMargin,
      Math.min(CASINO_INTERIOR_BOUNDS.maxX - wallMargin, rawX),
    ),
    z: Math.max(
      CASINO_INTERIOR_BOUNDS.minZ + wallMargin,
      Math.min(CASINO_INTERIOR_BOUNDS.maxZ - wallMargin, rawZ),
    ),
  };
}

export function computeCasinoSeatStandUpPosition(
  spot: CasinoInteriorSeatSpot,
  moveDirX = 0,
  moveDirZ = 0,
): { x: number; z: number } {
  const tableDirX = Math.cos(spot.yaw);
  const tableDirZ = -Math.sin(spot.yaw);
  const aisleDirX = -tableDirX;
  const aisleDirZ = -tableDirZ;

  const inputLen = Math.hypot(moveDirX, moveDirZ);
  let dirX = aisleDirX;
  let dirZ = aisleDirZ;

  if (inputLen > 0.01) {
    const nx = moveDirX / inputLen;
    const nz = moveDirZ / inputLen;
    const aisleDot = nx * aisleDirX + nz * aisleDirZ;
    if (aisleDot >= 0.42) {
      dirX = nx;
      dirZ = nz;
    } else {
      const latAxisX = -tableDirZ;
      const latAxisZ = tableDirX;
      const latProj = nx * latAxisX + nz * latAxisZ;
      if (Math.abs(latProj) > 0.2) {
        const latSign = latProj >= 0 ? 1 : -1;
        const rawX = aisleDirX * 0.58 + latAxisX * latSign * 0.815;
        const rawZ = aisleDirZ * 0.58 + latAxisZ * latSign * 0.815;
        const rawLen = Math.hypot(rawX, rawZ) || 1;
        dirX = rawX / rawLen;
        dirZ = rawZ / rawLen;
      }
    }
  }

  return clampCasinoInteriorPosition(
    spot.x + dirX * CASINO_CHAIR_STAND_UP_STEP_M,
    spot.z + dirZ * CASINO_CHAIR_STAND_UP_STEP_M,
  );
}

function distanceToCasinoAabb2d(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  hw: number,
  hd: number,
): number {
  const dx = Math.max(0, Math.abs(px - cx) - hw);
  const dz = Math.max(0, Math.abs(pz - cz) - hd);
  return Math.hypot(dx, dz);
}

export function getCasinoGameKindForSeat(
  chairKind: CasinoInteriorSeatSpot['chairKind'],
): 'slot_machine' | 'blackjack_table' | 'roulette_table' {
  if (chairKind === 'slot_stool') return 'slot_machine';
  if (chairKind === 'roulette_stool') return 'roulette_table';
  return 'blackjack_table';
}

export type CasinoSlotGameVariant =
  | 'lucky_draw'
  | 'classic_reels'
  | 'multi_line_3x3'
  | 'fortune_wheel';

export interface CasinoSlotCabinetTheme {
  coreBodyHex: string;
  sideCheekHex: string;
  neonTrimHex: string;
  neonEmissiveHex: string;
  frameHex: string;
  frameEmissiveHex: string;
  deckBolsterHex: string;
  deckEmissiveHex: string;
  underGlowHex: string;
  leverGripHex: string;
}

export const CASINO_SLOT_CABINET_THEMES: Record<CasinoSlotGameVariant, CasinoSlotCabinetTheme> = {
  lucky_draw: {
    coreBodyHex: '#2e293d',
    sideCheekHex: '#353145',
    neonTrimHex: '#e879f9',
    neonEmissiveHex: '#c084fc',
    frameHex: '#4c1d95',
    frameEmissiveHex: '#9333ea',
    deckBolsterHex: '#9d4edd',
    deckEmissiveHex: '#7e22ce',
    underGlowHex: '#e879f9',
    leverGripHex: '#a21caf',
  },
  classic_reels: {
    coreBodyHex: '#3a2229',
    sideCheekHex: '#442831',
    neonTrimHex: '#fb7185',
    neonEmissiveHex: '#f43f5e',
    frameHex: '#881337',
    frameEmissiveHex: '#e11d48',
    deckBolsterHex: '#be123c',
    deckEmissiveHex: '#9f1239',
    underGlowHex: '#fb7185',
    leverGripHex: '#dc2626',
  },
  multi_line_3x3: {
    coreBodyHex: '#1d2d3d',
    sideCheekHex: '#24364a',
    neonTrimHex: '#38bdf8',
    neonEmissiveHex: '#0ea5e9',
    frameHex: '#075985',
    frameEmissiveHex: '#0284c7',
    deckBolsterHex: '#0369a1',
    deckEmissiveHex: '#075985',
    underGlowHex: '#38bdf8',
    leverGripHex: '#0284c7',
  },
  fortune_wheel: {
    coreBodyHex: '#1b312a',
    sideCheekHex: '#223d35',
    neonTrimHex: '#34d399',
    neonEmissiveHex: '#10b981',
    frameHex: '#065f46',
    frameEmissiveHex: '#059669',
    deckBolsterHex: '#047857',
    deckEmissiveHex: '#065f46',
    underGlowHex: '#34d399',
    leverGripHex: '#059669',
  },
};

export const CASINO_SLOT_VARIANT_META: Record<
  CasinoSlotGameVariant,
  {
    id: CasinoSlotGameVariant;
    title: string;
    subtitle: string;
    promptLabel: string;
    accentHex: string;
    badgeBgHex: string;
    bankLabel: string;
  }
> = {
  lucky_draw: {
    id: 'lucky_draw',
    title: 'LUCKY DRAW 777',
    subtitle: '4x4 CHASE GRID & x777 JACKPOT VAULT',
    promptLabel: 'PLAY LUCKY DRAW',
    accentHex: '#e879f9',
    badgeBgHex: '#e879f9',
    bankLabel: 'VIOLET WEST BANK',
  },
  classic_reels: {
    id: 'classic_reels',
    title: 'RUBY 777 REELS',
    subtitle: 'CLASSIC 3-REEL CASINO SLOTS',
    promptLabel: 'PLAY 777 REELS',
    accentHex: '#fb7185',
    badgeBgHex: '#fb7185',
    bankLabel: 'CRIMSON ISLAND BANK',
  },
  multi_line_3x3: {
    id: 'multi_line_3x3',
    title: 'GRAND ROYALE 50-LINE',
    subtitle: '3x4 REELS · ROYAL WILD & SCATTER FREE SPINS',
    promptLabel: 'PLAY GRAND ROYALE',
    accentHex: '#38bdf8',
    badgeBgHex: '#38bdf8',
    bankLabel: 'SAPPHIRE NORTH BANK',
  },
  fortune_wheel: {
    id: 'fortune_wheel',
    title: 'EMERALD FORTUNE SPIN',
    subtitle: 'WEIGHTED PRIZE WHEEL UP TO 50x',
    promptLabel: 'SPIN FORTUNE WHEEL',
    accentHex: '#34d399',
    badgeBgHex: '#34d399',
    bankLabel: 'EMERALD EAST BANK',
  },
};

export function getCasinoSlotGameVariantForPlacementId(
  placementId: string,
): CasinoSlotGameVariant {
  const clean = placementId.replace(/^seat_/, '');
  if (clean.startsWith('slot_w')) return 'lucky_draw';
  if (clean.startsWith('slot_il') || clean.startsWith('slot_ir')) return 'classic_reels';
  if (clean.startsWith('slot_n')) return 'multi_line_3x3';
  if (clean.startsWith('slot_e')) return 'fortune_wheel';
  return 'lucky_draw';
}

export function getCasinoSlotGameVariantForSeatId(seatId: string): CasinoSlotGameVariant {
  return getCasinoSlotGameVariantForPlacementId(seatId);
}

export function getCasinoSlotCabinetTheme(
  variant: CasinoSlotGameVariant,
): CasinoSlotCabinetTheme {
  return CASINO_SLOT_CABINET_THEMES[variant];
}

export function detectNearestCasinoStation(
  px: number,
  pz: number,
  includeGames = false,
): { kind: CasinoStationInteractionKind | null; dist: number } {
  const candidates: Array<{
    kind: CasinoStationInteractionKind;
    dist: number;
    maxDist: number;
  }> = [
    {
      kind: 'exit_door',
      dist: distanceToCasinoAabb2d(
        px,
        pz,
        CASINO_STATION_TARGETS.exitDoor.x,
        CASINO_STATION_TARGETS.exitDoor.z,
        0.75,
        0.45,
      ),
      maxDist: 1.55,
    },
    {
      kind: 'cashier_cage',
      dist: distanceToCasinoAabb2d(
        px,
        pz,
        CASINO_CASHIER_BOOTH.x,
        CASINO_CASHIER_BOOTH.z + 1.0,
        1.95,
        1.15,
      ),
      maxDist: 1.85,
    },
    {
      kind: 'luxury_bar',
      dist: distanceToCasinoAabb2d(
        px,
        pz,
        CASINO_LUXURY_BAR.x,
        CASINO_LUXURY_BAR.z + 0.55,
        2.05,
        0.95,
      ),
      maxDist: 1.85,
    },
    ...(includeGames
      ? [
          {
            kind: 'roulette_table' as const,
            dist: distanceToCasinoAabb2d(
              px,
              pz,
              CASINO_ROULETTE_TABLE.x,
              CASINO_ROULETTE_TABLE.z,
              1.48,
              0.78,
            ),
            maxDist: 1.65,
          },
          ...CASINO_BLACKJACK_TABLES.map((t) => ({
            kind: 'blackjack_table' as const,
            dist: distanceToCasinoAabb2d(px, pz, t.x, t.z, 1.32, 0.85),
            maxDist: 1.65,
          })),
          {
            kind: 'slot_machine' as const,
            dist: distanceToCasinoAabb2d(px, pz, -9.18, 0.05, 0.45, 1.75),
            maxDist: 1.55,
          },
          {
            kind: 'slot_machine' as const,
            dist: distanceToCasinoAabb2d(px, pz, -5.55, 1.75, 0.65, 1.75),
            maxDist: 1.55,
          },
          {
            kind: 'slot_machine' as const,
            dist: distanceToCasinoAabb2d(px, pz, 0.95, -6.05, 1.70, 0.45),
            maxDist: 1.55,
          },
          {
            kind: 'slot_machine' as const,
            dist: distanceToCasinoAabb2d(px, pz, 9.18, 1.45, 0.45, 1.75),
            maxDist: 1.55,
          },
        ]
      : []),
  ];

  let bestKind: CasinoStationInteractionKind | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.dist <= c.maxDist && c.dist < bestDist) {
      bestKind = c.kind;
      bestDist = c.dist;
    }
  }
  return { kind: bestKind, dist: bestDist };
}

export interface CasinoNearestPromptOrSeatResult {
  target: 'none' | 'station' | 'seat';
  stationKind: CasinoStationInteractionKind | null;
  seatIndex: number;
  seatSpot: CasinoInteriorSeatSpot | null;
  objectDistance: number;
}

/**
 * Resolves the highest-priority interactive prompt inside the Grand Casino Hall:
 * standing players can only interact with service stations (`exit_door`, `cashier_cage`,
 * `luxury_bar`) or `SIT` on chairs/stools (`includeGames = false`); casino games require sitting.
 */
export function resolveNearestCasinoPromptOrSeat(
  px: number,
  pz: number,
  includeGames = false,
): CasinoNearestPromptOrSeatResult {
  const station = detectNearestCasinoStation(px, pz, includeGames);

  let bestSeatIdx = -1;
  let bestSeatObjectDist = Infinity;
  for (let i = 0; i < CASINO_INTERIOR_SEAT_SPOTS.length; i++) {
    const spot = CASINO_INTERIOR_SEAT_SPOTS[i];
    const centerDist = Math.hypot(px - spot.x, pz - spot.z);
    if (centerDist <= CASINO_SEAT_PROXIMITY_RADIUS) {
      const objDist = distanceToCasinoAabb2d(px, pz, spot.x, spot.z, 0.25, 0.25);
      if (objDist < bestSeatObjectDist) {
        bestSeatObjectDist = objDist;
        bestSeatIdx = i;
      }
    }
  }

  if (station.kind !== null && bestSeatIdx !== -1) {
    if (bestSeatObjectDist + 0.12 < station.dist) {
      return {
        target: 'seat',
        stationKind: null,
        seatIndex: bestSeatIdx,
        seatSpot: CASINO_INTERIOR_SEAT_SPOTS[bestSeatIdx],
        objectDistance: bestSeatObjectDist,
      };
    }
    return {
      target: 'station',
      stationKind: station.kind,
      seatIndex: -1,
      seatSpot: null,
      objectDistance: station.dist,
    };
  }

  if (station.kind !== null) {
    return {
      target: 'station',
      stationKind: station.kind,
      seatIndex: -1,
      seatSpot: null,
      objectDistance: station.dist,
    };
  }

  if (bestSeatIdx !== -1) {
    return {
      target: 'seat',
      stationKind: null,
      seatIndex: bestSeatIdx,
      seatSpot: CASINO_INTERIOR_SEAT_SPOTS[bestSeatIdx],
      objectDistance: bestSeatObjectDist,
    };
  }

  return {
    target: 'none',
    stationKind: null,
    seatIndex: -1,
    seatSpot: null,
    objectDistance: Infinity,
  };
}

