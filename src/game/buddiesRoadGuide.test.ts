import test from 'node:test';
import assert from 'node:assert/strict';

import { findRoadRoute } from './buddiesRoadGuide';
import { evaluateRoadNetworkSdf } from './buddiesPlanetCurvature';

function routeLength(route: Array<{ x: number; z: number }>): number {
  let total = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    total += Math.hypot(route[i + 1].x - route[i].x, route[i + 1].z - route[i].z);
  }
  return total;
}

test('road route from Central Plaza reaches Kai along the asphalt network', () => {
  const route = findRoadRoute(-88, -9, 85.8, 60);
  assert.ok(route.length >= 6, `expected a multi-leg route, got ${route.length} points`);
  const last = route[route.length - 1];
  assert.equal(last.x, 85.8);
  assert.equal(last.z, 60);
  // Every intermediate point west of the harbor leg lies on (or within the
  // corner-cut tolerance of) the painted road network.
  for (const point of route.slice(1, -1)) {
    if (point.x >= 76) continue; // harbor concrete + beach leg
    const sdf = evaluateRoadNetworkSdf(point.x, point.z);
    assert.ok(sdf <= 4.6, `point (${point.x}, ${point.z}) is ${sdf.toFixed(2)}m off the road`);
  }
  const total = routeLength(route);
  assert.ok(total > 190 && total < 340, `route length ${total.toFixed(1)}m is implausible`);
});

test('road route to a claimed plot ends through its own gate drive', () => {
  const route = findRoadRoute(-88, -9, -15, 73.45);
  const last = route[route.length - 1];
  assert.equal(last.x, -15);
  assert.equal(last.z, 73.45);
  assert.ok(
    route.some((p) => p.x === -15 && p.z === 64.2),
    'route should pass the plot gate drive node (-15, 64.2)',
  );
});

test('road graph connects south harbor to the north residence', () => {
  const route = findRoadRoute(85.8, 60, 6.5, -46.4);
  assert.ok(route.length >= 6);
  const last = route[route.length - 1];
  assert.equal(last.x, 6.5);
  assert.equal(last.z, -46.4);
});
