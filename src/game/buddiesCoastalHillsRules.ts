/**
 * San Francisco–Style Coastal Switchback & Scenic Ridge Highway Rules
 *
 * Shared 1:1 pure-TypeScript geometric specification for:
 * 1. Extending the North/South perimeter rear roads (|z| = 108.0) east from x = +60 to x = +96.
 * 2. Two North/South mirrored serpentine coastal switchbacks carving smoothly ("kelok membelah bukit")
 *    from the NE & SE coastal ends (y = 0.0m) up to +8.50m atop the outer hills (gentle <= 9.5% grade).
 * 3. Seamless full-perimeter Twin Peaks Scenic Ridge Loop connecting North Switchback -> North Ridge ->
 *    West Twin-Peaks Crest (x = -126.5 behind Grand Casino & West Plaza) -> South Ridge -> South Switchback.
 * 4. Three spacious, completely flat (+8.50m) scenic grassy Hilltop Villa Plateaus accessible right off
 *    the Ridge Highway on North, South, and West crests via clean open driveway gaps.
 */

export const COASTAL_HILL_ROAD_HALF_WIDTH = 3.65;
export const COASTAL_HILL_RIDGE_ELEV_Y = 8.5;
export const COASTAL_HILL_CUT_INNER_M = 5.55;
export const COASTAL_HILL_CUT_OUTER_M = 7.15;
export const COASTAL_HILL_CUT_MARGIN_M = COASTAL_HILL_CUT_OUTER_M - COASTAL_HILL_ROAD_HALF_WIDTH;
export const COASTAL_HILL_WALKABLE_HALF_WIDTH = 4.15;

export interface CoastalHillWaypoint {
  x: number;
  az: number;
  y: number;
}

/**
 * Half-loop spline control waypoints in (x, |z|, y) starting at the East Coastal entrance
 * off |z| = 108.0 (x = +96.0) and reaching the West Twin-Peaks symmetry axis at z = 0.
 * Mirrored seamlessly across North (z <= 0) and South (z >= 0).
 */
export const COASTAL_HILL_HALF_CONTROL_POINTS: readonly CoastalHillWaypoint[] = [
  { x: 96.0, az: 108.0, y: 0.0 },
  { x: 96.8, az: 111.2, y: 0.45 },
  { x: 94.8, az: 115.9, y: 0.90 },
  { x: 90.04, az: 117.92, y: 1.35 },
  { x: 50.0, az: 117.92, y: 3.30 },
  { x: 42.55, az: 125.37, y: 4.50 },
  { x: 50.0, az: 132.82, y: 5.70 },
  { x: 82.0, az: 132.82, y: 6.95 },
  { x: 89.45, az: 140.27, y: 7.75 },
  { x: 82.0, az: 147.72, y: 8.25 },
  { x: 42.0, az: 147.72, y: 8.5 },
  { x: 24.0, az: 144.5, y: 8.5 },
  { x: -4.0, az: 144.5, y: 8.5 },
  { x: -32.0, az: 144.5, y: 8.5 },
  { x: -56.0, az: 144.5, y: 8.5 },
  { x: -85.0, az: 140.2, y: 8.5 },
  { x: -115.0, az: 127.8, y: 8.5 },
  { x: -126.5, az: 90.0, y: 8.5 },
  { x: -126.5, az: 54.0, y: 8.5 },
  { x: -126.5, az: 0.0, y: 8.5 },
];

const SUMMIT_CTRL_IDX = 10; // { x: 42.0, az: 147.72, y: 8.5 }

export interface HillVillaPlateauSpec {
  id: 'north_villa' | 'south_villa' | 'west_villa';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  elevY: number;
  cornerRadius: number;
}

/**
 * Broad, completely flat (+8.50m) scenic grassy hilltop plateaus directly flush with
 * the Ridge Highway so future lakeside/ocean-view hillside Villas sit level without clipping.
 */
