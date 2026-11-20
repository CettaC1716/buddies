import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHAT_BUBBLE_TTL_MS,
  REMOTE_DEAD_RECKON_MAX_MS,
  REMOTE_DEAD_RECKON_MAX_OFFSET_M,
  computeLocalPoseBroadcastIntervalMs,
  computeZoneDistance2D,
  createPeerInterpolationState,
  createRemoteChatBubbleState,
  createRemoteEmoteState,
  getActiveRemoteChatBubble,
  getActiveRemoteEmoteClip,
  isFlatIndoorZoneKey,
  lerpShortestAngleRad,
  lerpZoneCoord,
  mergeRealtimeSocialChatMessage,
  mergeRemoteChatBubbleState,
  mergeRemoteEmoteState,
  normalizeAngleRad,
  parseSocialEmoteCommand,
  pushRemotePoseSample,
  reconcileWorldPeerPacket,
  resolveBubbleStyle,
  resolveContrastingTextColor,
  resolveLocalEmoteClip,
  shortestAngleDeltaRad,
  smoothAngleExpRad,
  stepRemoteAvatarInterpolation,
  type ReconcilablePeerPacket,
} from './buddiesRemotePresenceSync';
import { getPlanetShortestDelta, wrapPlanetCoord } from './buddiesPlanetCurvature';

