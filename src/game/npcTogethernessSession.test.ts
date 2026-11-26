import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyNpcClosenessStore,
  getNpcClosenessRecord,
  recordNpcConversation,
  type NpcClosenessStore,
} from './npcClosenessEngine';
import { EMPTY_NPC_TOGETHERNESS_STATE } from './npcTogetherness';
import {
  normalizeNpcChatAction,
} from './npcTextChat';
import {
  canStartDirectPairedPoseForTarget,
  detectChatTogethernessIntent,
  evaluateNpcGiftSubmission,
  evaluatePairedPoseRequest,
  evaluateTogethernessInvitation,
  resolveChatTogethernessOptions,
  shouldForceEndTogethernessSession,
  stepNpcApproachVehicleForRide,
} from './npcTogethernessSession';

function buildStoreWithScore(
  npcId: 'hana' | 'kai' | 'mira' | 'nadia' | 'tari' | 'bima' | 'kenji',
  targetScore: number,
): NpcClosenessStore {
  let store = createEmptyNpcClosenessStore();
  let remaining = targetScore;
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);
  while (remaining > 0) {
    const step = Math.min(12, remaining);
    const res = recordNpcConversation(store, npcId, {
      closenessDelta: step,
      nowMs,
      dateKey: '2026-11-26',
    });
    store = res.store;
    remaining -= step;
  }
  return store;
}

test('WS12 contextual options: scooter bike offers ride, on foot offers walk, kick scooter never offers ride', () => {
  const onBike = resolveChatTogethernessOptions({
    npcId: 'nadia',
    playerScooterKind: 'electric_scooter_bike',
    togethernessState: EMPTY_NPC_TOGETHERNESS_STATE,
  });
  assert.equal(onBike.canInviteRide, true);
  assert.equal(onBike.canInviteWalk, false);
  assert.equal(onBike.showGetOffOption, false);

  const onFoot = resolveChatTogethernessOptions({
    npcId: 'nadia',
    playerScooterKind: null,
    togethernessState: EMPTY_NPC_TOGETHERNESS_STATE,
  });
  assert.equal(onFoot.canInviteWalk, true);
  assert.equal(onFoot.canInviteRide, false);
  assert.equal(onFoot.showGetOffOption, false);

  const onKickScooter = resolveChatTogethernessOptions({
    npcId: 'nadia',
    playerScooterKind: 'push_kick_scooter',
    togethernessState: EMPTY_NPC_TOGETHERNESS_STATE,
  });
  assert.equal(onKickScooter.canInviteRide, false);
  assert.equal(onKickScooter.canInviteWalk, false);

  const whileRiding = resolveChatTogethernessOptions({
    npcId: 'nadia',
    playerScooterKind: 'electric_scooter_bike',
    togethernessState: {
      ...EMPTY_NPC_TOGETHERNESS_STATE,
      ridingNpcId: 'nadia',
    },
  });
  assert.equal(whileRiding.canInviteRide, false);
  assert.equal(whileRiding.showGetOffOption, true);
  assert.equal(whileRiding.getOffLabel, 'Get off here');
});

test('WS12 invitation decision: accepts at/above required band, refuses below with scripted line and zero closeness cost', () => {
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);

  // Friendly band (score 45) -> refuses walk and ride, costs 0 closeness
  const friendlyStore = buildStoreWithScore('mira', 45);
  const beforeScore = getNpcClosenessRecord(friendlyStore, 'mira').score;
  const walkRefusal = evaluateTogethernessInvitation({
    store: friendlyStore,
    npcId: 'mira',
    kind: 'walk',
    playerScooterKind: null,
    nowMs,
  });
  assert.equal(walkRefusal.accepted, false);
  assert.equal(walkRefusal.reason, 'closeness_too_low');
  assert.equal(walkRefusal.band, 'friendly');
  assert.ok(walkRefusal.replyLine.length > 10);
  assert.equal(getNpcClosenessRecord(friendlyStore, 'mira').score, beforeScore);

  // Close band (score 70 >= 68) -> accepts walk, refuses ride
  const closeStore = buildStoreWithScore('mira', 70);
  const walkAccept = evaluateTogethernessInvitation({
    store: closeStore,
    npcId: 'mira',
    kind: 'walk',
    playerScooterKind: null,
    nowMs,
  });
  assert.equal(walkAccept.accepted, true);
  assert.equal(walkAccept.reason, null);

  const rideRefusal = evaluateTogethernessInvitation({
    store: closeStore,
    npcId: 'mira',
    kind: 'ride',
    playerScooterKind: 'electric_scooter_bike',
    nowMs,
  });
  assert.equal(rideRefusal.accepted, false);
  assert.equal(rideRefusal.reason, 'closeness_too_low');
  assert.ok(rideRefusal.replyLine.length > 10);

  // Trusted band (score 90 >= 85) -> accepts ride on scooter bike, rejects kick scooter
  const trustedStore = buildStoreWithScore('mira', 90);
  const rideAccept = evaluateTogethernessInvitation({
    store: trustedStore,
    npcId: 'mira',
    kind: 'ride',
    playerScooterKind: 'electric_scooter_bike',
    nowMs,
  });
  assert.equal(rideAccept.accepted, true);
  assert.equal(rideAccept.reason, null);

  const kickScooterReject = evaluateTogethernessInvitation({
    store: trustedStore,
    npcId: 'mira',
    kind: 'ride',
    playerScooterKind: 'push_kick_scooter',
    nowMs,
  });
  assert.equal(kickScooterReject.accepted, false);
  assert.equal(kickScooterReject.reason, 'requires_electric_scooter_bike');
});

