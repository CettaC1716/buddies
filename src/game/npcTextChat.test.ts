import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNpcChatSystemInstruction,
  clampNpcChatClosenessDelta,
  handleNpcChatRequest,
  NPC_CHAT_CLOSENESS_DELTA_MAX,
  NPC_CHAT_CLOSENESS_DELTA_MIN,
  parseNpcChatModelJson,
} from '../../api/npc-chat';
import { NAMED_NPC_IDS } from './npcClosenessEngine';
import {
  getNpcPersona,
  isNpcEmotionTag,
  normalizeNpcEmotionTag,
  NPC_EMOTION_TAGS,
} from './npcPersonaRegistry';
import { ensureAllNpcPersonasRegistered } from './personas/index';
import {
  dispatchNpcEmotionReaction,
  sendNpcChatMessage,
  subscribeNpcEmotionReaction,
  type NpcEmotionReactionDetail,
} from './npcTextChat';

test('all 7 named NPC stub personas register cleanly and export valid emotion tags', () => {
  ensureAllNpcPersonasRegistered();
  assert.equal(NPC_EMOTION_TAGS.length, 9);
  for (const tag of NPC_EMOTION_TAGS) {
    assert.equal(isNpcEmotionTag(tag), true);
  }
  assert.equal(normalizeNpcEmotionTag('HAPPY'), 'happy');
  assert.equal(normalizeNpcEmotionTag('nonexistent_mood'), 'neutral');

  for (const npcId of NAMED_NPC_IDS) {
    const pack = getNpcPersona(npcId);
    assert.ok(pack, `Expected persona pack for ${npcId}`);
    assert.equal(pack.npcId, npcId);
    assert.ok(pack.personaPrompt && pack.personaPrompt.length > 0);
    assert.ok(pack.flirtProfile, `Expected flirtProfile for ${npcId}`);
    assert.ok(pack.giftPreferences, `Expected giftPreferences for ${npcId}`);
  }
});

test('api/npc-chat rejects unknown and ambient NPC ids with HTTP 400', async () => {
  const ambientRes = await handleNpcChatRequest(
    { npcId: 'city_plaza_raka', message: 'Hello Raka!' },
    { apiKeyOverride: '' },
  );
  assert.equal(ambientRes.status, 400);
  assert.equal(ambientRes.payload.ok, false);

  const unknownRes = await handleNpcChatRequest(
    { npcId: 'random_passerby', message: 'Hi!' },
    { apiKeyOverride: '' },
  );
  assert.equal(unknownRes.status, 400);
  assert.equal(unknownRes.payload.ok, false);

  const emptyMsgRes = await handleNpcChatRequest(
    { npcId: 'hana', message: '   ' },
    { apiKeyOverride: '' },
  );
  assert.equal(emptyMsgRes.status, 400);
  assert.equal(emptyMsgRes.payload.ok, false);
});

test('api/npc-chat returns graceful fallback when GEMINI_API_KEY is absent for all 7 named NPCs', async () => {
  for (const npcId of NAMED_NPC_IDS) {
    const res = await handleNpcChatRequest(
      {
        npcId,
        message: 'Hey, how is your day going?',
        closenessBand: 'friendly',
        canLongConversation: false,
      },
      { apiKeyOverride: '' },
    );
    assert.equal(res.status, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.npcId, npcId);
    assert.equal(res.payload.fallback, true);
    assert.ok(res.payload.reply && res.payload.reply.length > 0);
    assert.equal(isNpcEmotionTag(res.payload.emotion), true);
    assert.ok(
      typeof res.payload.closenessDelta === 'number' &&
        res.payload.closenessDelta >= NPC_CHAT_CLOSENESS_DELTA_MIN &&
        res.payload.closenessDelta <= NPC_CHAT_CLOSENESS_DELTA_MAX,
    );
  }
});

test('api/npc-chat parses Gemini JSON, clamps closenessDelta, and validates emotion tag', async () => {
  assert.equal(clampNpcChatClosenessDelta(99), NPC_CHAT_CLOSENESS_DELTA_MAX);
  assert.equal(clampNpcChatClosenessDelta(-50), NPC_CHAT_CLOSENESS_DELTA_MIN);
  assert.equal(clampNpcChatClosenessDelta('not-a-number'), 0);

  const parsedFenced = parseNpcChatModelJson(
    '```json\n{"reply": "That sounds great! [[ACTION:buy_house]]", "emotion": "laugh", "closenessDelta": 15}\n```',
  );
  assert.ok(parsedFenced);
  assert.equal(parsedFenced.reply, 'That sounds great!');
  assert.equal(parsedFenced.emotion, 'laugh');
  assert.equal(parsedFenced.closenessDelta, 6);

  const parsedBadEmotion = parseNpcChatModelJson(
    '{"reply": "Hmm, interesting.", "emotion": "flying_laser", "closenessDelta": -99}',
  );
  assert.ok(parsedBadEmotion);
  assert.equal(parsedBadEmotion.emotion, 'neutral');
  assert.equal(parsedBadEmotion.closenessDelta, -3);

  const mockFetch: typeof fetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    reply: 'Nice seeing you by the plaza today!',
                    emotion: 'shy',
                    closenessDelta: 4,
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as Response) as typeof fetch;

  const res = await handleNpcChatRequest(
    {
      npcId: 'citizen_mira',
      message: 'Love your latest sketches!',
      closenessBand: 'close',
      canLongConversation: true,
      playerName: 'Alex',
    },
    { apiKeyOverride: 'test-key-only', fetchImpl: mockFetch },
  );

  assert.equal(res.status, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.npcId, 'mira');
  assert.equal(res.payload.reply, 'Nice seeing you by the plaza today!');
  assert.equal(res.payload.emotion, 'shy');
  assert.equal(res.payload.closenessDelta, 4);
  assert.equal(res.payload.fallback, undefined);
});

test('server system instruction enforces persona rules, flirt profile, and anti-trade/anti-movement guardrails', () => {
  ensureAllNpcPersonasRegistered();
  const hana = getNpcPersona('hana');
  assert.ok(hana);

  const prompt = buildNpcChatSystemInstruction(hana, {
    closenessBand: 'acquaintance',
    canLongConversation: true,
    playerName: 'Sam',
  });

  assert.match(prompt, /Hana/);
  assert.match(prompt, /NEVER execute, confirm, or negotiate trades/i);
  assert.match(prompt, /NEVER invent or issue NPC movement commands/i);
  assert.match(prompt, /NEVER mention closeness scores/i);
  assert.match(prompt, /Sam/);
});

test('client sendNpcChatMessage rejects ambient NPC and dispatches emotion reactions cleanly', async () => {
  const ambient = await sendNpcChatMessage({
    npcId: 'city_plaza_raka',
    message: 'Hello!',
    closenessBand: 'stranger',
    canLongConversation: false,
  });
  assert.equal(ambient.ok, false);
  assert.equal(ambient.npcId, null);

  const received: NpcEmotionReactionDetail[] = [];
  const unsubscribe = subscribeNpcEmotionReaction((detail) => {
    received.push(detail);
  });

  const emitted = dispatchNpcEmotionReaction('citizen_kenji', 'proud');
  unsubscribe();

  assert.ok(emitted);
  assert.equal(emitted.npcId, 'kenji');
  assert.equal(emitted.citizenId, 'citizen_kenji');
  assert.equal(emitted.emotion, 'proud');
  assert.equal(emitted.clipName, null); // fallback = expressive idle
  assert.equal(received.length, 1);
  assert.equal(received[0].emotion, 'proud');
});