describe('buddiesRemotePresenceSync', () => {
  it('classifies flat indoor zones (house:*, cafe:*, casino:*, salon:*) separately from outdoor world zones', () => {
    assert.equal(isFlatIndoorZoneKey('house:sample'), true);
    assert.equal(isFlatIndoorZoneKey('house:alice.testnet'), true);
    assert.equal(isFlatIndoorZoneKey('cafe:glasshouse'), true);
    assert.equal(isFlatIndoorZoneKey('casino:grand'), true);
    assert.equal(isFlatIndoorZoneKey('salon:beauty_glow'), true);
    assert.equal(isFlatIndoorZoneKey('city'), false);
    assert.equal(isFlatIndoorZoneKey('warzone'), false);
  });

  it('interpolates coordinates across toroidal wraparound seams and flat indoor spaces cleanly', () => {
    // Toroidal wraparound across +130 / -130 seam (period 260)
    const midSeam = lerpZoneCoord(128, -128, 0.5, false, 260);
    assert.ok(
      Math.abs(Math.abs(midSeam) - 130) < 1e-6,
      `Expected seam midpoint at +/-130, got ${midSeam}`,
    );

    const quarterSeam = lerpZoneCoord(128, -128, 0.25, false, 260);
    assert.ok(Math.abs(quarterSeam - 129) < 1e-6, `Expected 129, got ${quarterSeam}`);

    const threeQuarterSeam = lerpZoneCoord(128, -128, 0.75, false, 260);
    assert.ok(Math.abs(threeQuarterSeam - -129) < 1e-6, `Expected -129, got ${threeQuarterSeam}`);

    // Default outdoor uses buddiesPlanetCurvature wrapPlanetCoord & getPlanetShortestDelta
    assert.equal(
      lerpZoneCoord(120, 145, 1.0, false),
      wrapPlanetCoord(120 + getPlanetShortestDelta(145, 120)),
    );

    // Flat indoor interpolation is strictly linear and unclamped
    assert.equal(lerpZoneCoord(-4.0, 6.0, 0.25, true), -1.5);
    assert.equal(lerpZoneCoord(125, 145, 0.5, true), 135);
    assert.equal(computeZoneDistance2D(128, 0, -128, 0, false, 260), 4);
    assert.equal(computeZoneDistance2D(0, 0, 3, 4, true), 5);
  });

  it('performs shortest-angle yaw interpolation and exponential smoothing without +/-pi glitches', () => {
    assert.equal(normalizeAngleRad(Number.NaN), 0);
    assert.equal(normalizeAngleRad(Number.POSITIVE_INFINITY), 0);

    // Crossing +pi -> -pi
    const deltaPlus = shortestAngleDeltaRad(-3.1, 3.1);
    assert.ok(deltaPlus > 0 && deltaPlus < 0.1, `Expected small positive delta, got ${deltaPlus}`);
    const midPlus = lerpShortestAngleRad(3.1, -3.1, 0.5);
    assert.ok(Math.abs(Math.abs(midPlus) - Math.PI) < 1e-6, `Expected ~pi, got ${midPlus}`);

    // Crossing -pi -> +pi
    const deltaMinus = shortestAngleDeltaRad(3.1, -3.1);
    assert.ok(deltaMinus < 0 && deltaMinus > -0.1, `Expected small negative delta, got ${deltaMinus}`);
    const midMinus = lerpShortestAngleRad(-3.1, 3.1, 0.5);
    assert.ok(Math.abs(Math.abs(midMinus) - Math.PI) < 1e-6, `Expected ~pi, got ${midMinus}`);

    // Exponential yaw smoothing moves monotonically along shortest arc across +/-pi
    let yaw = 3.05;
    for (let i = 0; i < 20; i++) {
      const next = smoothAngleExpRad(yaw, -3.05, 1 / 60, 20);
      assert.ok(
        Math.abs(shortestAngleDeltaRad(-3.05, next)) <= Math.abs(shortestAngleDeltaRad(-3.05, yaw)) + 1e-9,
      );
      yaw = next;
    }
    assert.ok(Math.abs(shortestAngleDeltaRad(-3.05, yaw)) < 0.02);
  });

  it('orders snapshots, rejects stale packets, adapts to jitter, and smoothly handles idle transitions', () => {
    const state = createPeerInterpolationState();

    // Packet seq 1, 2, 3 arrive with jittery gaps; stale seq 2 duplicate is rejected
    assert.equal(
      pushRemotePoseSample(state, {
        seq: 1,
        x: 0,
        z: 0,
        vx: 8,
        vz: 0,
        yaw: 0,
        jumpOffset: 0,
        senderStampMs: 1000,
        receivedAtMs: 1000,
      }),
      true,
    );
    assert.equal(
      pushRemotePoseSample(state, {
        seq: 2,
        x: 0.7,
        z: 0,
        vx: 8,
        vz: 0,
        yaw: 0.1,
        jumpOffset: 0.2,
        senderStampMs: 1088,
        receivedAtMs: 1120,
      }),
      true,
    );
    // Out-of-order delayed seq 1 or duplicate seq 2 must be rejected
    assert.equal(
      pushRemotePoseSample(state, {
        seq: 2,
        x: 0.2,
        z: 0,
        vx: 8,
        vz: 0,
        yaw: 0,
        senderStampMs: 1088,
        receivedAtMs: 1130,
      }),
      false,
    );
    assert.equal(
      pushRemotePoseSample(state, {
        seq: 3,
        x: 1.4,
        z: 0,
        vx: 8,
        vz: 0,
        yaw: 0.2,
        jumpOffset: 0,
        senderStampMs: 1176,
        receivedAtMs: 1190,
      }),
      true,
    );
    assert.equal(state.samples.length, 3);

    // Step smoothly over frames (no backwards jumps despite jitter)
    let prevX = -1;
    for (let t = 1150; t <= 1300; t += 16) {
      const step = stepRemoteAvatarInterpolation(state, {
        nowMs: t,
        dtSec: 0.016,
        isFlatIndoor: false,
        fallbackPose: { x: 1.4, z: 0, vx: 8, vz: 0, yaw: 0.2, jumpOffset: 0 },
      });
      assert.ok(step.x >= prevX - 1e-6, `Expected monotonic X progression, prev=${prevX}, cur=${step.x}`);
      prevX = step.x;
    }

    // Immediate idle-stop packet settles cleanly without rubberbanding
    assert.equal(
      pushRemotePoseSample(state, {
        seq: 4,
        x: 1.5,
        z: 0,
        vx: 0,
        vz: 0,
        yaw: 0.2,
        jumpOffset: 0,
        senderStampMs: 1220,
        receivedAtMs: 1230,
      }),
      true,
    );
    for (let t = 1316; t <= 1600; t += 16) {
      stepRemoteAvatarInterpolation(state, {
        nowMs: t,
        dtSec: 0.016,
        isFlatIndoor: false,
        fallbackPose: { x: 1.5, z: 0, vx: 0, vz: 0, yaw: 0.2, jumpOffset: 0 },
      });
    }
    const settled = stepRemoteAvatarInterpolation(state, {
      nowMs: 1616,
      dtSec: 0.016,
      isFlatIndoor: false,
      fallbackPose: { x: 1.5, z: 0, vx: 0, vz: 0, yaw: 0.2, jumpOffset: 0 },
    });
    assert.ok(Math.abs(settled.x - 1.5) < 0.02, `Expected settled x ~ 1.5, got ${settled.x}`);
    assert.equal(settled.visualSpeedMps, 0);
    assert.equal(settled.isDeadReckoning, false);

    // Reconnect reset: low seq with significantly newer senderStampMs is accepted
    assert.equal(
      pushRemotePoseSample(state, {
        seq: 1,
        x: -20,
        z: 10,
        vx: 0,
        vz: 0,
        yaw: 0,
        jumpOffset: 0,
        senderStampMs: 4000,
        receivedAtMs: 4000,
      }),
      true,
    );
    const teleportStep = stepRemoteAvatarInterpolation(state, {
      nowMs: 4016,
      dtSec: 0.016,
      isFlatIndoor: false,
      fallbackPose: { x: -20, z: 10, vx: 0, vz: 0, yaw: 0, jumpOffset: 0 },
    });
    assert.equal(teleportStep.didTeleport, true);
    assert.equal(teleportStep.x, -20);
  });

  it('bounds and decays dead-reckoning during packet gaps and suppresses it when seated/sleeping', () => {
    const movingState = createPeerInterpolationState();
    pushRemotePoseSample(movingState, {
      seq: 1,
      x: 0,
      z: 0,
      vx: 10,
      vz: 0,
      yaw: 0,
      senderStampMs: 1000,
      receivedAtMs: 1000,
    });

    // Seed initialization
    stepRemoteAvatarInterpolation(movingState, {
      nowMs: 1000,
      dtSec: 0.016,
      isFlatIndoor: true,
      fallbackPose: { x: 0, z: 0, vx: 10, vz: 0, yaw: 0 },
    });

    // Advance into packet gap (playbackMs > receivedAtMs, within dead-reckon budget)
    let drStep = stepRemoteAvatarInterpolation(movingState, {
      nowMs: 1200,
      dtSec: 0.016,
      isFlatIndoor: true,
      fallbackPose: { x: 0, z: 0, vx: 10, vz: 0, yaw: 0 },
    });
    for (let t = 1216; t <= 1320; t += 16) {
      drStep = stepRemoteAvatarInterpolation(movingState, {
        nowMs: t,
        dtSec: 0.016,
        isFlatIndoor: true,
        fallbackPose: { x: 0, z: 0, vx: 10, vz: 0, yaw: 0 },
      });
    }
    assert.equal(drStep.isDeadReckoning, true);
    assert.ok(drStep.x > 0 && drStep.x <= REMOTE_DEAD_RECKON_MAX_OFFSET_M);
    assert.ok(drStep.vx < 10, 'Dead-reckoning velocity should decay exponentially');

    // Past maxDeadReckonMs: stops extrapolating cleanly
    const expiredDr = stepRemoteAvatarInterpolation(movingState, {
      nowMs: 1000 + movingState.adaptiveDelayMs + REMOTE_DEAD_RECKON_MAX_MS + 120,
      dtSec: 0.016,
      isFlatIndoor: true,
      fallbackPose: { x: 0, z: 0, vx: 10, vz: 0, yaw: 0 },
    });
    assert.equal(expiredDr.isDeadReckoning, false);
    assert.equal(expiredDr.vx, 0);

    // Seated peer must never dead-reckon even with stale velocity
    const seatedState = createPeerInterpolationState();
    pushRemotePoseSample(seatedState, {
      seq: 1,
      x: 5,
      z: 5,
      vx: 6,
      vz: 0,
      yaw: 0,
      senderStampMs: 1000,
      receivedAtMs: 1000,
      isSitting: true,
    });
    stepRemoteAvatarInterpolation(seatedState, {
      nowMs: 1000,
      dtSec: 0.016,
      isFlatIndoor: true,
      fallbackPose: { x: 5, z: 5, vx: 6, vz: 0, yaw: 0, isSitting: true },
    });
    const seatedStep = stepRemoteAvatarInterpolation(seatedState, {
      nowMs: 1220,
      dtSec: 0.016,
      isFlatIndoor: true,
      fallbackPose: { x: 5, z: 5, vx: 6, vz: 0, yaw: 0, isSitting: true },
    });
    assert.equal(seatedStep.isDeadReckoning, false);
    assert.equal(seatedStep.x, 5);
  });

  it('schedules immediate local pose broadcasts for stops, landings, emotes, and chat triggers', () => {
    const base = {
      zoneChanged: false,
      chatChanged: false,
      emoteChanged: false,
      discreteStateChanged: false,
      stoppedMoving: false,
      landedJump: false,
      yawDeltaRad: 0,
      isActivelyMoving: false,
    };
    assert.equal(computeLocalPoseBroadcastIntervalMs(base), 1100);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, isActivelyMoving: true }), 88);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, yawDeltaRad: 0.12 }), 45);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, discreteStateChanged: true }), 45);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, stoppedMoving: true }), 0);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, landedJump: true }), 0);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, emoteChanged: true }), 0);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, chatChanged: true }), 0);
    assert.equal(computeLocalPoseBroadcastIntervalMs({ ...base, zoneChanged: true }), 0);
  });

  it('manages emote slash commands, priority, re-triggers, presence protection, and expiry', () => {
    assert.equal(parseSocialEmoteCommand('/wave'), 'wave');
    assert.equal(parseSocialEmoteCommand('  /DANCE  '), 'dance');
    assert.equal(parseSocialEmoteCommand('hello /wave'), null);

    assert.equal(
      resolveLocalEmoteClip({
        isSleeping: false,
        cafeWorkPhase: 'idle',
        cafeCategory: 'drink',
        consumeItemId: null,
        isCafeWorker: false,
        isSitting: false,
        sitVariant: null,
        activeSocialEmoteClip: 'emote:wave',
      }),
      'emote:wave',
    );
    assert.equal(
      resolveLocalEmoteClip({
        isSleeping: true,
        cafeWorkPhase: 'idle',
        cafeCategory: 'drink',
        consumeItemId: 'iced_matcha',
        isCafeWorker: false,
        isSitting: false,
        sitVariant: null,
        activeSocialEmoteClip: 'emote:wave',
      }),
      'bed:sleep',
    );

    let emoteState = createRemoteEmoteState();
    emoteState = mergeRemoteEmoteState(
      emoteState,
      { emoteClip: 'emote:wave', emoteSeq: 1, emoteDurationMs: 2400 },
      1000,
    );
    assert.equal(getActiveRemoteEmoteClip(emoteState, 1500), 'emote:wave');

    // Coarse Presence sync with empty/stale clip must NOT cancel live broadcast emote
    emoteState = mergeRemoteEmoteState(
      emoteState,
      { emoteClip: '', emoteSeq: 0, fromPresence: true },
      1800,
    );
    assert.equal(getActiveRemoteEmoteClip(emoteState, 1800), 'emote:wave');

    // Auto-expires cleanly after durationMs so peers never stay stuck waving
    assert.equal(getActiveRemoteEmoteClip(emoteState, 3400), '');

    // Re-triggering the exact same emote with a higher seq starts a fresh window
    emoteState = mergeRemoteEmoteState(
      emoteState,
      { emoteClip: 'emote:wave', emoteSeq: 2, emoteDurationMs: 2400 },
      4000,
    );
    assert.equal(getActiveRemoteEmoteClip(emoteState, 4100), 'emote:wave');

    // Explicit clear from broadcast stops immediately
    emoteState = mergeRemoteEmoteState(
      emoteState,
      { emoteClip: '', emoteSeq: 3 },
      4300,
    );
    assert.equal(getActiveRemoteEmoteClip(emoteState, 4300), '');
  });

  it('preserves bubble colors, enforces bubble TTL/refresh, and blocks stale Presence resurrections', () => {
    assert.equal(resolveContrastingTextColor('#ffffff'), '#0f172a');
    assert.equal(resolveContrastingTextColor('#0f172a'), '#f8fafc');
    assert.deepEqual(resolveBubbleStyle('#fef08a', null), {
      bgColor: '#fef08a',
      textColor: '#0f172a',
    });

    let bubble = createRemoteChatBubbleState();
    bubble = mergeRemoteChatBubbleState(
      bubble,
      { text: 'Hello Plaza!', seq: 1, bgColor: '#0f172a', textColor: '#f8fafc' },
      10_000,
      DEFAULT_CHAT_BUBBLE_TTL_MS,
    );
    assert.deepEqual(getActiveRemoteChatBubble(bubble, 12_000), {
      text: 'Hello Plaza!',
      bgColor: '#0f172a',
      textColor: '#f8fafc',
      seq: 1,
    });

    // Expires cleanly after 7500ms
    assert.equal(getActiveRemoteChatBubble(bubble, 17_500), null);

    // Re-sending identical text with seq=2 refreshes full TTL
    bubble = mergeRemoteChatBubbleState(
      bubble,
      { text: 'Hello Plaza!', seq: 2, bgColor: '#fbcfe8', textColor: '#0f172a' },
      18_000,
      DEFAULT_CHAT_BUBBLE_TTL_MS,
    );
    assert.equal(getActiveRemoteChatBubble(bubble, 25_000)?.text, 'Hello Plaza!');
    assert.equal(getActiveRemoteChatBubble(bubble, 25_000)?.bgColor, '#fbcfe8');

    // Stale Presence sync with seq=1 must NOT overwrite or resurrect old bubble
    bubble = mergeRemoteChatBubbleState(
      bubble,
      { text: 'Old Text', seq: 1, fromPresence: true },
      26_000,
      DEFAULT_CHAT_BUBBLE_TTL_MS,
    );
    assert.equal(getActiveRemoteChatBubble(bubble, 26_000), null);
  });

  it('reconciles Broadcast vs Presence peer packets and deduplicates cross-transport chat rows', () => {
    const makePeer = (overrides: Partial<ReconcilablePeerPacket>): ReconcilablePeerPacket => ({
      sessionId: 'mp-peer-1',
      nearAccountId: 'peer.testnet',
      displayName: 'PEER',
      gender: 'female',
      team: 'blue',
      zoneKey: 'city',
      inWorld: true,
      x: 10,
      z: 20,
      vx: 3,
      vz: 0,
      yaw: 0.5,
      jumpOffset: 0,
      weaponId: 'unarmed',
      carryingCrate: 'none',
      isSitting: false,
      isDriving: false,
      isHiddenInVehicle: false,
      scooterKind: null,
      fishingPhase: 'idle',
      isReeling: false,
      rodBend: 0,
      hasClaimedBase: false,
      isCafeWorker: false,
      cafePreparing: false,
      level: 5,
      emoteClip: '',
      chatBubbleText: null,
      updatedAtMs: 2000,
      seq: 10,
      sentAtMs: 2000,
      ...overrides,
    });

    const freshBroadcast = makePeer({
      x: 15,
      emoteClip: 'emote:cheer',
      emoteSeq: 3,
      chatBubbleText: 'GG!',
      chatBubbleSeq: 2,
      updatedAtMs: 5000,
      seq: 12,
      sentAtMs: 5000,
    });
    const stalePresence = makePeer({
      x: 2,
      emoteClip: '',
      emoteSeq: 1,
      chatBubbleText: 'Old',
      chatBubbleSeq: 1,
      displayName: 'PEER NEWNAME',
      updatedAtMs: 5500,
      seq: 8,
      sentAtMs: 1800,
    });

    const merged = reconcileWorldPeerPacket(freshBroadcast, stalePresence, 'presence', 5500);
    assert.equal(merged.x, 15);
    assert.equal(merged.emoteClip, 'emote:cheer');
    assert.equal(merged.chatBubbleText, 'GG!');
    assert.equal(merged.displayName, 'PEER NEWNAME');
    assert.equal(merged.updatedAtMs, 5000);

    // Cross-transport chat dedup: Broadcast arrives first ('bc-...'), then DB INSERT ('uuid')
    const bcMsg = {
      id: 'bc-123',
      clientMsgId: 'bc-123',
      senderId: 'peer.testnet',
      senderName: 'PEER',
      text: 'See you at cafe!',
      timestamp: '11:00 AM',
      createdAtMs: 100_000,
      bubbleBgColor: '#fef08a',
      bubbleTextColor: '#0f172a',
      type: 'public' as const,
    };
    const dbMsg = {
      id: '550e8400-e29b-41d4-a716-446655440099',
      senderId: 'peer.testnet',
      senderName: 'PEER',
      text: 'See you at cafe!',
      timestamp: '11:00 AM',
      createdAtMs: 100_650,
      bubbleBgColor: '#fef08a',
      bubbleTextColor: '#0f172a',
      type: 'public' as const,
    };

    const step1 = mergeRealtimeSocialChatMessage([], bcMsg, {
      localPlayerName: 'ME',
      localPlayerUid: 'me.testnet',
      isOwnFn: () => false,
      simplifyNameFn: (s) => s.trim(),
    });
    assert.equal(step1.nextMessages.length, 1);
    assert.equal(step1.upgradedExisting, false);

    const step2 = mergeRealtimeSocialChatMessage(step1.nextMessages, dbMsg, {
      localPlayerName: 'ME',
      localPlayerUid: 'me.testnet',
      isOwnFn: () => false,
      simplifyNameFn: (s) => s.trim(),
    });
    assert.equal(step2.nextMessages.length, 1);
    assert.equal(step2.upgradedExisting, true);
    assert.equal(step2.nextMessages[0].id, dbMsg.id);
    assert.equal(step2.nextMessages[0].bubbleBgColor, '#fef08a');
  });
});