export const HILL_VILLA_PLATEAUS: readonly HillVillaPlateauSpec[] = [
  {
    id: 'north_villa',
    minX: -54.0,
    maxX: 24.0,
    minZ: -140.8,
    maxZ: -119.5,
    elevY: COASTAL_HILL_RIDGE_ELEV_Y,
    cornerRadius: 2.8,
  },
  {
    id: 'south_villa',
    minX: -54.0,
    maxX: 24.0,
    minZ: 119.5,
    maxZ: 140.8,
    elevY: COASTAL_HILL_RIDGE_ELEV_Y,
    cornerRadius: 2.8,
  },
  {
    id: 'west_villa',
    minX: -149.5,
    maxX: -130.2,
    minZ: -54.0,
    maxZ: 54.0,
    elevY: COASTAL_HILL_RIDGE_ELEV_Y,
    cornerRadius: 3.0,
  },
];

export const COASTAL_HILL_DRIVEWAY_SPANS = {
  northSouthXMin: -35.0,
  northSouthXMax: 5.0,
  westZMin: -26.0,
  westZMax: 26.0,
} as const;

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function centripetalCatmullRom2D(
  p0: { x: number; az: number },
  p1: { x: number; az: number },
  p2: { x: number; az: number },
  p3: { x: number; az: number },
  t: number,
): { x: number; az: number } {
  const alpha = 0.5;
  const distPow = (a: { x: number; az: number }, b: { x: number; az: number }) =>
    Math.max(1e-4, Math.pow(Math.hypot(b.x - a.x, b.az - a.az), alpha));
  const t0 = 0.0;
  const t1 = t0 + distPow(p0, p1);
  const t2 = t1 + distPow(p1, p2);
  const t3 = t2 + distPow(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const lerpPt = (
    a: { x: number; az: number },
    b: { x: number; az: number },
    ta: number,
    tb: number,
  ) => {
    const w = (u - ta) / Math.max(1e-5, tb - ta);
    return { x: a.x + (b.x - a.x) * w, az: a.az + (b.az - a.az) * w };
  };
  const a1 = lerpPt(p0, p1, t0, t1);
  const a2 = lerpPt(p1, p2, t1, t2);
  const a3 = lerpPt(p2, p3, t2, t3);
  const b1 = lerpPt(a1, a2, t0, t2);
  const b2 = lerpPt(a2, a3, t1, t3);
  return lerpPt(b1, b2, t1, t2);
}

/**
 * Generates exact circular-arc + straight switchback legs (`R >= 6.75m`, pass separation `14.90m`)
 * smoothly transitioning into centripetal Catmull-Rom along the West Twin-Peaks Ridge Loop,
 * with arc-length-parameterized C1 elevation (<= 5.5% grade).
 */
function buildSampledHalfSwitchbackPolyline(
  curvedSubdiv: number,
  flatSubdiv: number,
): Array<CoastalHillWaypoint & { segIdx: number }> {
  const raw: Array<{ x: number; az: number; segIdx: number }> = [];

  const pushArc = (
    cx: number,
    cz: number,
    r: number,
    a0Deg: number,
    a1Deg: number,
    nSteps: number,
    segIdx: number,
    skipFirst = false,
  ) => {
    const startIdx = skipFirst ? 1 : 0;
    for (let i = startIdx; i <= nSteps; i++) {
      const a = ((a0Deg + (a1Deg - a0Deg) * (i / nSteps)) * Math.PI) / 180.0;
      raw.push({ x: cx + Math.cos(a) * r, az: cz + Math.sin(a) * r, segIdx });
    }
  };
  const pushLine = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    nSteps: number,
    segIdx: number,
  ) => {
    for (let i = 1; i <= nSteps; i++) {
      const t = i / nSteps;
      raw.push({ x: x0 + (x1 - x0) * t, az: z0 + (z1 - z0) * t, segIdx });
    }
  };

  // 1) Entrance curve from (96.0, 108.0) -> (90.04, 117.92) around R = 6.75m
  pushArc(90.04, 111.169, 6.75, -28.0, 90.0, 11, 0, false);
  raw[0].x = 96.0;
  raw[0].az = 108.0;

  // 2) Pass 1 West: (90.04, 117.92) -> (50.0, 117.92)
  pushLine(90.04, 117.919, 50.0, 117.919, 7, 1);

  // 3) Hairpin 1 West U-bend (constant R = 7.45m, 14.90m pass separation): (50.0, 117.92) -> (50.0, 132.82)
  pushArc(50.0, 125.369, 7.45, -90.0, -270.0, 16, 2, true);

  // 4) Pass 2 East: (50.0, 132.82) -> (82.0, 132.82)
  pushLine(50.0, 132.819, 82.0, 132.819, 5, 3);

  // 5) Hairpin 2 East U-bend (constant R = 7.45m, 14.90m pass separation): (82.0, 132.82) -> (82.0, 147.72)
  pushArc(82.0, 140.269, 7.45, -90.0, 90.0, 16, 4, true);

  // 6) Pass 3 West Summit Approach: (82.0, 147.72) -> (42.0, 147.72)
  pushLine(82.0, 147.719, 42.0, 147.719, 6, 5);

  // 7) Flat Ridge Loop from (42.0, 147.72) -> North/South Villa Ridge -> West Crest (-126.5, 0.0)
  const ridgePts = COASTAL_HILL_HALF_CONTROL_POINTS;
  for (let i = SUMMIT_CTRL_IDX; i < ridgePts.length - 1; i++) {
    const p0 = i === SUMMIT_CTRL_IDX ? { x: 52.0, az: 147.72 } : ridgePts[i - 1];
    const p1 = ridgePts[i];
    const p2 = ridgePts[i + 1];
    const p3 =
      i + 2 < ridgePts.length
        ? ridgePts[i + 2]
        : { x: ridgePts[ridgePts.length - 2].x, az: -ridgePts[ridgePts.length - 2].az };
    const isStraightFlatSpan = i <= SUMMIT_CTRL_IDX + 3 || i >= ridgePts.length - 3;
    const steps = isStraightFlatSpan ? flatSubdiv : curvedSubdiv;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const pt = centripetalCatmullRom2D(p0, p1, p2, p3, t);
      raw.push({ x: pt.x, az: pt.az, segIdx: i });
    }
  }
  const last = ridgePts[ridgePts.length - 1];
  raw[raw.length - 1] = { x: last.x, az: 0.0, segIdx: ridgePts.length - 1 };

  let sTotal = 0;
  const cumS: number[] = [0];
  let summitS = 0;
  for (let i = 1; i < raw.length; i++) {
    sTotal += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].az - raw[i - 1].az);
    cumS.push(sTotal);
    if (raw[i].segIdx >= SUMMIT_CTRL_IDX && summitS === 0) {
      summitS = sTotal;
    }
  }

  // Smooth C1 ramp-in/ramp-out over arc length [0..summitS] so max slope never spikes at bends
  const easeLen = 7.0;
  const coreSlope = COASTAL_HILL_RIDGE_ELEV_Y / Math.max(1e-3, summitS - easeLen);
  const evalElevByArc = (s: number): number => {
    if (s <= 0) return 0.0;
    if (s >= summitS) return COASTAL_HILL_RIDGE_ELEV_Y;
    if (s < easeLen) return (0.5 * coreSlope * s * s) / easeLen;
    if (s > summitS - easeLen) {
      const u = summitS - s;
      return COASTAL_HILL_RIDGE_ELEV_Y - (0.5 * coreSlope * u * u) / easeLen;
    }
    return coreSlope * (s - 0.5 * easeLen);
  };

  return raw.map((p, idx) => ({
    x: p.x,
    az: p.az,
    y: Math.max(0.0, Math.min(COASTAL_HILL_RIDGE_ELEV_Y, evalElevByArc(cumS[idx]))),
    segIdx: p.segIdx,
  }));
}

