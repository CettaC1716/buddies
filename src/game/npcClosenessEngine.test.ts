import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOSENESS_DECAY_GRACE_DAYS,
  CLOSENESS_DECAY_PER_DAY,
  CLOSENESS_DECAY_SAFE_FLOOR,
  CLOSENESS_UNLOCK_ORDER,
  CLOSENESS_UNLOCK_THRESHOLDS,
  CONVERSATION_DELTA_MAX,
  CONVERSATION_DELTA_MIN,
  NAMED_NPC_IDS,
  SHARED_ACTIVITY_CLOSENESS_DELTAS,
  applyClosenessDecay,
  canLongConversation,
  canPairPose,
  canRideTogether,
  canWalkTogether,
  createEmptyNpcClosenessStore,
  encodeNpcClosenessToSkinsTags,
  getClosenessBand,
  getEffectiveClosenessScore,
  getNpcClosenessBand,
  getNpcClosenessRecord,
  getNpcClosenessStorageKey,
  getNpcUnlockedFeatures,
  hasNpcUnlock,
  loadNpcClosenessStore,
  mergeNpcClosenessStores,
  npcIdToCitizenId,
  parseNpcClosenessFromSkinsTags,
  recordNpcConversation,
  recordNpcSharedActivity,
  resolveNpcId,
  saveNpcClosenessStore,
} from './npcClosenessEngine';
import { MS_PER_DAY } from '../lib/cerriaBrand';

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & {
  backing: Map<string, string>;
} {
  const backing = new Map<string, string>();
  return {
    backing,
    getItem(key: string) {
      return backing.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      backing.set(key, value);
    },
  };
}

