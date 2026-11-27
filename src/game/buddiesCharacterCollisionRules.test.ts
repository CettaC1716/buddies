import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AMBIENT_NPC_CAPSULE_RADIUS,
  PLAYER_FOOT_CAPSULE_RADIUS,
  WORLD_STAIRCASE_CORRIDORS,
  computeLocalPedestrianAvoidance2D,
  getAuditedStaticWorldStructures,
  isSegmentClearOfAuditedStaticObstacles2D,
  isStaticColliderBelowMoverFeet,
  resolveAmbientNpcExemptSeatPoint,
  resolveCapsulePairSeparation2D,
  resolveCapsuleVsCirclePushout2D,
  resolveCharacterAgainstDynamicObstacles2D,
  resolveExtendedWaterMarginGuard2D,
  resolveGroundMoverAuditedCollisions2D,
  resolveMultiIterationCapsuleCluster2D,
  resolveStaircaseAndElevationGuard2D,
  type CharacterCapsuleBody2D,
  type LocalPedestrianAvoidanceResult,
  type PedestrianAvoidanceCapsule2D,
} from './buddiesCharacterCollisionRules';
import {
  CITY_AMBIENT_NPC_PRESETS,
  CITY_TRAFFIC_SIGN_SPECS,
  findPathAStar,
  getPropCollisionSpec,
  isNavGridCellWalkable,
  stepCityAmbientNpcSchedule,
  worldToNavGridCell,
  type CityAmbientNpcPreset,
} from './buddiesBlitzRules';
import type { StaticWorldStructureObb } from './buddiesBlitzTypes';
import { buildStaticWorldStructuresList, DEFAULT_ARENA_MAP_LAYOUT } from './buddiesBlitzWorldBuilder';
import { buildArenaNavGrids, isPointOnPedestrianCrosswalkCorridor } from './buddiesBlitzSquadAi';
import { CITY_LAMP_MANIFEST } from './buddiesCityLightingAndTrafficRules';
import { BEACH_CLUB_MASTERPLAN } from './buddiesBeachClubRules';
import { evaluateRoadNetworkSdf, getTerrainElevation } from './buddiesPlanetCurvature';

function buildTestBaseStructures(): StaticWorldStructureObb[] {
  const stubBase = {
    baseGroup: { userData: {} },
    hqX: -999,
    hqZ: -999,
    turrets: [],
  } as unknown as Parameters<typeof buildStaticWorldStructuresList>[0]['blueBase'];
  return buildStaticWorldStructuresList({
    blueBase: stubBase,
    redBase: stubBase,
    blueCommanderBases: [],
    redCommanderBases: [],
    isSafezoneMode: true,
  });
}

test('resolveCapsuleVsCirclePushout2D separates overlapping bodies and preserves tangential slide', () => {
  const res = resolveCapsuleVsCirclePushout2D(
    10.0,
    10.5,
    2.0,
    3.0,
    0.72,
    10.0,
    10.0,
    0.54,
    0.0,
    1.0,
  );
  assert.equal(res.collided, true);
  // Radial push strictly +Z so X stays 10.0 and Z reaches minDist (1.26)
  assert.ok(Math.abs(res.x - 10.0) < 1e-6);
  assert.ok(Math.abs(res.z - 11.26) < 1e-4);
  // Moving away along +Z keeps vz untouched
  assert.equal(res.vz, 3.0);

  // Moving inward against +Z normal cancels radial inward velocity while keeping vx tangential slide
  const inward = resolveCapsuleVsCirclePushout2D(
    10.0,
    10.4,
    2.5,
    -4.0,
    0.72,
    10.0,
    10.0,
    0.54,
    0.0,
    1.0,
  );
  assert.equal(inward.collided, true);
  assert.ok(Math.abs(inward.vx - 2.5) < 1e-6);
  assert.ok(Math.abs(inward.vz) < 1e-6);
  assert.equal(inward.impactSpeed, 4.0);
});

test('resolveMultiIterationCapsuleCluster2D separates dense NPC groups and respects talking/sitting locks', () => {
  const talkingNpc: CharacterCapsuleBody2D = {
    id: 'citizen_mira',
    x: -90.55,
    z: 20.8,
    vx: 0,
    vz: 0,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    groundY: 2.5,
    isTalking: true,
  };
  const seatedNpc: CharacterCapsuleBody2D = {
    id: 'city_plaza_nadia',
    x: -81.23,
    z: -24.85,
    vx: 0,
    vz: 0,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    groundY: 2.5,
    isSitting: true,
  };
  const walkerA: CharacterCapsuleBody2D = {
    id: 'city_plaza_raka',
    x: -90.45,
    z: 20.85,
    vx: 0.4,
    vz: 0.2,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    groundY: 2.5,
  };
  const walkerB: CharacterCapsuleBody2D = {
    id: 'citizen_bima',
    x: -90.5,
    z: 20.75,
    vx: -0.3,
    vz: 0.1,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    groundY: 2.5,
  };
  const walkerC: CharacterCapsuleBody2D = {
    id: 'citizen_tari',
    x: -81.1,
    z: -24.8,
    vx: 0.1,
    vz: -0.2,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    groundY: 2.5,
  };

  const cluster = [talkingNpc, seatedNpc, walkerA, walkerB, walkerC];
  const moved = resolveMultiIterationCapsuleCluster2D(cluster, 4);
  assert.equal(moved, true);

  // Talking & seated NPCs must remain 100% pinned at their positions
  assert.equal(talkingNpc.x, -90.55);
  assert.equal(talkingNpc.z, 20.8);
  assert.equal(seatedNpc.x, -81.23);
  assert.equal(seatedNpc.z, -24.85);

  // All mobile pairs around talking/seated NPCs must now satisfy full separation distance
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      const a = cluster[i];
      const b = cluster[j];
      if ((a.isSitting || a.isTalking) && (b.isSitting || b.isTalking)) continue;
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(
        dist >= a.radius + b.radius - 0.03,
        `Expected ${a.id} and ${b.id} separated, got dist=${dist.toFixed(3)}`,
      );
    }
  }
});