const HIGH_RES_SOUTH_HALF_POLYLINE = buildSampledHalfSwitchbackPolyline(6, 4);

/**
 * Compact piecewise path representing the half-loop cleanly in both TypeScript
 * physics and the GLSL terrain shader (decimated directly from the high-res polyline
 * so elevation matches 1:1 across every curve and ramp).
 */
export const COASTAL_HILL_EVAL_SEGMENTS: readonly CoastalHillWaypoint[] = (() => {
  const out: CoastalHillWaypoint[] = [];
  for (let i = 0; i < HIGH_RES_SOUTH_HALF_POLYLINE.length; i++) {
    const p = HIGH_RES_SOUTH_HALF_POLYLINE[i];
    const isLast = i === HIGH_RES_SOUTH_HALF_POLYLINE.length - 1;
    // Keep dense points (stride 2 on 16-step arcs = every 22.5 deg) on switchback curves, sparser on flat straight spans
    const stride =
      p.segIdx <= 5
        ? p.segIdx === 0 || p.segIdx === 2 || p.segIdx === 4
          ? 2
          : 2
        : p.segIdx === SUMMIT_CTRL_IDX
          ? 2
          : 3;
    if (
      isLast ||
      i === 0 ||
      i % stride === 0 ||
      (p.segIdx === SUMMIT_CTRL_IDX && HIGH_RES_SOUTH_HALF_POLYLINE[i - 1]?.segIdx < SUMMIT_CTRL_IDX)
    ) {
      out.push({ x: p.x, az: p.az, y: p.y });
    }
  }
  return out;
})();