describe('npcClosenessEngine', () => {
  it('resolves all 7 named NPC IDs and their canonical CitizenId aliases', () => {
    assert.deepEqual([...NAMED_NPC_IDS], [
      'hana',
      'kai',
      'mira',
      'nadia',
      'tari',
      'bima',
      'kenji',
    ]);

    assert.equal(resolveNpcId('hana'), 'hana');
    assert.equal(resolveNpcId('npc_hana'), 'hana');
    assert.equal(resolveNpcId('npc_cafe'), 'hana');
    assert.equal(resolveNpcId('npc_kai'), 'kai');
    assert.equal(resolveNpcId('citizen_mira'), 'mira');
    assert.equal(resolveNpcId('city_plaza_nadia'), 'nadia');
    assert.equal(resolveNpcId('citizen_tari'), 'tari');
    assert.equal(resolveNpcId('citizen_bima'), 'bima');
    assert.equal(resolveNpcId('citizen_kenji'), 'kenji');
    assert.equal(resolveNpcId('random_human_player'), null);
    assert.equal(resolveNpcId(''), null);

    assert.equal(npcIdToCitizenId('hana'), 'npc_hana');
    assert.equal(npcIdToCitizenId('nadia'), 'city_plaza_nadia');
  });

  it('enforces strictly ordered unlock thresholds: long_conversation < pair_pose < walk_together < ride_together', () => {
    assert.deepEqual([...CLOSENESS_UNLOCK_ORDER], [
      'long_conversation',
      'pair_pose',
      'walk_together',
      'ride_together',
    ]);

    const t = CLOSENESS_UNLOCK_THRESHOLDS;
    assert.ok(t.long_conversation > 0);
    assert.ok(t.long_conversation < t.pair_pose);
    assert.ok(t.pair_pose < t.walk_together);
    assert.ok(t.walk_together < t.ride_together);
    assert.ok(t.ride_together <= 100);
  });

  it('maps internal closeness bands monotonically for F2 prompt scaling', () => {
    assert.equal(getClosenessBand(0), 'stranger');
    assert.equal(getClosenessBand(14), 'stranger');
    assert.equal(getClosenessBand(15), 'acquaintance');
    assert.equal(getClosenessBand(35), 'friendly');
    assert.equal(getClosenessBand(60), 'close');
    assert.equal(getClosenessBand(82), 'trusted');
    assert.equal(getClosenessBand(100), 'trusted');
  });

  it('tracks F2 conversation gains, clamps deltas, and reports newly unlocked features', () => {
    const t0 = Date.UTC(2026, 10, 1, 12, 0, 0);
    let store = createEmptyNpcClosenessStore();

    // Clamped to CONVERSATION_DELTA_MAX (12)
    const first = recordNpcConversation(store, 'hana', {
      closenessDelta: 99,
      nowMs: t0,
      dateKey: '2026-11-01',
    });
    assert.equal(first.appliedDelta, CONVERSATION_DELTA_MAX);
    assert.deepEqual(first.unlockedNow, []);
    assert.equal(canLongConversation(first.store, 'hana', t0), false);
    store = first.store;

    // Second conversation crosses long_conversation threshold (20)
    const second = recordNpcConversation(store, 'npc_hana', {
      closenessDelta: 10,
      nowMs: t0 + 60_000,
      dateKey: '2026-11-01',
    });
    assert.equal(second.appliedDelta, 10);
    assert.deepEqual(second.unlockedNow, ['long_conversation']);
    assert.equal(canLongConversation(second.store, 'hana', t0 + 60_000), true);
    assert.equal(canPairPose(second.store, 'hana', t0 + 60_000), false);
    assert.equal(getNpcClosenessBand(second.store, 'hana', t0 + 60_000), 'acquaintance');
    assert.equal(getNpcClosenessRecord(second.store, 'hana').totalConversations, 2);

    // Negative delta is clamped safely
    const negative = recordNpcConversation(second.store, 'hana', {
      closenessDelta: -50,
      nowMs: t0 + 120_000,
      dateKey: '2026-11-01',
    });
    assert.equal(negative.appliedDelta, CONVERSATION_DELTA_MIN);
  });

  it('tracks F3 shared activities with once-per-activity-per-day anti-grind', () => {
    const day1 = Date.UTC(2026, 10, 2, 10, 0, 0);
    const day2 = day1 + MS_PER_DAY;
    let store = createEmptyNpcClosenessStore();

    // First pair_pose on day 1 awards full delta
    const p1 = recordNpcSharedActivity(store, 'mira', 'pair_pose', {
      nowMs: day1,
      dateKey: '2026-11-02',
    });
    assert.equal(p1.appliedDelta, SHARED_ACTIVITY_CLOSENESS_DELTAS.pair_pose);
    store = p1.store;

    // Repeat pair_pose on same day awards 0
    const p1Repeat = recordNpcSharedActivity(store, 'mira', 'pair_pose', {
      nowMs: day1 + 300_000,
      dateKey: '2026-11-02',
    });
    assert.equal(p1Repeat.appliedDelta, 0);
    store = p1Repeat.store;

    // Different activity (walk_together) on same day still awards full delta
    const w1 = recordNpcSharedActivity(store, 'mira', 'walk_together', {
      nowMs: day1 + 600_000,
      dateKey: '2026-11-02',
    });
    assert.equal(w1.appliedDelta, SHARED_ACTIVITY_CLOSENESS_DELTAS.walk_together);
    store = w1.store;

    // Next day resets daily activity lock
    const p2 = recordNpcSharedActivity(store, 'mira', 'pair_pose', {
      nowMs: day2,
      dateKey: '2026-11-03',
    });
    assert.equal(p2.appliedDelta, SHARED_ACTIVITY_CLOSENESS_DELTAS.pair_pose);
    assert.equal(getNpcClosenessRecord(p2.store, 'mira').totalActivities, 4);
  });

  it('unlocks all four tiers in order up to ride_together', () => {
    const t0 = Date.UTC(2026, 10, 5, 9, 0, 0);
    let store = createEmptyNpcClosenessStore();

    for (let i = 0; i < 8; i += 1) {
      const res = recordNpcConversation(store, 'kai', {
        closenessDelta: 11,
        nowMs: t0 + i * 1000,
        dateKey: '2026-11-05',
      });
      store = res.store;
    }

    assert.equal(canLongConversation(store, 'kai', t0 + 10_000), true);
    assert.equal(canPairPose(store, 'kai', t0 + 10_000), true);
    assert.equal(canWalkTogether(store, 'kai', t0 + 10_000), true);
    assert.equal(canRideTogether(store, 'kai', t0 + 10_000), true);
    assert.equal(hasNpcUnlock(store, 'kai', 'ride_together', t0 + 10_000), true);
    assert.deepEqual(getNpcUnlockedFeatures(store, 'kai', t0 + 10_000), [
      'long_conversation',
      'pair_pose',
      'walk_together',
      'ride_together',
    ]);
    assert.equal(getNpcClosenessBand(store, 'kai', t0 + 10_000), 'trusted');
  });

  it('applies very slow decay after grace period and never drops below the safe floor', () => {
    const t0 = Date.UTC(2026, 10, 1, 12, 0, 0);
    let store = createEmptyNpcClosenessStore();
    store = recordNpcConversation(store, 'nadia', { closenessDelta: 12, nowMs: t0 }).store;
    store = recordNpcConversation(store, 'nadia', { closenessDelta: 12, nowMs: t0 }).store;
    // score = 24, peakScore = 24
    const rec = getNpcClosenessRecord(store, 'nadia');
    assert.equal(rec.score, 24);

    // Within grace period (3 days) -> zero decay
    const atGraceEnd = t0 + CLOSENESS_DECAY_GRACE_DAYS * MS_PER_DAY;
    assert.equal(getEffectiveClosenessScore(rec, atGraceEnd), 24);

    // 5 days absent -> 2 days past grace -> -2 points
    const atDay5 = t0 + (CLOSENESS_DECAY_GRACE_DAYS + 2) * MS_PER_DAY;
    assert.equal(getEffectiveClosenessScore(rec, atDay5), 24 - 2 * CLOSENESS_DECAY_PER_DAY);

    // 100 days absent -> clamped safely at CLOSENESS_DECAY_SAFE_FLOOR (10)
    const atDay100 = t0 + 100 * MS_PER_DAY;
    assert.equal(getEffectiveClosenessScore(rec, atDay100), CLOSENESS_DECAY_SAFE_FLOOR);
    assert.equal(applyClosenessDecay(rec, atDay100).score, CLOSENESS_DECAY_SAFE_FLOOR);
  });

  it('persists per-player closeness cleanly in localStorage and round-trips through skins tags', () => {
    const storage = createMemoryStorage();
    const t0 = Date.UTC(2026, 10, 10, 8, 0, 0);

    assert.equal(getNpcClosenessStorageKey('Alice.Testnet '), 'bb_npc_closeness_v1:alice.testnet');
    assert.equal(getNpcClosenessStorageKey(null), 'bb_npc_closeness_v1:guest');

    let aliceStore = loadNpcClosenessStore('alice.testnet', storage);
    aliceStore = recordNpcConversation(aliceStore, 'bima', {
      closenessDelta: 10,
      nowMs: t0,
      dateKey: '2026-11-10',
    }).store;
    saveNpcClosenessStore('alice.testnet', aliceStore, storage);

    // Bob's store is completely isolated from Alice's
    const bobStore = loadNpcClosenessStore('bob.testnet', storage);
    assert.equal(getNpcClosenessRecord(bobStore, 'bima').score, 0);

    // Reloading Alice's store restores exact record
    const reloadedAlice = loadNpcClosenessStore('alice.testnet', storage);
    assert.equal(getNpcClosenessRecord(reloadedAlice, 'bima').score, 10);

    // Compact skins tags round-trip + merge
    const tags = encodeNpcClosenessToSkinsTags(reloadedAlice);
    assert.equal(tags.length, 1);
    const parsedFromTags = parseNpcClosenessFromSkinsTags(['default', 'role:builder', ...tags]);
    assert.equal(getNpcClosenessRecord(parsedFromTags, 'bima').score, 10);

    const merged = mergeNpcClosenessStores(bobStore, parsedFromTags);
    assert.equal(getNpcClosenessRecord(merged, 'bima').score, 10);
  });
});
