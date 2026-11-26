import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NPC_POST_INTERACTION_LINGER_DURATION_SEC,
  NPC_POST_INTERACTION_LINGER_MAX_DIST_M,
  createIdleNpcLingerState,
  findNearestWaypointIndex,
  resetNpcLingerTimer,
  stepNpcPostInteractionLinger,
} from './npcPostInteractionLinger';

const SAMPLE_WAYPOINTS = [
  { x: 0, z: 0 },
  { x: 20, z: 0 },
  { x: 40, z: 10 },
  { x: 10, z: 25 },
] as const;

test('WS10 linger sets 25s timer on dialogue close, faces player, and ignores non-named ambient citizens', () => {
  assert.equal(NPC_POST_INTERACTION_LINGER_DURATION_SEC, 25);
  assert.equal(NPC_POST_INTERACTION_LINGER_MAX_DIST_M, 15);

  // Named NPC dialogue closes -> enters linger
  const closed = stepNpcPostInteractionLinger({
    state: createIdleNpcLingerState(),
    npcId: 'city_plaza_nadia',
    wasTalking: true,
    isTalking: false,
    npcX: 21,
    npcZ: 1,
    npcYaw: 0,
    playerX: 21,
    playerZ: 4,
    waypoints: SAMPLE_WAYPOINTS,
    dt: 0.1,
  });
  assert.equal(closed.isLingering, true);
  assert.equal(closed.endedThisFrame, false);
  assert.ok(Math.abs(closed.state.remainingSec - 24.9) < 0.01);
  assert.notEqual(closed.yaw, 0, 'NPC should smoothly turn toward player while lingering');

  // Ambient citizen (Raka) does NOT enter named-NPC linger
  const ambient = stepNpcPostInteractionLinger({
    state: createIdleNpcLingerState(),
    npcId: 'city_plaza_raka',
    wasTalking: true,
    isTalking: false,
    npcX: 21,
    npcZ: 1,
    npcYaw: 0,
    playerX: 21,
    playerZ: 4,
    waypoints: SAMPLE_WAYPOINTS,
    dt: 0.1,
  });
  assert.equal(ambient.isLingering, false);
  assert.equal(ambient.state.active, false);
});

test('WS10 linger resets timer on new interaction (gift / emotion / reopen)', () => {
  let state = createIdleNpcLingerState();
  // Start linger on close
  let res = stepNpcPostInteractionLinger({
    state,
    npcId: 'citizen_mira',
    wasTalking: true,
    isTalking: false,
    npcX: 21,
    npcZ: 1,
    npcYaw: 0,
    playerX: 23,
    playerZ: 1,
    waypoints: SAMPLE_WAYPOINTS,
    dt: 0.1,
  });
  state = res.state;
  // Advance 10 seconds
  for (let i = 0; i < 40; i++) {
    res = stepNpcPostInteractionLinger({
      state,
      npcId: 'citizen_mira',
      wasTalking: false,
      isTalking: false,
      npcX: 21,
      npcZ: 1,
      npcYaw: res.yaw,
      playerX: 23,
      playerZ: 1,
      waypoints: SAMPLE_WAYPOINTS,
      dt: 0.25,
    });
    state = res.state;
  }
  assert.ok(state.remainingSec < 16);

  // Gift / emotion reaction resets timer back to full 25s
  state = resetNpcLingerTimer(state, 'citizen_mira');
  assert.equal(state.active, true);
  assert.equal(state.remainingSec, 25);
});

test('WS10 linger ends early when player moves > 15m away and resumes at nearest waypoint', () => {
  const started = stepNpcPostInteractionLinger({
    state: createIdleNpcLingerState(),
    npcId: 'citizen_tari',
    wasTalking: true,
    isTalking: false,
    npcX: 21,
    npcZ: 1,
    npcYaw: 0,
    playerX: 23,
    playerZ: 1,
    waypoints: SAMPLE_WAYPOINTS,
    dt: 0.1,
  });
  assert.equal(started.isLingering, true);

  // Player walks 16m away (> 15m threshold) -> ends early, resumes at nearest waypoint (index 1: (20, 0))
  const far = stepNpcPostInteractionLinger({
    state: started.state,
    npcId: 'citizen_tari',
    wasTalking: false,
    isTalking: false,
    npcX: 21,
    npcZ: 1,
    npcYaw: started.yaw,
    playerX: 37.5,
    playerZ: 1,
    waypoints: SAMPLE_WAYPOINTS,
    dt: 0.1,
  });
  assert.equal(far.isLingering, false);
  assert.equal(far.endedThisFrame, true);
  assert.equal(far.endReason, 'player_far');
  assert.equal(far.resumeWaypointIdx, 1);
  assert.equal(findNearestWaypointIndex(SAMPLE_WAYPOINTS, 38, 9), 2);
});

test('WS10 linger expires after 25s and resumes patrol at nearest waypoint without teleporting', () => {
  let res = stepNpcPostInteractionLinger({
    state: createIdleNpcLingerState(),
    npcId: 'citizen_kenji',
    wasTalking: true,
    isTalking: false,
    npcX: 9,
    npcZ: 24,
    npcYaw: 0,
    playerX: 11,
    playerZ: 24,
    waypoints: SAMPLE_WAYPOINTS,
    dt: 0.25,
  });
  let state = res.state;
  for (let i = 0; i < 99; i++) {
    res = stepNpcPostInteractionLinger({
      state,
      npcId: 'citizen_kenji',
      wasTalking: false,
      isTalking: false,
      npcX: 9,
      npcZ: 24,
      npcYaw: res.yaw,
      playerX: 11,
      playerZ: 24,
      waypoints: SAMPLE_WAYPOINTS,
      dt: 0.25,
    });
    state = res.state;
  }
  assert.equal(res.isLingering, false);
  assert.equal(res.endedThisFrame, true);
  assert.equal(res.endReason, 'expired');
  assert.equal(res.resumeWaypointIdx, 3); // nearest to (9, 24) is (10, 25)
});