export interface CoastalHillSplineVertex {
  x: number;
  y: number;
  z: number;
  isSlopeOrCliff: boolean;
}

/**
 * High-resolution 3D mesh curve points spanning the complete unbroken South -> West Crest -> North
 * scenic mountain highway loop for razor-sharp visual road geometry, curbs, & guardrails.
 */
export const COASTAL_HILL_FULL_LOOP_SPLINE_POINTS: readonly CoastalHillSplineVertex[] = (() => {
  const southHalf = HIGH_RES_SOUTH_HALF_POLYLINE;
  const full: CoastalHillSplineVertex[] = [];
  // South coastal entrance (96, +108) -> South switchback -> South crest -> West center (-126.5, 0)
  for (let i = 0; i < southHalf.length; i++) {
    const p = southHalf[i];
    full.push({
      x: p.x,
      y: p.y,
      z: p.az,
      isSlopeOrCliff: p.y > 0.35 || p.az > 113.0 || p.x < -115.0,
    });
  }
  // West center -> North crest -> North switchback -> North coastal entrance (96, -108)
  for (let i = southHalf.length - 2; i >= 0; i--) {
    const p = southHalf[i];
    full.push({
      x: p.x,
      y: p.y,
      z: -p.az,
      isSlopeOrCliff: p.y > 0.35 || p.az > 113.0 || p.x < -115.0,
    });
  }
  return full;
})();

function sdRoundedBox2(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  r: number,
): number {
  const dx = Math.abs(px - cx) - hx + r;
  const dz = Math.abs(pz - cz) - hz + r;
  return (
    Math.hypot(Math.max(dx, 0.0), Math.max(dz, 0.0)) +
    Math.min(Math.max(dx, dz), 0.0) -
    r
  );
}

/**
 * Signed distance (< 0 inside) to any of the 3 flat (+8.50m) scenic Hilltop Villa Plateaus.
 * Uses N/S symmetry via `|worldZ|` internally for North/South Villa Plateaus.
 */