test('WS12 forced session ends mirror player rules (interior, warzone, fishing, dismount)', () => {
  const okRide = shouldForceEndTogethernessSession({
    mode: 'ride',
    worldMode: 'safezone',
    isInInterior: false,
    isFishing: false,
    playerScooterKind: 'electric_scooter_bike',
    playerAlive: true,
  });
  assert.equal(okRide.shouldEnd, false);

  const inInterior = shouldForceEndTogethernessSession({
    mode: 'ride',
    worldMode: 'safezone',
    isInInterior: true,
    isFishing: false,
    playerScooterKind: 'electric_scooter_bike',
    playerAlive: true,
  });
  assert.equal(inInterior.shouldEnd, true);
  assert.equal(inInterior.reason, 'entered_interior');

  const inWarzone = shouldForceEndTogethernessSession({
    mode: 'walk',
    worldMode: 'warzone',
    isInInterior: false,
    isFishing: false,
    playerScooterKind: null,
    playerAlive: true,
  });
  assert.equal(inWarzone.shouldEnd, true);
  assert.equal(inWarzone.reason, 'entered_warzone');

  const fishing = shouldForceEndTogethernessSession({
    mode: 'ride',
    worldMode: 'safezone',
    isInInterior: false,
    isFishing: true,
    playerScooterKind: 'electric_scooter_bike',
    playerAlive: true,
  });
  assert.equal(fishing.shouldEnd, true);
  assert.equal(fishing.reason, 'started_fishing');

  const dismounted = shouldForceEndTogethernessSession({
    mode: 'ride',
    worldMode: 'safezone',
    isInInterior: false,
    isFishing: false,
    playerScooterKind: null,
    playerAlive: true,
  });
  assert.equal(dismounted.shouldEnd, true);
  assert.equal(dismounted.reason, 'scooter_dismounted');

  const switchedToKick = shouldForceEndTogethernessSession({
    mode: 'ride',
    worldMode: 'safezone',
    isInInterior: false,
    isFishing: false,
    playerScooterKind: 'push_kick_scooter',
    playerAlive: true,
  });
  assert.equal(switchedToKick.shouldEnd, true);
  assert.equal(switchedToKick.reason, 'scooter_dismounted');
});

test('WS12 ride mount approach walks NPC toward vehicle pillion before mounting', () => {
  const step1 = stepNpcApproachVehicleForRide({
    npcX: 0,
    npcZ: 0,
    npcYaw: 0,
    pillionX: 4,
    pillionZ: 0,
    dt: 0.5,
    elapsedSec: 0.5,
  });
  assert.equal(step1.reachedMount, false);
  assert.equal(step1.isMoving, true);
  assert.ok(step1.x > 0 && step1.x < 4);

  const closeStep = stepNpcApproachVehicleForRide({
    npcX: 3.1,
    npcZ: 0,
    npcYaw: 0,
    pillionX: 4,
    pillionZ: 0,
    dt: 0.1,
    elapsedSec: 1.5,
  });
  assert.equal(closeStep.reachedMount, true);
});

test('WS13 paired pose request enforces closeness band and blocks direct named-NPC bypass', () => {
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);

  // Below pair_pose unlock (score 30 < 45)
  const lowStore = buildStoreWithScore('nadia', 30);
  const beforeScore = getNpcClosenessRecord(lowStore, 'nadia').score;
  const refused = evaluatePairedPoseRequest({
    store: lowStore,
    npcId: 'nadia',
    nowMs,
  });
  assert.equal(refused.accepted, false);
  assert.equal(refused.reason, 'closeness_too_low');
  assert.ok(refused.replyLine.length > 10);
  assert.equal(getNpcClosenessRecord(lowStore, 'nadia').score, beforeScore);
  assert.equal(
    canStartDirectPairedPoseForTarget({
      store: lowStore,
      targetId: 'city_plaza_nadia',
      nowMs,
    }),
    false,
  );
  // Non-named multiplayer peer is NOT blocked
  assert.equal(
    canStartDirectPairedPoseForTarget({
      store: lowStore,
      targetId: 'remote_player_session_123',
      nowMs,
    }),
    true,
  );

  // At/above pair_pose unlock (score 50 >= 45)
  const unlockedStore = buildStoreWithScore('nadia', 50);
  const accepted = evaluatePairedPoseRequest({
    store: unlockedStore,
    npcId: 'nadia',
    nowMs,
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.reason, null);
  assert.equal(
    canStartDirectPairedPoseForTarget({
      store: unlockedStore,
      targetId: 'city_plaza_nadia',
      nowMs,
    }),
    true,
  );
});

