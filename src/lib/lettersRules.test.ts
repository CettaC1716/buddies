import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canReplyToLetter,
  formatReplySubject,
  getLetterDecisionCopy,
  getLetterKindLabel,
  getLetterListRowState,
  getLetterReplyRecipientAccount,
  getLetterSenderDisplayName,
  hasLetterDecisionCard,
  isLetterReadOnly,
  letterNeedsAnswer,
  normalizeLetterDecisionState,
  normalizeLetterKind,
  type BuddiesLetter,
} from './lettersRules';

describe('lettersRules (official inbox email model)', () => {
  it('normalizes legacy purchase certificate kinds to certificate and preserves canonical kinds', () => {
    assert.equal(normalizeLetterKind('property_purchase'), 'certificate');
    assert.equal(normalizeLetterKind('item_purchase'), 'certificate');
    assert.equal(normalizeLetterKind('announcement'), 'announcement');
    assert.equal(normalizeLetterKind('invitation'), 'invitation');
    assert.equal(normalizeLetterKind('trade_offer'), 'trade_offer');
    assert.equal(normalizeLetterKind('friend_request'), 'friend_request');
    assert.equal(normalizeLetterKind('certificate'), 'certificate');
    assert.equal(normalizeLetterKind('message'), 'message');

    // Payload-embedded letterKind takes precedence when DB row used a fallback kind
    assert.equal(
      normalizeLetterKind('item_purchase', { letterKind: 'invitation', eventTitle: 'Plaza Jam' }),
      'invitation',
    );
    assert.equal(
      normalizeLetterKind('item_purchase', { letterKind: 'message', body: 'Hello!' }),
      'message',
    );
  });

  it('embeds decision cards ONLY in invitation, trade_offer, and friend_request', () => {
    assert.equal(hasLetterDecisionCard('invitation'), true);
    assert.equal(hasLetterDecisionCard('trade_offer'), true);
    assert.equal(hasLetterDecisionCard('friend_request'), true);

    assert.equal(hasLetterDecisionCard('announcement'), false);
    assert.equal(hasLetterDecisionCard('certificate'), false);
    assert.equal(hasLetterDecisionCard('message'), false);

    assert.ok(getLetterDecisionCopy('invitation'));
    assert.ok(getLetterDecisionCopy('trade_offer'));
    assert.ok(getLetterDecisionCopy('friend_request'));
    assert.equal(getLetterDecisionCopy('announcement'), null);
    assert.equal(getLetterDecisionCopy('certificate'), null);
    assert.equal(getLetterDecisionCopy('message'), null);
  });

  it('treats announcement and certificate as strictly read-only (no reply, no decision card)', () => {
    assert.equal(isLetterReadOnly('announcement'), true);
    assert.equal(isLetterReadOnly('certificate'), true);
    assert.equal(isLetterReadOnly('message'), false);
    assert.equal(isLetterReadOnly('invitation'), false);
    assert.equal(isLetterReadOnly('trade_offer'), false);
    assert.equal(isLetterReadOnly('friend_request'), false);

    assert.equal(
      canReplyToLetter({ kind: 'announcement', payload: { senderAccount: 'city.testnet' } }),
      false,
    );
    assert.equal(
      canReplyToLetter({ kind: 'certificate', payload: { sellerAccount: 'buddiesblitz.testnet' } }),
      false,
    );
    assert.equal(
      canReplyToLetter({ kind: 'message', payload: { senderAccount: 'alex.testnet' } }),
      true,
    );
    assert.equal(
      canReplyToLetter({ kind: 'invitation', payload: { senderAccount: 'hana.testnet' } }),
      true,
    );
  });

  it('tracks the three letter list states: unread, read, and needs-an-answer even after reading', () => {
    const unreadMessage: Pick<BuddiesLetter, 'kind' | 'isRead' | 'decisionState'> = {
      kind: 'message',
      isRead: false,
      decisionState: null,
    };
    assert.deepEqual(getLetterListRowState(unreadMessage), {
      isUnread: true,
      needsAnswer: false,
      envelopeIcon: 'closed',
      decisionBadge: null,
    });

    const readMessage: Pick<BuddiesLetter, 'kind' | 'isRead' | 'decisionState'> = {
      kind: 'message',
      isRead: true,
      decisionState: null,
    };
    assert.deepEqual(getLetterListRowState(readMessage), {
      isUnread: false,
      needsAnswer: false,
      envelopeIcon: 'open',
      decisionBadge: null,
    });

    // Decision-bearing letter keeps "waiting for your answer" after being read
    const readPendingInvite: Pick<BuddiesLetter, 'kind' | 'isRead' | 'decisionState'> = {
      kind: 'invitation',
      isRead: true,
      decisionState: 'pending',
    };
    assert.equal(letterNeedsAnswer(readPendingInvite), true);
    assert.deepEqual(getLetterListRowState(readPendingInvite), {
      isUnread: false,
      needsAnswer: true,
      envelopeIcon: 'open',
      decisionBadge: 'waiting',
    });

    // Once answered, needsAnswer clears
    const acceptedInvite: Pick<BuddiesLetter, 'kind' | 'isRead' | 'decisionState'> = {
      kind: 'invitation',
      isRead: true,
      decisionState: 'accepted',
    };
    assert.equal(letterNeedsAnswer(acceptedInvite), false);
    assert.deepEqual(getLetterListRowState(acceptedInvite), {
      isUnread: false,
      needsAnswer: false,
      envelopeIcon: 'open',
      decisionBadge: 'accepted',
    });
  });

  it('defaults decisionState to pending for decision-bearing kinds and null for others', () => {
    assert.equal(normalizeLetterDecisionState('trade_offer', undefined), 'pending');
    assert.equal(normalizeLetterDecisionState('friend_request', 'accepted'), 'accepted');
    assert.equal(normalizeLetterDecisionState('invitation', 'declined'), 'declined');
    assert.equal(normalizeLetterDecisionState('announcement', 'pending'), null);
    assert.equal(normalizeLetterDecisionState('certificate', 'pending'), null);
    assert.equal(normalizeLetterDecisionState('message', 'pending'), null);
  });

  it('formats reply subjects without stacking Re: prefixes and resolves sender names cleanly', () => {
    assert.equal(formatReplySubject('Sunset Plaza Meetup'), 'Re: Sunset Plaza Meetup');
    assert.equal(formatReplySubject('Re: Sunset Plaza Meetup'), 'Re: Sunset Plaza Meetup');
    assert.equal(formatReplySubject('   '), 'Re: Your letter');

    assert.equal(
      getLetterSenderDisplayName({ kind: 'announcement', payload: {} }),
      'City Hall',
    );
    assert.equal(
      getLetterSenderDisplayName({
        kind: 'certificate',
        payload: { sellerName: 'Urban Scooter Showroom' },
      }),
      'Urban Scooter Showroom',
    );
    assert.equal(
      getLetterReplyRecipientAccount({ payload: { senderAccount: 'Alex.testnet' } }),
      'alex.testnet',
    );
    assert.equal(getLetterKindLabel('announcement'), 'City Notice');
  });
});