export function evaluateHillVillaPlateauSdf(worldX: number, worldZ: number): number {
  const az = Math.abs(worldZ);
  // Mirrored North/South Overlook Villa Plateau: x in [-54..+24], |z| in [119.5..140.8]
  const nsPlateau = sdRoundedBox2(worldX, az, -15.0, 130.15, 39.0, 10.65, 2.8);
  // West Twin-Peaks Overlook Villa Plateau behind West Plaza: x in [-149.5..-130.2], z in [-54..+54]
  const westPlateau = sdRoundedBox2(worldX, az, -139.85, 0.0, 9.65, 54.0, 3.0);
  return Math.min(nsPlateau, westPlateau);
}

/**
 * Signed distance (< 0 inside) to the 3 wide driveway aprons bridging the Ridge Highway
 * to the North, South, and West Hilltop Villa Plateaus so walkability never pinches at curbs.
 */
export function evaluateHillVillaDrivewayApronSdf(worldX: number, worldZ: number): number {
  const az = Math.abs(worldZ);
  // N/S driveway bridge across |z| in [138.5..145.5], x in [-35.0..+5.0]
  const nsDriveway = sdRoundedBox2(worldX, az, -15.0, 142.0, 20.0, 3.5, 1.5);
  // West driveway bridge across x in [-132.5..-125.5], z in [-26.0..+26.0]
  const westDriveway = sdRoundedBox2(worldX, az, -129.0, 0.0, 3.5, 26.0, 1.5);
  return Math.min(nsDriveway, westDriveway);
}

/**
 * Returns true if a curb/guardrail edge point `(edgeX, edgeZ)` lies inside one of the 3 open
 * driveway gaps connecting the Ridge Highway directly onto the flat Villa Plateaus.
 */
export function isPointInCoastalHillDrivewayGap(edgeX: number, edgeZ: number): boolean {
  const az = Math.abs(edgeZ);
  // North/South Villa Driveway: on city-facing edge (|z| ~ 140.85, x in [-35, +5]) vs outer rim (148.15)
  if (
    az >= 139.0 &&
    az <= 143.0 &&
    edgeX >= COASTAL_HILL_DRIVEWAY_SPANS.northSouthXMin &&
    edgeX <= COASTAL_HILL_DRIVEWAY_SPANS.northSouthXMax
  ) {
    return true;
  }
  // West Villa Driveway: on West-facing edge (x ~ -130.15, z in [-26, +26]) vs East overlook rim (-122.85)
  if (
    edgeX <= -128.5 &&
    edgeX >= -132.0 &&
    az <= COASTAL_HILL_DRIVEWAY_SPANS.westZMax
  ) {
    return true;
  }
  return false;
}

export interface CoastalHillRoadSample {
  distToCenterM: number;
  roadSdfM: number;
  roadElevY: number;
  cutAlpha: number;
}

/**
 * Evaluates closest distance & smoothly interpolated elevation along the mirrored
 * San Francisco coastal switchback & ridge highway.
 * Matches GLSL `evalCoastalHillRoad(vec2 p)` 1:1.
 */
export function evaluateCoastalHillRoadSample(
  worldX: number,
  worldZ: number,
): CoastalHillRoadSample {
  const az = Math.abs(worldZ);
  if (worldX > -110.0 && az < 98.0) {
    return {
      distToCenterM: 999.0,
      roadSdfM: 999.0 - COASTAL_HILL_ROAD_HALF_WIDTH,
      roadElevY: 0.0,
      cutAlpha: 0.0,
    };
  }
  const segs = COASTAL_HILL_EVAL_SEGMENTS;
  let minDistSq = 1e9;
  let bestY = 0.0;

  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i];
    const b = segs[i + 1];
    const pax = worldX - a.x;
    const paz = az - a.az;
    const bax = b.x - a.x;
    const baz = b.az - a.az;
    const denom = bax * bax + baz * baz + 1e-6;
    const h = Math.max(0.0, Math.min(1.0, (pax * bax + paz * baz) / denom));
    const dx = pax - bax * h;
    const dz = paz - baz * h;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      bestY = a.y + (b.y - a.y) * h;
    }
  }

  const dist = Math.sqrt(minDistSq);
  const roadSdf = dist - COASTAL_HILL_ROAD_HALF_WIDTH;
  const seawallFade = 1.0 - smoothstep01((worldX - 99.6) / 2.2);
  const cutAlpha =
    (1.0 -
      smoothstep01(
        (dist - COASTAL_HILL_CUT_INNER_M) /
          (COASTAL_HILL_CUT_OUTER_M - COASTAL_HILL_CUT_INNER_M),
      )) *
    seawallFade;
  return {
    distToCenterM: dist,
    roadSdfM: roadSdf,
    roadElevY: bestY,
    cutAlpha,
  };
}

