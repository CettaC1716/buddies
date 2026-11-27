import assert from 'node:assert/strict';
import test from 'node:test';
import { handleNpcChatRequest } from '../../api/npc-chat';
import { NAMED_NPC_IDS } from './npcClosenessEngine';
import { isNpcEmotionTag } from './npcPersonaRegistry';
import { ensureAllNpcPersonasRegistered } from './personas/index';
import { buildLocalProactiveTopic } from './npcProactiveTopics';

const FORBIDDEN_INTERNAL_PATTERNS = [
  /\bcloseness\b/i,
  /\bstranger\b/i,
  /\bacquaintance\b/i,
  /\btrusted\b/i,
  /\bscore\b/i,
  /\b\d+\s*\/\s*100\b/,
];

test('buildLocalProactiveTopic creates grounded, non-empty starters for all 7 named NPCs without leaking closeness metrics', () => {
  ensureAllNpcPersonasRegistered();

  for (const npcId of NAMED_NPC_IDS) {
    const starter = buildLocalProactiveTopic({
      npcId,
      closenessBand: 'friendly',
      situation: {
        placeLabel: 'Central Plaza',
        activity: 'standing_in_territory',
        timePhase: 'day',
        weather: 'clear',
        lastSharedEvent: null,
      },
    });
    assert.ok(starter.reply.length >= 12, `Expected substantial proactive opener for ${npcId}`);
    assert.equal(isNpcEmotionTag(starter.emotion), true);
    for (const pattern of FORBIDDEN_INTERNAL_PATTERNS) {
      assert.equal(
        pattern.test(starter.reply),
        false,
        `Proactive opener for ${npcId} leaked internal closeness pattern: ${starter.reply}`,
      );
    }
  }
});

test('buildLocalProactiveTopic adapts to shared activity, rain, evening, and avoids repeating recent openings', () => {
  ensureAllNpcPersonasRegistered();

  const walkStarter = buildLocalProactiveTopic({
    npcId: 'mira',
    closenessBand: 'close',
    situation: {
      placeLabel: 'Central Plaza',
      activity: 'walking_with_player',
      timePhase: 'day',
      weather: 'clear',
      lastSharedEvent: null,
    },
  });
  assert.ok(walkStarter.reply.length > 0);

  const rainStarter = buildLocalProactiveTopic({
    npcId: 'tari',
    closenessBand: 'friendly',
    situation: {
      placeLabel: 'Beach Club',
      activity: 'standing_in_territory',
      timePhase: 'evening',
      weather: 'rain',
      lastSharedEvent: null,
    },
  });
  assert.ok(rainStarter.reply.length > 0);
  assert.equal(isNpcEmotionTag(rainStarter.emotion), true);

  // Anti-repetition check: passing the first opening in recentOpenings produces a distinct next opener
  const first = buildLocalProactiveTopic({
    npcId: 'hana',
    closenessBand: 'friendly',
    situation: {
      placeLabel: 'Central Plaza',
      activity: 'standing_in_territory',
      timePhase: 'day',
      weather: 'clear',
      lastSharedEvent: null,
    },
  });
  const second = buildLocalProactiveTopic({
    npcId: 'hana',
    closenessBand: 'friendly',
    situation: {
      placeLabel: 'Central Plaza',
      activity: 'standing_in_territory',
      timePhase: 'day',
      weather: 'clear',
      lastSharedEvent: null,
    },
    recentOpenings: [first.reply],
  });
  assert.notEqual(second.reply, first.reply);
});

test('api/npc-chat supports mode=proactive_opener with empty user message and zero closenessDelta', async () => {
  for (const npcId of NAMED_NPC_IDS) {
    const res = await handleNpcChatRequest(
      {
        npcId,
        message: '',
        mode: 'proactive_opener',
        closenessBand: 'close',
        situation: {
          placeLabel: 'Central Plaza',
          activity: 'walking_with_player',
          timePhase: 'evening',
          weather: 'clear',
        },
      },
      { apiKeyOverride: '' },
    );
    assert.equal(res.status, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.npcId, npcId);
    assert.equal(res.payload.closenessDelta, 0);
    assert.ok(res.payload.reply && res.payload.reply.length > 0);
    assert.equal(isNpcEmotionTag(res.payload.emotion), true);
  }
});
