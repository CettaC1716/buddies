import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateNegotiationEnvelope,
  createNegotiationSession,
  negotiateRaise,
  negotiatePlayerCounter,
  negotiateAccept,
  negotiateWalkAway,
  clampNegotiationOffer,
  parseTradeChatIntent,
  countOwnedMerchantItems,
  createNegotiationSessionWithMemory,
  quickDealBonusLul,
  createNpcTreasuryLedger,
  rollNpcTreasuryDay,
  evaluateNpcPurchase,
  recordNpcPurchase,
  getNpcMemoryFinalOffer,
} from './buddiesMerchantPricing';

test('negotiation envelope: opens at 80% and caps at 115% of formula value', () => {
  const env = evaluateNegotiationEnvelope(100);
  assert.equal(env.baseValue, 100);
  assert.equal(env.openOffer, 80);
  assert.equal(env.ceiling, 115);
});

test('negotiation raises climb in shrinking steps and stop at the final offer', () => {
  let s = createNegotiationSession(100);
  assert.equal(s.currentOffer, 80);
  s = negotiateRaise(s);
  assert.equal(s.currentOffer, 87);
  assert.equal(s.isFinalOffer, false);
  s = negotiateRaise(s);
  assert.equal(s.currentOffer, 92);
  s = negotiateRaise(s);
  assert.equal(s.currentOffer, 95);
  assert.equal(s.isFinalOffer, true);
  const frozen = negotiateRaise(s);
  assert.equal(frozen.currentOffer, 95);
  assert.equal(frozen.isFinalOffer, true);
});

test('negotiation never exceeds the ceiling even for tiny values', () => {
  let s = createNegotiationSession(10);
  for (let i = 0; i < 10; i++) s = negotiateRaise(s);
  assert.ok(s.currentOffer <= s.ceiling, `offer ${s.currentOffer} <= ceiling ${s.ceiling}`);
  assert.ok(s.currentOffer >= 1);
});

test('player counter at or below the ceiling is accepted at the player price', () => {
  const s = createNegotiationSession(100);
  const { session, outcome } = negotiatePlayerCounter(s, 100);
  assert.equal(outcome, 'agreed');
  assert.equal(session.agreedPrice, 100);
  assert.equal(session.closed, 'agreed');
});

test('player counter above the ceiling only earns a normal raise step', () => {
  const s = createNegotiationSession(100);
  const { session, outcome } = negotiatePlayerCounter(s, 100000);
  assert.equal(outcome, 'raised');
  assert.equal(session.agreedPrice, null);
  assert.equal(session.currentOffer, 87);
});

test('accept locks the current offer; walk-away preserves the last offer', () => {
  const s = negotiateRaise(createNegotiationSession(50));
  const accepted = negotiateAccept(s);
  assert.equal(accepted.agreedPrice, 44);
  assert.equal(accepted.closed, 'agreed');
  const walked = negotiateWalkAway(s);
  assert.equal(walked.closed, 'walked_away');
  assert.equal(walked.currentOffer, 44);
  assert.equal(walked.agreedPrice, null);
});

test('clamp keeps external proposals inside the envelope', () => {
  const s = createNegotiationSession(100);
  assert.equal(clampNegotiationOffer(s, 99999), 115);
  assert.equal(clampNegotiationOffer(s, 10), 80);
  assert.equal(clampNegotiationOffer(s, 90.4), 90);
  assert.equal(clampNegotiationOffer(s, Number.NaN), 80);
});

test('walkaway TAKE IT: accepting a walked-away session revives the last offer', () => {
  let s = createNegotiationSession(100);
  s = negotiateRaise(s); // offer now 87
  s = negotiateWalkAway(s);
  assert.equal(s.closed, 'walked_away');
  assert.equal(s.agreedPrice, null);
  s = negotiateAccept(s);
  assert.equal(s.closed, 'agreed');
  assert.equal(s.agreedPrice, 87);
});

