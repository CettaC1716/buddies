import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_NPC_CHAT_HISTORY_TURNS,
  NPC_CHAT_HISTORY_STORAGE_PREFIX,
  appendNpcChatTurns,
  clearNpcChatTranscript,
  getNpcChatHistoryStorageKey,
  loadNpcChatHistoryStore,
  loadNpcChatTranscript,
  splitTranscriptForDialogueUi,
} from './npcChatHistoryStore';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('npcChatHistoryStore round-trips per-NPC transcripts, normalizes aliases, and uses bb_npc_chat_ prefix', () => {
  const storage = createMemoryStorage();
  const key = getNpcChatHistoryStorageKey('alice.testnet');
  assert.ok(key.startsWith(NPC_CHAT_HISTORY_STORAGE_PREFIX));

  appendNpcChatTurns(
    'alice.testnet',
    'npc_hana',
    [
      { id: 'p1', role: 'player', text: 'Hi Hana, how is West Plaza today?', timestampMs: 1000 },
      { id: 'n1', role: 'npc', text: 'Lovely and sunny! Coffee is fresh.', timestampMs: 2000 },
    ],
    storage,
  );
  appendNpcChatTurns(
    'alice.testnet',
    'city_plaza_nadia',
    [
      {
        id: 'p2',
        role: 'player',
        text: 'Sent a gift: Espresso',
        timestampMs: 3000,
        visual: { kind: 'gift_box', itemName: 'Espresso' },
      },
      { id: 'n2', role: 'npc', text: 'Now that is taste.', timestampMs: 4000 },
    ],
    storage,
  );

  // Alias lookup ('hana' === 'npc_hana', 'nadia' === 'city_plaza_nadia')
  const hanaTurns = loadNpcChatTranscript('alice.testnet', 'hana', storage);
  assert.equal(hanaTurns.length, 2);
  assert.equal(hanaTurns[0].text, 'Hi Hana, how is West Plaza today?');
  assert.equal(hanaTurns[1].text, 'Lovely and sunny! Coffee is fresh.');

  const nadiaTurns = loadNpcChatTranscript('alice.testnet', 'nadia', storage);
  assert.equal(nadiaTurns.length, 2);
  assert.deepEqual(nadiaTurns[0].visual, { kind: 'gift_box', itemName: 'Espresso' });

  // Isolated per account
  assert.equal(loadNpcChatTranscript('bob.testnet', 'hana', storage).length, 0);

  // Clearing one NPC leaves other NPCs intact
  clearNpcChatTranscript('alice.testnet', 'hana', storage);
  assert.equal(loadNpcChatTranscript('alice.testnet', 'hana', storage).length, 0);
  assert.equal(loadNpcChatTranscript('alice.testnet', 'nadia', storage).length, 2);

  // Split helper separates prior history from final NPC message cleanly
  const split = splitTranscriptForDialogueUi(nadiaTurns);
  assert.equal(split.history.length, 1);
  assert.equal(split.latestNpcText, 'Now that is taste.');
});

test('npcChatHistoryStore enforces strict 40-turn cap per NPC keeping newest turns', () => {
  const storage = createMemoryStorage();
  assert.equal(MAX_NPC_CHAT_HISTORY_TURNS, 40);

  for (let i = 1; i <= 55; i++) {
    appendNpcChatTurns(
      'alice.testnet',
      'mira',
      [{ id: `t_${i}`, role: i % 2 === 1 ? 'player' : 'npc', text: `Turn #${i}`, timestampMs: i * 100 }],
      storage,
    );
  }

  const saved = loadNpcChatTranscript('alice.testnet', 'citizen_mira', storage);
  assert.equal(saved.length, 40);
  assert.equal(saved[0].text, 'Turn #16');
  assert.equal(saved[39].text, 'Turn #55');
});

test('npcChatHistoryStore recovers cleanly from missing, corrupt, or throwing storage without crashing', () => {
  const storage = createMemoryStorage();
  const key = getNpcChatHistoryStorageKey('alice.testnet');

  // Invalid JSON
  storage.setItem(key, '{not valid json');
  assert.deepEqual(loadNpcChatHistoryStore('alice.testnet', storage), {});
  assert.deepEqual(loadNpcChatTranscript('alice.testnet', 'hana', storage), []);

  // Non-object JSON
  storage.setItem(key, '["unexpected"]');
  assert.deepEqual(loadNpcChatHistoryStore('alice.testnet', storage), {});

  // Partially malformed entries inside an NPC array
  storage.setItem(
    key,
    JSON.stringify({
      kai: [
        null,
        { role: 'invalid', text: 'bad role' },
        { role: 'player', text: '   ' },
        { id: 'ok1', role: 'player', text: 'Catch anything today?', timestampMs: 1234 },
      ],
      broken_npc: 'not-an-array',
    }),
  );
  const recovered = loadNpcChatTranscript('alice.testnet', 'kai', storage);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].text, 'Catch anything today?');

  // Throwing Storage implementation
  const brokenStorage = {
    getItem() {
      throw new Error('SecurityError: storage blocked');
    },
  };
  assert.deepEqual(loadNpcChatTranscript('alice.testnet', 'hana', brokenStorage), []);
});
