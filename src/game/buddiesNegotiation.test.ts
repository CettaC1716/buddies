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

test('owned item counts: the ownership list is a multiset', () => {
  assert.deepEqual(countOwnedMerchantItems([]), {});
  assert.deepEqual(countOwnedMerchantItems(['sofa', 'sofa', 'lamp']), {
    sofa: 2,
    lamp: 1,
  });
});