test('chat intent: bare numbers and offer verbs are counter-offers', () => {
  assert.deepEqual(parseTradeChatIntent('50'), { kind: 'counter', ask: 50 });
  assert.deepEqual(parseTradeChatIntent('50k'), { kind: 'counter', ask: 50000 });
  assert.deepEqual(parseTradeChatIntent('50 LUL'), { kind: 'counter', ask: 50 });
  assert.deepEqual(parseTradeChatIntent('tawar 45'), { kind: 'counter', ask: 45 });
});

test('chat intent: a number inside a sentence is never a counter-offer', () => {
  assert.notEqual(parseTradeChatIntent('aku punya 2 ikan lagi').kind, 'counter');
  assert.notEqual(parseTradeChatIntent('tadi aku jual 3 ekor di pasar').kind, 'counter');
});

test('chat intent: ordinary words cannot kill or sign a deal by accident', () => {
  assert.deepEqual(parseTradeChatIntent('sudah'), { kind: 'none' });
  assert.equal(parseTradeChatIntent('sudah bagus, tapi naikkan lagi').kind, 'raise');
  assert.deepEqual(parseTradeChatIntent('ya'), { kind: 'accept' });
  assert.equal(parseTradeChatIntent('ya, mahal sekali').kind, 'raise');
  assert.deepEqual(parseTradeChatIntent('tidak jadi'), { kind: 'walkaway' });
  assert.deepEqual(parseTradeChatIntent('berhenti'), { kind: 'walkaway' });
  assert.equal(parseTradeChatIntent('kenapa murah sekali').kind, 'why');
});

test('treasury discipline: daily velocity budget caps NPC spending', () => {
  const day = '2026-11-14';
  const ledger = createNpcTreasuryLedger(day, 5000); // budget = 20% = 1000
  const input = { playerKey: 'alice', dayKey: day, nowIso: '2026-11-14T00:00:00.000Z' };
  assert.equal(evaluateNpcPurchase(ledger, 5000, { ...input, price: 300 }).allowed, true);
  const after = recordNpcPurchase(ledger, 4700, {
    ...input,
    price: 300,
    speciesId: 'sardine',
    baseValue: 320,
  });
  // 300 of the 1000 budget spent; 700 remains. A 400 ask from another
  // player fits both the remaining budget and the per-player cap.
  assert.equal(
    evaluateNpcPurchase(after, 4700, { ...input, playerKey: 'bob', price: 400 }).allowed,
    true,
  );
  const over = evaluateNpcPurchase(after, 4700, { ...input, playerKey: 'carol', price: 701 });
  assert.equal(over.allowed, false);
  assert.equal(over.reason, 'budget');
});

test('treasury discipline: one player cannot drain the daily budget alone', () => {
  const day = '2026-11-14';
  const ledger = createNpcTreasuryLedger(day, 5000); // player cap = 40% of 1000 = 400
  const input = { playerKey: 'whale', dayKey: day, nowIso: '2026-11-14T00:00:00.000Z' };
  const over = evaluateNpcPurchase(ledger, 5000, { ...input, price: 401 });
  assert.equal(over.allowed, false);
  assert.equal(over.reason, 'player_cap');
  assert.equal(evaluateNpcPurchase(ledger, 5000, { ...input, price: 400 }).allowed, true);
});

test('treasury discipline: locked reserve is untouchable and only grows', () => {
  const day = '2026-11-14';
  let ledger = createNpcTreasuryLedger(day, 5000);
  const input = { playerKey: 'alice', dayKey: day, nowIso: '2026-11-14T00:00:00.000Z' };
  // Bought at 80 against a formula value of 100: spread 20, half (10) locks.
  ledger = recordNpcPurchase(ledger, 4920, {
    ...input,
    price: 80,
    speciesId: 'sardine',
    baseValue: 100,
  });
  assert.equal(ledger.lockedReserve, 10);
  const broke = { ...ledger, poolStartOfDay: 5000 };
  // Pool of 50 with 10 locked: only 40 is spendable.
  assert.equal(evaluateNpcPurchase(broke, 50, { ...input, price: 41 }).reason, 'pool');
});