test('WS13 gift submission enforces 1-gift-per-day limit and always returns persona reaction + emotion', () => {
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);
  const dateKey = '2026-11-26';
  const initialStore = createEmptyNpcClosenessStore();

  const first = evaluateNpcGiftSubmission({
    store: initialStore,
    npcId: 'hana',
    itemInput: 'latte',
    nowMs,
    dateKey,
  });
  assert.equal(first.accepted, true);
  assert.equal(first.reactionTier, 'loved');
  assert.equal(first.emotion, 'happy');
  assert.ok(first.reactionLine.length > 10);
  assert.ok(
    getNpcClosenessRecord(first.store, 'hana').score >
      getNpcClosenessRecord(initialStore, 'hana').score,
  );

  // Second gift on the same day must be rejected by the daily limit
  const second = evaluateNpcGiftSubmission({
    store: first.store,
    npcId: 'hana',
    itemInput: 'croissant',
    nowMs,
    dateKey,
  });
  assert.equal(second.accepted, false);
  assert.equal(second.reason, 'already_gifted_today');
  assert.ok(second.reactionLine.length > 10);
  assert.equal(
    getNpcClosenessRecord(second.store, 'hana').score,
    getNpcClosenessRecord(first.store, 'hana').score,
  );
});

test('natural typed chat intent detects Indonesian & English walk/ride/end phrases without false positives', () => {
  assert.equal(detectChatTogethernessIntent('jalan bareng yuk!'), 'walk');
  assert.equal(detectChatTogethernessIntent('want to go for a walk together?'), 'walk');
  assert.equal(detectChatTogethernessIntent('bonceng yuk keliling kota'), 'ride');
  assert.equal(detectChatTogethernessIntent('wanna ride along on my scooter?'), 'ride');
  assert.equal(detectChatTogethernessIntent('turun di sini ya'), 'end');
  assert.equal(detectChatTogethernessIntent('let us get off here'), 'end');
  assert.equal(detectChatTogethernessIntent('halo, lagi ngapain hari ini?'), null);
  assert.equal(detectChatTogethernessIntent('nice weather in the plaza today'), null);
});

test('WS21 acceptance: mounted scooter bike free-chat invite -> verdict accept -> walk to pillion -> mount -> dismount ends ride', () => {
  const nowMs = Date.UTC(2026, 10, 27, 2, 0, 0);
  const store = buildStoreWithScore('hana', 90);

  // 1. Free-chat invitation while mounted on electric_scooter_bike beside NPC
  assert.equal(detectChatTogethernessIntent('bonceng yuk keliling kota'), 'ride');
  assert.equal(normalizeNpcChatAction('ride_together'), 'ride_together');
  assert.equal(normalizeNpcChatAction('walk_together'), 'walk_together');
  assert.equal(normalizeNpcChatAction('end_togetherness'), 'end_togetherness');
  assert.equal(normalizeNpcChatAction('unknown'), null);

  // 2. Upstream verdict accepts on scooter bike (never kick scooter)
  const kickDenied = evaluateTogethernessInvitation({
    store,
    npcId: 'hana',
    kind: 'ride',
    playerScooterKind: 'push_kick_scooter',
    nowMs,
  });
  assert.equal(kickDenied.accepted, false);

  const accepted = evaluateTogethernessInvitation({
    store,
    npcId: 'hana',
    kind: 'ride',
    playerScooterKind: 'electric_scooter_bike',
    nowMs,
  });
  assert.equal(accepted.accepted, true);
  assert.ok(accepted.replyLine.length > 0);

  // 3. NPC walks (no teleport) to pillion anchor behind bike and mounts
  let x = 0;
  let z = 0;
  let elapsed = 0;
  let mounted = false;
  for (let step = 0; step < 30 && !mounted; step++) {
    elapsed += 0.2;
    const res = stepNpcApproachVehicleForRide({
      npcX: x,
      npcZ: z,
      npcYaw: 0,
      pillionX: 3.5,
      pillionZ: 0,
      dt: 0.2,
      elapsedSec: elapsed,
    });
    if (step === 0) {
      assert.equal(res.reachedMount, false);
      assert.ok(res.x > 0 && res.x < 3.5);
    }
    x = res.x;
    z = res.z;
    mounted = res.reachedMount;
  }
  assert.equal(mounted, true);

  // 4. Player dismounts -> togetherness session ends cleanly
  const afterDismount = shouldForceEndTogethernessSession({
    mode: 'ride',
    worldMode: 'safezone',
    isInInterior: false,
    isFishing: false,
    playerScooterKind: null,
    playerAlive: true,
  });
  assert.equal(afterDismount.shouldEnd, true);
  assert.equal(afterDismount.reason, 'scooter_dismounted');
});


