/**
 * Road-following guide routes for scooter owners.
 *
 * The graph below transcribes the asphalt network that
 * `evaluateRoadNetworkSdf` (buddiesPlanetCurvature) paints on the ground:
 * the outer ring highway, the north/south collectors, the central S-curve
 * avenue, the residence-complex dividers and gate drives, plus the harbor
 * coast leg to Kai's Fish Market. Dijkstra over these nodes yields a route
 * that stays on the roads instead of cutting straight across the city.
 */

export interface RoadPoint {
  x: number;
  z: number;
}

const nodeIds = new Map<string, number>();
const nodePoints: RoadPoint[] = [];
const adjacency: Array<Array<{ to: number; w: number }>> = [];

function node(x: number, z: number): number {
  const key = `${Math.round(x * 10)},${Math.round(z * 10)}`;
  const existing = nodeIds.get(key);
  if (existing !== undefined) return existing;
  const id = nodePoints.length;
  nodeIds.set(key, id);
  nodePoints.push({ x, z });
  adjacency.push([]);
  return id;
}

function edge(ax: number, az: number, bx: number, bz: number): void {
  const a = node(ax, az);
  const b = node(bx, bz);
  if (a === b) return;
  const w = Math.hypot(bx - ax, bz - az);
  adjacency[a].push({ to: b, w });
  adjacency[b].push({ to: a, w });
}

function chain(points: Array<readonly [number, number]>): void {
  for (let i = 0; i + 1 < points.length; i++) {
    edge(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }
}

// Outer ring highway + harbor spurs (both z signs share the z = 0 nodes).
chain([
  [-70, 44],
  [-70, 15],
  [-70, 0],
  [-70, -15],
  [-70, -44],
]);
chain([
  [70, 44],
  [70, 15],
  [70, 0],
  [70, -15],
  [70, -44],
]);
edge(-70, 44, -62, 52);
edge(62, 52, 70, 44);
edge(-70, -44, -62, -52);
edge(62, -52, 70, -44);
edge(70, 15, 76.5, 15);
edge(70, -15, 76.5, -15);

// Harbor coast leg (concrete apron and beach path) down to Kai's Fish Market.
chain([
  [76.5, 15],
  [79.6, 29.5],
  [82, 46],
  [85.8, 60],
]);

for (const s of [1, -1] as const) {
  // Collectors at z = +/-52, split at every junction x.
  const collectorXs = [-62, -60, -45, -30, -18, -15, 0, 15, 19, 30, 42, 45, 60, 62];
  chain(collectorXs.map((x) => [x, 52 * s] as const));

  // Central S-curve avenue (the middle road through the city).
  chain([
    [-70, 15 * s],
    [-52, 15 * s],
    [-41, 26 * s],
    [-25, 26 * s],
    [-13, 14 * s],
    [-13, 0],
    [9, 14 * s],
    [19, 24 * s],
    [42, 24 * s],
    [52, 15 * s],
    [70, 15 * s],
  ]);
  // S-curve branches up to the collector.
  chain([
    [-25, 26 * s],
    [-18, 33 * s],
    [-18, 52 * s],
  ]);
  edge(19, 24 * s, 19, 52 * s);
  edge(42, 24 * s, 42, 52 * s);

  // Residence complex: dividers, outer roads, rear road, gate drives.
  for (const x of [-60, -30, 0, 30, 60]) {
    edge(x, 52 * s, x, 108 * s);
  }
  chain([
    [-60, 108 * s],
    [-30, 108 * s],
    [0, 108 * s],
    [30, 108 * s],
    [60, 108 * s],
  ]);
  for (const x of [-45, -15, 15, 45]) {
    edge(x, 52 * s, x, 64.2 * s);
  }
}

function nearestNodeId(x: number, z: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < nodePoints.length; i++) {
    const d = Math.hypot(nodePoints[i].x - x, nodePoints[i].z - z);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Shortest road route from (fromX, fromZ) to (toX, toZ). The returned
 * polyline starts at the caller's position, joins the nearest road node,
 * follows the asphalt network, and ends exactly at the destination.
 */
export function findRoadRoute(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): RoadPoint[] {
  const startId = nearestNodeId(fromX, fromZ);
  const goalId = nearestNodeId(toX, toZ);

  const dist = new Array<number>(nodePoints.length).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(nodePoints.length).fill(-1);
  const settled = new Array<boolean>(nodePoints.length).fill(false);
  dist[startId] = 0;

  for (;;) {
    let current = -1;
    let currentDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < nodePoints.length; i++) {
      if (!settled[i] && dist[i] < currentDist) {
        currentDist = dist[i];
        current = i;
      }
    }
    if (current === -1 || current === goalId) break;
    settled[current] = true;
    for (const link of adjacency[current]) {
      const next = dist[current] + link.w;
      if (next < dist[link.to]) {
        dist[link.to] = next;
        prev[link.to] = current;
      }
    }
  }

  const nodePath: RoadPoint[] = [];
  if (goalId === startId || prev[goalId] !== -1 || goalId === startId) {
    let cursor = goalId;
    nodePath.push(nodePoints[cursor]);
    while (cursor !== startId && prev[cursor] !== -1) {
      cursor = prev[cursor];
      nodePath.push(nodePoints[cursor]);
    }
    nodePath.reverse();
  }

  const route: RoadPoint[] = [{ x: fromX, z: fromZ }];
  for (const point of nodePath) {
    const last = route[route.length - 1];
    if (Math.hypot(point.x - last.x, point.z - last.z) > 0.5) route.push(point);
  }
  const tail = route[route.length - 1];
  if (Math.hypot(toX - tail.x, toZ - tail.z) > 0.5) route.push({ x: toX, z: toZ });
  return route;
}