test('resolveCapsulePairSeparation2D skips cross-deck collisions with >2.2m vertical gap', () => {
  const high: CharacterCapsuleBody2D = {
    id: 'upper',
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    radius: 0.72,
    groundY: 8.5,
  };
  const low: CharacterCapsuleBody2D = {
    id: 'lower',
    x: 0.1,
    z: 0,
    vx: 0,
    vz: 0,
    radius: 0.54,
    groundY: 0.0,
  };
  assert.equal(resolveCapsulePairSeparation2D(high, low), false);
  assert.equal(high.x, 0);
  assert.equal(low.x, 0.1);
});

test('resolveExtendedWaterMarginGuard2D blocks NW Lake, SE Sea & Beach Club Pools while allowing Stilt Cabin & Beach Club Crossing Bridge', () => {
  // Inside NW Oasis Lake center (-31, 0)
  const lake = resolveExtendedWaterMarginGuard2D({
    x: -31.0,
    z: 2.0,
    vx: 0,
    vz: -1.0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(lake.hitWater, true);
  assert.ok(Math.hypot(lake.x - -31.0, lake.z) > 2.0);

  // In deep open SE sea east of widened 134m shoreline south of Stilt Cabin
  const ocean = resolveExtendedWaterMarginGuard2D({
    x: 142.0,
    z: 70.0,
    vx: 2.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(ocean.hitWater, true);
  assert.ok(ocean.x < 142.0);
  assert.equal(ocean.vx, 0);

  // On Beachfront Stilt Cabin deck over ocean (134.8, 98.8) -> must NOT push off deck!
  const stiltDeck = resolveExtendedWaterMarginGuard2D({
    x: 134.8,
    z: 98.8,
    vx: 1.5,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(stiltDeck.hitWater, false);
  assert.equal(stiltDeck.x, 134.8);

  // On Beach Club Crossing Bridge (95.8, -14.3) above West flanking pool -> must stay walkable!
  const bridgeDeck = resolveExtendedWaterMarginGuard2D({
    x: 95.8,
    z: -14.3,
    vx: 1.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(bridgeDeck.hitWater, false);
  assert.equal(bridgeDeck.x, 95.8);

  // Inside Beach Club Lap Pool basin -> water margin pushes smoothly back onto coping
  const poolStep = resolveExtendedWaterMarginGuard2D({
    x: 102.0,
    z: -45.0,
    vx: 1.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(poolStep.hitWater, true);
});

test('resolveStaircaseAndElevationGuard2D permits stair ascents/descents and blocks sheer sideways drops', () => {
  // Stepping up Central Plaza Grand Staircase along X inside south stair corridor (z = 4.0)
  const stairStep = resolveStaircaseAndElevationGuard2D({
    prevX: -81.0,
    prevZ: 4.0,
    nextX: -81.8,
    nextZ: 4.0,
    vx: -3.5,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(stairStep.clamped, false);
  assert.equal(stairStep.x, -81.8);

  // Trying to clip horizontally off Central Plaza cliff south of terrace edge (z=9.8 -> z=10.8 at x=-81)
  // Actually z=10.8 has plaza elev 2.50, while inside stair x=-81, z=5 has elev 0.75 vs z=10.2 -> huge drop!
  const plazaSideCliff = resolveStaircaseAndElevationGuard2D({
    prevX: -81.0,
    prevZ: 7.9,
    nextX: -81.0,
    nextZ: 8.6,
    vx: 0,
    vz: 3.0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(plazaSideCliff.clamped, true);
  assert.ok(plazaSideCliff.z <= 8.36);

  // Trying to drop vertically across a sheer cliff jump (elev 2.50 -> 0.00 across x=-79.15, z=11)
  const dropJump = resolveStaircaseAndElevationGuard2D({
    prevX: -80.2,
    prevZ: 11.2,
    nextX: -78.2,
    nextZ: 11.2,
    vx: 4.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(dropJump.clamped, true);
  assert.equal(dropJump.x, -80.2);
  assert.equal(dropJump.vx, 0);
});

test('getAuditedStaticWorldStructures audits circular basins, Ontang-Anting, lamps, signs, and keeps all ambient NPC routes clear', () => {
  const base = buildTestBaseStructures();
  const audited = getAuditedStaticWorldStructures(base);

  // Fountain & Lily Pond converted to circular colliders (diagonal corner outside circle r=3.7 is passable)
  assert.equal(
    audited.obbs.some((s) => s.id === 'central_park_stone_fountain'),
    false,
  );
  const fountainCircle = audited.circles.find((c) => c.id === 'central_park_stone_fountain');
  assert.ok(fountainCircle && fountainCircle.radius === 3.7);
  const diagCornerTest = resolveGroundMoverAuditedCollisions2D({
    x: 29.5 + 3.5,
    z: 3.5,
    vx: 0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
    audited,
  });
  assert.equal(diagCornerTest.collided, false);

  // Beach Club DJ booth & Cocktail Bar colliders are guarded
  const djBooth = audited.obbs.find((s) => s.id === 'beach_club_dj_booth');
  assert.ok(djBooth, 'Expected beach_club_dj_booth OBB collider');
  const boothHit = resolveGroundMoverAuditedCollisions2D({
    x: BEACH_CLUB_MASTERPLAN.djStage.cx + 1.0,
    z: BEACH_CLUB_MASTERPLAN.djStage.cz,
    vx: -1.5,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
    audited,
  });
  assert.equal(boothHit.collided, true);

  // Every lamp in CITY_LAMP_MANIFEST has an active nearby collider (at player ground/deck elevation)
  for (const lamp of CITY_LAMP_MANIFEST) {
    const sampleY = getTerrainElevation(lamp.x, lamp.z);
    const hasLampCollider =
      audited.obbs.some(
        (s) => Math.hypot(s.x - lamp.x, s.z - lamp.z) <= 1.25 && s.heightY > sampleY,
      ) ||
      audited.circles.some(
        (c) => Math.hypot(c.x - lamp.x, c.z - lamp.z) <= 1.25 && c.heightY > sampleY,
      );
    assert.equal(hasLampCollider, true, `Missing collider for streetlamp ${lamp.id}`);
  }

  // Every road sign in CITY_TRAFFIC_SIGN_SPECS has an active collider
  for (const sign of CITY_TRAFFIC_SIGN_SPECS) {
    const hasSignCollider = audited.obbs.some(
      (s) => Math.hypot(s.x - sign.x, s.z - sign.z) <= 1.05,
    );
    assert.equal(hasSignCollider, true, `Missing collider for traffic sign ${sign.id}`);
  }

  // Every standing/walking waypoint across all 6 Town Folks NPCs is completely clear of static overlaps
  for (const preset of CITY_AMBIENT_NPC_PRESETS) {
    for (let wi = 0; wi < preset.waypoints.length; wi++) {
      const wp = preset.waypoints[wi];
      const act = wp.activity ?? preset.activity;
      if (act === 'sit_relax') {
        const exempt = resolveAmbientNpcExemptSeatPoint(preset, wi, wp.x, wp.z, true);
        assert.ok(exempt !== null);
        continue;
      }
      const res = resolveGroundMoverAuditedCollisions2D({
        x: wp.x,
        z: wp.z,
        vx: 0,
        vz: 0,
        radius: AMBIENT_NPC_CAPSULE_RADIUS,
        audited,
      });
      assert.equal(
        res.collided,
        false,
        `Non-sitting waypoint (${wp.x}, ${wp.z}) of NPC ${preset.id} clipped into static world collider (pushed to ${res.x.toFixed(2)}, ${res.z.toFixed(2)})`,
      );
    }
  }
});

test('all SE beachfront & stilt stairs allow multi-step ascents while Plaza/Park props block clipping', () => {
  const base = buildTestBaseStructures();
  const audited = getAuditedStaticWorldStructures(base);

  // Walking smoothly up SE Beach Stair 1, West Steps & Stilt Cabin Stairs succeeds
  const stair1 = resolveStaircaseAndElevationGuard2D({
    prevX: 95.0,
    prevZ: 73.5,
    nextX: 94.3,
    nextZ: 73.5,
    vx: -2.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(stair1.clamped, false);

  const stiltStair = resolveStaircaseAndElevationGuard2D({
    prevX: 127.6,
    prevZ: 84.5,
    nextX: 128.4,
    nextZ: 84.5,
    vx: 2.5,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(stiltStair.clamped, false);

  // New exterior props across Plaza & Central Park are solid
  const propProbes: Array<[string, number, number]> = [
    ['Municipal portico col W', -95.6, -25.38],
    ['Municipal letterbox', -86.66, -33.67],
    ['Glasshouse entrance pot W', -92.7, 21.95],
    ['Tennis floodlight NW', -99.54, 38.9],
    ['Boutique front bench', 17.12, 2.45],
    ['Bites & Sips A-frame sign', 41.65, -4.75],
    ['Pergola corner plinth 0', 32.65, -14.61],
  ];
  for (const [label, px, pz] of propProbes) {
    const hit = resolveGroundMoverAuditedCollisions2D({
      x: px + 0.2,
      z: pz,
      vx: -1.5,
      vz: 0,
      radius: PLAYER_FOOT_CAPSULE_RADIUS,
      audited,
    });
    assert.equal(hit.collided, true, `Expected solid pushout for ${label}`);
  }
});

test('resolveCharacterAgainstDynamicObstacles2D and curb guard keep pedestrians sliding safely', () => {
  const base = buildTestBaseStructures();
  const audited = getAuditedStaticWorldStructures(base);

  const dyn = resolveCharacterAgainstDynamicObstacles2D({
    x: -70.0,
    z: 0.4,
    vx: 0,
    vz: -2.0,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    obbs: [{ x: -70.0, z: 0.0, halfX: 1.5, halfZ: 4.5, rotY: Math.PI / 2, vx: 0, vz: 0 }],
    circles: [{ x: -70.0, z: 3.0, radius: 0.56 }],
  });
  assert.equal(dyn.collided, true);

  // Crowd separation near Outer Ring sidewalk curb never pushes an NPC off onto non-crosswalk asphalt
  const curbSafe = resolveGroundMoverAuditedCollisions2D({
    x: -70.0,
    z: 24.0,
    vx: 1.0,
    vz: 0,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    audited,
    prevX: -61.5,
    prevZ: 24.0,
    stayOffNonCrosswalkRoads: true,
  });
  assert.equal(curbSafe.x, -61.5);
  assert.equal(curbSafe.z, 24.0);
  assert.equal(curbSafe.vx, 0);
});

function buildArenaGridWithAuditedWorld() {
  const staticStructures = buildTestBaseStructures();
  const audited = getAuditedStaticWorldStructures(staticStructures);
  const trees = DEFAULT_ARENA_MAP_LAYOUT.props
    .filter((p) => p.kind.startsWith('tree_'))
    .map((p) => ({ x: p.x, z: p.z, scale: p.scale, alive: true }));
  const activeMapProps = DEFAULT_ARENA_MAP_LAYOUT.props
    .filter((p) => !p.kind.startsWith('tree_'))
    .map((p) => {
      const colSpec = getPropCollisionSpec(p.kind, p.scale);
      return {
        kind: p.kind,
        x: p.x,
        z: p.z,
        rotY: p.rotY,
        scale: p.scale,
        alive: true,
        category: colSpec.category,
        radius: colSpec.radius,
        halfX: colSpec.halfX,
        halfZ: colSpec.halfZ,
      };
    });
  const grids = buildArenaNavGrids({
    staticStructures,
    trees,
    activeMapProps,
    auditedWorld: audited,
  });
  return { staticStructures, audited, trees, activeMapProps, ...grids };
}

test('buildArenaNavGrids syncs non-seat audited Halte signs, lamps, and circles into pedestrianGrid & footGrid without sealing sidewalks', () => {
  const { pedestrianGrid, footGrid } = buildArenaGridWithAuditedWorld();

  // Every Halte sign cell is rasterized onto both pedestrianGrid and footGrid
  for (const signId of [
    'sign_halte_plaza',
    'sign_halte_north_res',
    'sign_halte_south_res',
    'sign_halte_harbor',
  ]) {
    const sign = CITY_TRAFFIC_SIGN_SPECS.find((s) => s.id === signId)!;
    const cell = worldToNavGridCell(pedestrianGrid, sign.x, sign.z);
    assert.equal(
      isNavGridCellWalkable(pedestrianGrid, cell.gx, cell.gz),
      false,
      `Expected ${signId} cell (${cell.gx}, ${cell.gz}) blocked on pedestrianGrid`,
    );
    assert.equal(
      isNavGridCellWalkable(footGrid, cell.gx, cell.gz),
      false,
      `Expected ${signId} cell (${cell.gx}, ${cell.gz}) blocked on footGrid`,
    );
  }

  // Circular Central Park stone fountain leaves diagonal corner walkable (unlike raw oversized square OBB)
  const fountainDiagCell = worldToNavGridCell(pedestrianGrid, 29.5 + 3.5, 3.5);
  assert.equal(
    isNavGridCellWalkable(pedestrianGrid, fountainDiagCell.gx, fountainDiagCell.gz),
    true,
    'Circular fountain replacement must keep diagonal corner cell walkable',
  );

  // Sidewalks remain completely open: every consecutive leg of all 6 Town Folks NPCs solves cleanly
  for (const preset of CITY_AMBIENT_NPC_PRESETS) {
    for (let i = 0; i < preset.waypoints.length; i++) {
      const a = preset.waypoints[i];
      const b = preset.waypoints[(i + 1) % preset.waypoints.length];
      const pathRes = findPathAStar(pedestrianGrid, a.x, a.z, b.x, b.z, {
        allowDiagonal: true,
        maxIterations: 22500,
        smoothPath: true,
      });
      assert.equal(
        pathRes.reachedGoal,
        true,
        `${preset.id} leg ${i} (${a.x},${a.z}) -> (${b.x},${b.z}) blocked after audited sync`,
      );
    }
  }
});

test('computeLocalPedestrianAvoidance2D steers smoothly around Halte poles & characters with hysteresis and curb/water safety', () => {
  const { audited } = buildArenaGridWithAuditedWorld();
  const out: LocalPedestrianAvoidanceResult = {
    dirX: 0,
    dirZ: 0,
    speedScale: 1,
    avoidSide: 0,
    avoidTimer: 0,
    blocked: false,
  };

  // 1. Unobstructed sidewalk walk stays direct with speedScale=1
  const clear = computeLocalPedestrianAvoidance2D(
    {
      selfId: 'citizen_mira',
      x: -76.0,
      z: 0.0,
      dirX: 0,
      dirZ: 1,
      radius: AMBIENT_NPC_CAPSULE_RADIUS,
      distToSteerTarget: 12,
      distToFinal: 12,
      isFinalGoal: false,
      dt: 0.05,
      audited,
      stayOffNonCrosswalkRoads: true,
    },
    out,
  );
  assert.equal(clear.blocked, false);
  assert.equal(clear.speedScale, 1);
  assert.ok(Math.abs(clear.dirZ - 1) < 1e-6);

  // 2. Approaching sign_halte_south_res (-46.30, 43.72) along curb strip steers onto sidewalk (-Z), NEVER asphalt (+Z)
  const curbPole = computeLocalPedestrianAvoidance2D({
    selfId: 'citizen_tari',
    x: -48.0,
    z: 43.72,
    dirX: 1,
    dirZ: 0,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    distToSteerTarget: 6,
    distToFinal: 6,
    isFinalGoal: false,
    dt: 0.05,
    audited,
    stayOffNonCrosswalkRoads: true,
  });
  assert.equal(curbPole.blocked, true);
  assert.ok(curbPole.dirZ < -0.2, `Expected sidewalk-side steer (dirZ < -0.2), got ${curbPole.dirZ.toFixed(3)}`);
  assert.ok(curbPole.avoidSide !== 0);

  // 3. Hysteresis preserves chosen avoidSide when symmetric NPCs pass ahead
  const firstPass = computeLocalPedestrianAvoidance2D({
    selfId: 'citizen_mira',
    x: -76.0,
    z: -4.0,
    dirX: 0,
    dirZ: 1,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    distToSteerTarget: 8,
    distToFinal: 8,
    isFinalGoal: false,
    dt: 0.05,
    audited,
    characterCapsules: [{ id: 'city_plaza_raka', x: -76.0, z: -2.6, radius: AMBIENT_NPC_CAPSULE_RADIUS }],
    avoidSide: -1,
    avoidTimer: 0.45,
    stayOffNonCrosswalkRoads: true,
  });
  assert.equal(firstPass.blocked, true);
  assert.equal(firstPass.avoidSide, -1, 'Hysteresis must maintain active avoidSide instead of zig-zagging');

  // 4. Direct segment check catches thin pole obstruction for distToFinal <= 3.8 guard
  assert.equal(
    isSegmentClearOfAuditedStaticObstacles2D({
      fromX: -61.84,
      fromZ: -4.2,
      toX: -61.84,
      toZ: -1.4,
      radius: AMBIENT_NPC_CAPSULE_RADIUS,
      audited,
    }),
    false,
    'Segment crossing sign_halte_plaza (-61.84, -2.98) must report blocked',
  );

  // 5. Boxed-in NPC between windbreak wall, pole, and immovable characters yields cleanly (speedScale=0)
  const boxedIn = computeLocalPedestrianAvoidance2D({
    selfId: 'citizen_mira',
    x: -56.25,
    z: -2.0,
    dirX: 0,
    dirZ: -1,
    radius: AMBIENT_NPC_CAPSULE_RADIUS,
    distToSteerTarget: 5,
    distToFinal: 5,
    isFinalGoal: false,
    dt: 0.05,
    audited,
    characterCapsules: [
      { id: 'blocker_e', x: -55.3, z: -2.3, radius: PLAYER_FOOT_CAPSULE_RADIUS },
      { id: 'blocker_n', x: -55.7, z: -1.3, radius: PLAYER_FOOT_CAPSULE_RADIUS },
      { id: 'blocker_s', x: -56.1, z: -1.2, radius: PLAYER_FOOT_CAPSULE_RADIUS },
    ],
    stayOffNonCrosswalkRoads: true,
  });
  assert.equal(boxedIn.blocked, true);
  assert.equal(boxedIn.speedScale, 0, 'Boxed-in NPC must pause walk cycle instead of running in place');
});

test('Halte Plaza & South Res 12s closed-loop steering: Mira, Tari & Raka steer around poles, shelter posts, and people without getting stuck in place', () => {
  const { audited, pedestrianGrid } = buildArenaGridWithAuditedWorld();

  interface SimAgent {
    preset: CityAmbientNpcPreset;
    x: number;
    z: number;
    yaw: number;
    wpIdx: number;
    pauseTimer: number;
    navPath: Array<{ x: number; z: number }>;
    navWpIdx: number;
    goalKey: string;
    stuckTimer: number;
    lastPX: number;
    lastPZ: number;
    avoidSide: number;
    avoidTimer: number;
    isMoving: boolean;
    speedMps: number;
    reachedTarget: boolean;
    inPlaceAnimFrames: number;
    asphaltFrames: number;
    walkCycle: number;
  }

  const runHalteSimulation = (
    agents: SimAgent[],
    staticBlockers: PedestrianAvoidanceCapsule2D[],
    durationSec: number,
  ) => {
    const dt = 0.05;
    const steps = Math.round(durationSec / dt);
    for (let s = 0; s < steps; s++) {
      const capsules: PedestrianAvoidanceCapsule2D[] = [
        ...agents.map((a) => ({
          id: a.preset.id,
          x: a.x,
          z: a.z,
          vx: a.isMoving ? Math.cos(a.yaw) * a.speedMps : 0,
          vz: a.isMoving ? -Math.sin(a.yaw) * a.speedMps : 0,
          radius: AMBIENT_NPC_CAPSULE_RADIUS,
          groundY: getTerrainElevation(a.x, a.z),
        })),
        ...staticBlockers.map((b) => ({
          ...b,
          groundY: b.groundY ?? getTerrainElevation(b.x, b.z),
        })),
      ];

      const steppedList: Array<{
        agent: SimAgent;
        prevX: number;
        prevZ: number;
        curX: number;
        curZ: number;
        vx: number;
        vz: number;
        res: ReturnType<typeof stepCityAmbientNpcSchedule>;
      }> = [];

      for (const a of agents) {
        const prevX = a.x;
        const prevZ = a.z;
        const selfG = getTerrainElevation(a.x, a.z);
        const res = stepCityAmbientNpcSchedule({
          preset: a.preset,
          x: a.x,
          z: a.z,
          yaw: a.yaw,
          waypointIdx: a.wpIdx,
          pauseTimer: a.pauseTimer,
          elapsedSec: s * dt,
          dt,
          navGrid: pedestrianGrid,
          navPath: a.navPath,
          navWaypointIndex: a.navWpIdx,
          navPathGoalKey: a.goalKey,
          stuckTimer: a.stuckTimer,
          lastProgressX: a.lastPX,
          lastProgressZ: a.lastPZ,
          avoidSide: a.avoidSide,
          avoidTimer: a.avoidTimer,
          isDirectTargetClear: (fx, fz, tx, tz, isSit) =>
            isSegmentClearOfAuditedStaticObstacles2D({
              fromX: fx,
              fromZ: fz,
              toX: tx,
              toZ: tz,
              radius: AMBIENT_NPC_CAPSULE_RADIUS,
              audited,
              exemptSeatPoint: isSit ? { x: tx, z: tz } : null,
            }),
          localAvoidance: (sample) =>
            computeLocalPedestrianAvoidance2D({
              selfId: a.preset.id,
              x: sample.x,
              z: sample.z,
              dirX: sample.dirX,
              dirZ: sample.dirZ,
              radius: AMBIENT_NPC_CAPSULE_RADIUS,
              selfGroundY: selfG,
              distToSteerTarget: sample.distToSteer,
              distToFinal: sample.distToFinal,
              isFinalGoal: sample.isFinalTarget,
              dt,
              audited,
              characterCapsules: capsules,
              stayOffNonCrosswalkRoads: true,
              avoidSide: sample.avoidSide,
              avoidTimer: sample.avoidTimer,
            }),
          canReplan: true,
        });

        let curX = res.x;
        let curZ = res.z;
        let vx = res.isMoving ? (curX - prevX) / dt : 0;
        let vz = res.isMoving ? (curZ - prevZ) / dt : 0;
        const col = resolveGroundMoverAuditedCollisions2D({
          x: curX,
          z: curZ,
          vx,
          vz,
          radius: AMBIENT_NPC_CAPSULE_RADIUS,
          audited,
          prevX,
          prevZ,
          waterMarginM: 0.22,
          restitution: 0,
          iterations: 2,
          stayOffNonCrosswalkRoads: true,
        });
        curX = col.x;
        curZ = col.z;
        vx = col.vx;
        vz = col.vz;
        const sg = resolveStaircaseAndElevationGuard2D({
          prevX,
          prevZ,
          nextX: curX,
          nextZ: curZ,
          vx,
          vz,
          radius: AMBIENT_NPC_CAPSULE_RADIUS,
        });
        curX = sg.x;
        curZ = sg.z;
        steppedList.push({ agent: a, prevX, prevZ, curX, curZ, vx: sg.vx, vz: sg.vz, res });
      }

      const cluster: CharacterCapsuleBody2D[] = [
        ...steppedList.map((st) => ({
          id: st.agent.preset.id,
          x: st.curX,
          z: st.curZ,
          vx: st.vx,
          vz: st.vz,
          radius: AMBIENT_NPC_CAPSULE_RADIUS,
          groundY: getTerrainElevation(st.curX, st.curZ),
        })),
        ...staticBlockers.map((b) => ({
          id: b.id,
          x: b.x,
          z: b.z,
          vx: 0,
          vz: 0,
          radius: b.radius,
          groundY: b.groundY ?? getTerrainElevation(b.x, b.z),
          immovable: true,
        })),
      ];
      resolveMultiIterationCapsuleCluster2D(cluster, 3);

      for (let i = 0; i < steppedList.length; i++) {
        const st = steppedList[i];
        const body = cluster[i];
        const a = st.agent;
        const res = st.res;
        let finalX = body.x;
        let finalZ = body.z;
        if (Math.abs(finalX - st.curX) > 1e-4 || Math.abs(finalZ - st.curZ) > 1e-4) {
          const post = resolveGroundMoverAuditedCollisions2D({
            x: finalX,
            z: finalZ,
            vx: body.vx,
            vz: body.vz,
            radius: AMBIENT_NPC_CAPSULE_RADIUS,
            audited,
            prevX: st.curX,
            prevZ: st.curZ,
            waterMarginM: 0.22,
            restitution: 0,
            iterations: 1,
            stayOffNonCrosswalkRoads: true,
          });
          finalX = post.x;
          finalZ = post.z;
        }
        const disp = Math.hypot(finalX - st.prevX, finalZ - st.prevZ);
        const actSpeed = disp / dt;
        const ratio = res.isMoving && res.speedMps * dt > 1e-4 ? disp / (res.speedMps * dt) : 0;
        const effMoving = res.isMoving && actSpeed >= 0.22 && ratio >= 0.18;
        if (effMoving && disp < 0.01) a.inPlaceAnimFrames++;
        if (effMoving) a.walkCycle += dt * 6.4 * Math.max(0.32, Math.min(1.05, ratio));
        if (evaluateRoadNetworkSdf(finalX, finalZ) <= -0.1 && !isPointOnPedestrianCrosswalkCorridor(finalX, finalZ)) {
          a.asphaltFrames++;
        }

        const prevWp = a.wpIdx;
        a.x = finalX;
        a.z = finalZ;
        a.yaw = res.yaw;
        a.wpIdx = res.waypointIdx;
        a.pauseTimer = res.pauseTimer;
        a.isMoving = effMoving;
        a.speedMps = effMoving ? actSpeed : 0;
        a.navPath = res.navPath;
        a.navWpIdx = res.navWaypointIndex;
        a.goalKey = res.navPathGoalKey;
        a.stuckTimer = res.stuckTimer;
        a.lastPX = res.lastProgressX;
        a.lastPZ = res.lastProgressZ;
        a.avoidSide = res.avoidSide;
        a.avoidTimer = res.avoidTimer;
        if (a.wpIdx !== prevWp) {
          a.reachedTarget = true;
        }
      }
    }
  };

  const makeAgent = (
    baseId: string,
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number,
  ): SimAgent => {
    const basePreset = CITY_AMBIENT_NPC_PRESETS.find((p) => p.id === baseId)!;
    return {
      preset: {
        ...basePreset,
        waypoints: [
          { x: startX, z: startZ, yaw: 0, activity: 'sightseeing', durationSec: 12 },
          { x: goalX, z: goalZ, yaw: 0, activity: 'sightseeing', durationSec: 12 },
        ],
      },
      x: startX,
      z: startZ,
      yaw: 0,
      wpIdx: 1,
      pauseTimer: 0,
      navPath: [],
      navWpIdx: 0,
      goalKey: '',
      stuckTimer: 0,
      lastPX: startX,
      lastPZ: startZ,
      avoidSide: 0,
      avoidTimer: 0,
      isMoving: false,
      speedMps: 0,
      reachedTarget: false,
      inPlaceAnimFrames: 0,
      asphaltFrames: 0,
      walkCycle: 0,
    };
  };

  // A. Halte Plaza (sign_halte_plaza -56.25,-2.8 + lobby_tram_shelter_windbreak z=4.6 + standing NPC):
  // Mira starts near shelter corner/pole heading West past a standing blocker while Raka crosses past her heading East
  const mira = makeAgent('citizen_mira', -55.4, -2.5, -59.8, -3.2);
  const raka = makeAgent('city_plaza_raka', -59.5, -2.8, -52.8, -2.8);
  runHalteSimulation(
    [mira, raka],
    [{ id: 'standing_commuter', x: -57.2, z: -3.0, radius: AMBIENT_NPC_CAPSULE_RADIUS }],
    12.0,
  );
  assert.equal(mira.reachedTarget, true, 'Mira must escape Halte Plaza pole+shelter+commuter pinch and reach destination');
  assert.equal(raka.reachedTarget, true, 'Raka must steer around Halte Plaza pole+Mira+commuter and reach destination');
  assert.equal(mira.inPlaceAnimFrames, 0, 'Mira must never animate running in place');
  assert.equal(raka.inPlaceAnimFrames, 0, 'Raka must never animate running in place');
  assert.equal(mira.asphaltFrames, 0);
  assert.equal(raka.asphaltFrames, 0);

  // B. Halte South Res (sign_halte_south_res -46.30,43.72 + south_residence_shelter_windbreak + standing player):
  // Tari walks along South Res sidewalk straight toward the pole and standing player
  const tari = makeAgent('citizen_tari', -50.5, 43.65, -41.5, 43.65);
  runHalteSimulation(
    [tari],
    [{ id: 'standing_player', x: -46.3, z: 42.4, radius: PLAYER_FOOT_CAPSULE_RADIUS }],
    12.0,
  );
  assert.equal(tari.reachedTarget, true, 'Tari must cleanly steer around sign_halte_south_res and standing player');
  assert.equal(tari.inPlaceAnimFrames, 0, 'Tari must never run in place');
  assert.equal(tari.asphaltFrames, 0, 'Tari must stay off non-crosswalk asphalt when steering around curb pole');
});

test('stepCityAmbientNpcSchedule guards <=3.8m direct target behind pole and replans within 0.65s when stalled', () => {
  const { audited, pedestrianGrid } = buildArenaGridWithAuditedWorld();
  const baseMira = CITY_AMBIENT_NPC_PRESETS.find((p) => p.id === 'citizen_mira')!;
  const poleRoutePreset: CityAmbientNpcPreset = {
    ...baseMira,
    waypoints: [
      { x: -61.84, z: -4.6, yaw: 0, activity: 'sightseeing', durationSec: 10 },
      { x: -61.84, z: -1.2, yaw: 0, activity: 'sightseeing', durationSec: 10 },
    ],
  };

  // 1. Even with distToFinal = 3.4 <= 3.8m, direct segment through sign_halte_plaza (-61.84, -2.98)
  // must NOT cut straight along x=-61.84; A* + local avoidance steers laterally around the pole.
  const firstStep = stepCityAmbientNpcSchedule({
    preset: poleRoutePreset,
    x: -61.84,
    z: -4.6,
    yaw: 0,
    waypointIdx: 1,
    pauseTimer: 0,
    elapsedSec: 0,
    dt: 0.1,
    navGrid: pedestrianGrid,
    isDirectTargetClear: (fx, fz, tx, tz, isSit) =>
      isSegmentClearOfAuditedStaticObstacles2D({
        fromX: fx,
        fromZ: fz,
        toX: tx,
        toZ: tz,
        radius: AMBIENT_NPC_CAPSULE_RADIUS,
        audited,
        exemptSeatPoint: isSit ? { x: tx, z: tz } : null,
      }),
    localAvoidance: (sample) =>
      computeLocalPedestrianAvoidance2D({
        selfId: poleRoutePreset.id,
        x: sample.x,
        z: sample.z,
        dirX: sample.dirX,
        dirZ: sample.dirZ,
        radius: AMBIENT_NPC_CAPSULE_RADIUS,
        distToSteerTarget: sample.distToSteer,
        distToFinal: sample.distToFinal,
        isFinalGoal: sample.isFinalTarget,
        dt: 0.1,
        audited,
        stayOffNonCrosswalkRoads: true,
        avoidSide: sample.avoidSide,
        avoidTimer: sample.avoidTimer,
      }),
  });
  assert.ok(
    Math.abs(firstStep.x - -61.84) > 0.02,
    `Expected lateral detour off x=-61.84 around sign_halte_plaza, got x=${firstStep.x.toFixed(4)}`,
  );

  // 2. When position fails to advance > 0.35m for > 0.6s, replan triggers cleanly and flips avoidSide
  let replannedAtStall = false;
  const stalledStep = stepCityAmbientNpcSchedule({
    preset: poleRoutePreset,
    x: -61.84,
    z: -4.6,
    yaw: 0,
    waypointIdx: 1,
    pauseTimer: 0,
    elapsedSec: 0.7,
    dt: 0.1,
    navGrid: pedestrianGrid,
    navPath: [{ x: -60.5, z: -3.0 }, { x: -61.84, z: -1.2 }],
    navWaypointIndex: 0,
    navPathGoalKey: '1:-61.84,-1.2',
    stuckTimer: 0.58,
    lastProgressX: -61.84,
    lastProgressZ: -4.6,
    avoidSide: 1,
    avoidTimer: 0.3,
    canReplan: true,
    onReplan: () => {
      replannedAtStall = true;
    },
  });
  assert.equal(replannedAtStall, true, 'Must trigger stuck replan around 0.6s instead of waiting 1.8s');
  assert.equal(stalledStep.avoidSide, -1, 'Stuck replan must flip avoidSide to try opposite detour');
  assert.equal(stalledStep.stuckTimer, 0);
});

test('Beach Club height-aware retaining walls, planters, deduplicated OBBs & multi-axis staircases behave cleanly across terrace levels', () => {
  const base = buildTestBaseStructures();
  const audited = getAuditedStaticWorldStructures(base);

  // Zero duplicate static OBB IDs
  const seenIds = new Set<string>();
  for (const st of audited.obbs) {
    assert.equal(seenIds.has(st.id), false, `Duplicate static OBB id ${st.id}`);
    seenIds.add(st.id);
  }

  // Every Beach Club stair flight is synced into WORLD_STAIRCASE_CORRIDORS
  for (const sf of BEACH_CLUB_MASTERPLAN.stairFlights) {
    const corr = WORLD_STAIRCASE_CORRIDORS.find((c) => c.id === `beach_club_${sf.id}`);
    assert.ok(corr, `Missing WORLD_STAIRCASE_CORRIDORS entry for ${sf.id}`);
    assert.equal(corr.axis, sf.axis);
  }

  // Height-aware helper unit checks
  assert.equal(isStaticColliderBelowMoverFeet(0.56, 0.64, true), true);
  assert.equal(isStaticColliderBelowMoverFeet(0.56, -0.56, true), false);
  assert.equal(isStaticColliderBelowMoverFeet(-1.06, -0.96, true), true);
  assert.equal(isStaticColliderBelowMoverFeet(-1.06, -2.0, true), false);
  assert.equal(isStaticColliderBelowMoverFeet(3.5, 2.5, true), false);

  // 1. VIP Mezzanine (+0.64m) vs South Lounge (-0.56m) retaining wall (heightY = 0.56m):
  //    Upper terrace walk near edge MUST NOT snag on retaining wall below feet.
  const upperVipWalk = resolveGroundMoverAuditedCollisions2D({
    x: 96.0,
    z: 22.0,
    vx: 0,
    vz: 2.0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
    audited,
  });
  assert.equal(upperVipWalk.collided, false, 'Retaining wall below VIP Mezzanine (+0.64m) must not block upper terrace walk');

  //    Lower terrace (-0.56m) pressing west into retaining wall MUST be blocked solidly.
  const lowerLoungeWall = resolveGroundMoverAuditedCollisions2D({
    x: 96.8,
    z: 22.0,
    vx: -2.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
    audited,
  });
  assert.equal(lowerLoungeWall.collided, true, 'Retaining wall must block movers pressing from lower South Lounge (-0.56m)');
  assert.ok(lowerLoungeWall.x > 96.8);

  // 2. Oceanfront Infinity Weir retaining wall (heightY = -1.06m):
  //    Beach Sand (-2.00m) pressing west into weir MUST be blocked solidly (both directly on sand and on fast approach).
  const sandWeirWall = resolveGroundMoverAuditedCollisions2D({
    x: 121.45,
    z: -30.0,
    vx: -2.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
    audited,
  });
  assert.equal(sandWeirWall.collided, true, 'Oceanfront infinity weir retaining wall must block movers from -2.00m Beach Sand');
  assert.ok(sandWeirWall.x > 121.45);

  const sandFastStepWeirWall = resolveGroundMoverAuditedCollisions2D({
    x: 121.3,
    z: -30.0,
    prevX: 121.8,
    prevZ: -30.0,
    vx: -2.0,
    vz: 0,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
    audited,
  });
  assert.equal(sandFastStepWeirWall.collided, true, 'Fast step from -2.00m sand into oceanfront weir must remain blocked');
  assert.ok(sandFastStepWeirWall.x > 121.3);

  // 3. Lower-terrace planter bc_planter_mid_w (topY = -0.03m) blocks -0.56m Mid Lagoon without blocking +0.64m VIP Mezzanine
  assert.equal(
    isSegmentClearOfAuditedStaticObstacles2D({
      fromX: 99.1,
      fromZ: -35.0,
      toX: 99.1,
      toZ: -29.0,
      radius: 0.48,
      audited,
    }),
    true,
    'Upper +0.64m VIP Mezzanine walk must ignore lower-terrace bc_planter_mid_w (topY=-0.03)',
  );

  // 4. Both X-axis and Z-axis Beach Club staircases permit smooth ascents/descents without cheek clamping
  const zStairStep = resolveStaircaseAndElevationGuard2D({
    prevX: 95.5,
    prevZ: -88.5,
    nextX: 95.5,
    nextZ: -87.5,
    vx: 0,
    vz: 2.5,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(zStairStep.clamped, false, 'Z-axis Beach Club stair_cascade_w1 must not clamp Z progression');

  const kaiJoinStep = resolveStaircaseAndElevationGuard2D({
    prevX: 88.0,
    prevZ: 44.2,
    nextX: 88.0,
    nextZ: 45.8,
    vx: 0,
    vz: 2.5,
    radius: PLAYER_FOOT_CAPSULE_RADIUS,
  });
  assert.equal(kaiJoinStep.clamped, false, 'Wide Z-axis stair_prom_kai_boardwalk must stay open and unclamped');
});