/**
 * Emits exact GLSL arrays and helper functions matching `evaluateCoastalHillRoadSample`,
 * `evaluateHillVillaPlateauSdf`, and `evaluateHillVillaDrivewayApronSdf` 1:1 for the GPU shaders.
 */
export function buildCoastalHillGlslSnippet(): string {
  const segs = COASTAL_HILL_EVAL_SEGMENTS;
  const vec3Entries = segs
    .map((p) => `vec3(${p.x.toFixed(4)}, ${p.az.toFixed(4)}, ${p.y.toFixed(4)})`)
    .join(',\n      ');

  return /* glsl */ `
  const int COASTAL_HILL_PT_COUNT = ${segs.length};
  const vec3 COASTAL_HILL_PTS[${segs.length}] = vec3[${segs.length}](
      ${vec3Entries}
  );

  float evaluateHillVillaPlateauSdf(vec2 p) {
    vec2 q = vec2(p.x, abs(p.y));
    float nsPlateau = sdRoundedBox2D(q, vec2(-15.0, 130.15), vec2(39.0, 10.65), 2.8);
    float westPlateau = sdRoundedBox2D(q, vec2(-139.85, 0.0), vec2(9.65, 54.0), 3.0);
    return min(nsPlateau, westPlateau);
  }

  float evaluateHillVillaDrivewayApronSdf(vec2 p) {
    vec2 q = vec2(p.x, abs(p.y));
    float nsDriveway = sdRoundedBox2D(q, vec2(-15.0, 142.0), vec2(20.0, 3.5), 1.5);
    float westDriveway = sdRoundedBox2D(q, vec2(-129.0, 0.0), vec2(3.5, 26.0), 1.5);
    return min(nsDriveway, westDriveway);
  }

  // Returns vec3(distToCenterM, roadElevY, cutAlpha) matching TS evaluateCoastalHillRoadSample 1:1
  vec3 evalCoastalHillRoad(vec2 p) {
    float az = abs(p.y);
    if (p.x > -110.0 && az < 98.0) {
      return vec3(999.0, 0.0, 0.0);
    }
    float minDistSq = 1e9;
    float bestY = 0.0;
    for (int i = 0; i < COASTAL_HILL_PT_COUNT - 1; i++) {
      vec3 a = COASTAL_HILL_PTS[i];
      vec3 b = COASTAL_HILL_PTS[i + 1];
      vec2 pa = vec2(p.x, az) - a.xy;
      vec2 ba = b.xy - a.xy;
      float h = clamp(dot(pa, ba) / (dot(ba, ba) + 1e-6), 0.0, 1.0);
      vec2 d = pa - ba * h;
      float dSq = dot(d, d);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestY = mix(a.z, b.z, h);
      }
    }
    float dist = sqrt(minDistSq);
    float seawallFade = 1.0 - smoothstep(99.6, 101.8, p.x);
    float cutAlpha = (1.0 - smoothstep(${COASTAL_HILL_CUT_INNER_M.toFixed(2)}, ${COASTAL_HILL_CUT_OUTER_M.toFixed(2)}, dist)) * seawallFade;
    return vec3(dist, bestY, cutAlpha);
  }
`;
}