test('treasury discipline: circuit breaker trips on a 10% pool drop and resets next day', () => {
  const day = '2026-11-14';
  let ledger = createNpcTreasuryLedger(day, 5000);
  const input = { playerKey: 'alice', dayKey: day, nowIso: '2026-11-14T00:00:00.000Z' };
  ledger = recordNpcPurchase(ledger, 4499, {
    ...input,
    price: 400,
    speciesId: 'tuna',
    baseValue: 400,
  });
  assert.equal(ledger.breakerTripped, true);
  assert.equal(
    evaluateNpcPurchase(ledger, 4499, { ...input, price: 10 }).reason,
    'breaker',
  );
  const rolled = rollNpcTreasuryDay(ledger, '2026-11-15', 4499);
  assert.equal(rolled.breakerTripped, false);
  assert.equal(rolled.spentToday, 0);
  assert.equal(rolled.lockedReserve, ledger.lockedReserve); // ratchet survives the roll
});

test('treasury memory: final offers resume for 24h, then expire; sessions anchor on them', () => {
  const day = '2026-11-14';
  let ledger = createNpcTreasuryLedger(day, 5000);
  const t0 = Date.parse('2026-11-14T00:00:00.000Z');
  ledger = recordNpcPurchase(ledger, 4900, {
    playerKey: 'alice',
    dayKey: day,
    nowIso: new Date(t0).toISOString(),
    price: 100,
    speciesId: 'sardine',
    baseValue: 100,
  });
  assert.equal(getNpcMemoryFinalOffer(ledger, 'alice', 'sardine', t0 + 3600_000), 100);
  assert.equal(getNpcMemoryFinalOffer(ledger, 'alice', 'sardine', t0 + 25 * 3600_000), null);
  assert.equal(getNpcMemoryFinalOffer(ledger, 'bob', 'sardine', t0 + 3600_000), null);
  // A new session for a 100-value fish resumes at 100, not the 80 opener.
  const resumed = createNegotiationSessionWithMemory(100, 100);
  assert.equal(resumed.currentOffer, 100);
  const fresh = createNegotiationSessionWithMemory(100, null);
  assert.equal(fresh.currentOffer, 80);
});

test('patience: grinding past the final offer makes the NPC close the order', () => {
  let s = createNegotiationSession(100, 1); // an impatient Kai: one raise tolerated
  s = negotiateRaise(s);
  assert.equal(s.currentOffer, 87);
  assert.equal(s.isFinalOffer, true);
  assert.equal(s.closedByNpc, false);
  // One more push: Kai closes the order himself.
  s = negotiateRaise(s);
  assert.equal(s.closed, 'walked_away');
  assert.equal(s.closedByNpc, true);
  // And a late acceptance cannot revive an NPC-closed order.
  const revived = negotiateAccept(s);
  assert.equal(revived.agreedPrice, null);
});

test('patience: default sessions keep the classic three-raise ladder', () => {
  let s = createNegotiationSession(100);
  assert.equal(s.patience, 3);
  s = negotiateRaise(s);
  s = negotiateRaise(s);
  assert.equal(s.isFinalOffer, false);
  s = negotiateRaise(s);
  assert.equal(s.isFinalOffer, true);
  assert.equal(s.closedByNpc, false);
});

test('patience: a player walk-away can still be taken back, an NPC closing cannot', () => {
  let s = createNegotiationSession(100);
  s = negotiateWalkAway(s);
  const taken = negotiateAccept(s);
  assert.equal(taken.agreedPrice, 80);
});

test('quick-deal bonus: only for accepting the first offer untouched', () => {
  assert.equal(quickDealBonusLul(100, 0), 2);
  assert.equal(quickDealBonusLul(100, 1), 0);
  assert.equal(quickDealBonusLul(1000, 0), 3); // capped small
  assert.equal(quickDealBonusLul(10, 0), 1); // never zero when it applies
});

test('owned item counts: the ownership list is a multiset', () => {
  assert.deepEqual(countOwnedMerchantItems([]), {});
  assert.deepEqual(countOwnedMerchantItems(['sofa', 'sofa', 'lamp']), {
    sofa: 2,
    lamp: 1,
  });
});
