/**
 * Pure domain rules for the Buddies City Letters inbox (email model).
 *
 * Letters represent formal city messages that a player reads and optionally
 * answers:
 * - Read-only kinds: `announcement`, `certificate` (no reply, no decision card)
 * - Reply-only kind: `message` (read + reply, no decision card)
 * - Decision-bearing kinds: `invitation`, `trade_offer`, `friend_request`
 *   (read + reply + embedded decision card)
 */

export type BuddiesLetterKind =
  | 'announcement'
  | 'invitation'
  | 'trade_offer'
  | 'friend_request'
  | 'certificate'
  | 'message';

export type LegacyBuddiesLetterKind = 'property_purchase' | 'item_purchase';

export type BuddiesLetterInputKind = BuddiesLetterKind | LegacyBuddiesLetterKind;

export type BuddiesLetterDecisionState = 'pending' | 'accepted' | 'declined';

export interface BuddiesLetterPayload {
  // Email & formal letter fields
  senderName?: string;
  senderAccount?: string;
  body?: string;
  replyToLetterId?: string;
  replyToSubject?: string;
  letterKind?: BuddiesLetterKind;
  decisionState?: BuddiesLetterDecisionState;
  decisionUpdatedAt?: string;

  // Event invitation fields
  eventTitle?: string;
  eventLocation?: string;
  eventTime?: string;

  // Formal trade offer fields
  tradeListingId?: string;
  tradeOfferSummary?: string;

  // Mutual friend acceptance confirmation metadata
  friendAcceptedByAccount?: string;
  friendAcceptedByName?: string;

  // Purchase certificate fields (kept compatible with existing records)
  buyerName?: string;
  buyerAccount?: string;
  sellerName?: string;
  sellerAccount?: string;
  itemName?: string;
  itemId?: string;
  tokenId?: string;
  assetKind?: string;
  houseStyle?: string;
  deedTokenId?: string;
  estateAccount?: string;
  priceAmount?: number;
  priceCurrency?: string;
  settlementContract?: string;
  paymentTx?: string;
}

export interface BuddiesLetter {
  id: string;
  recipientAccount: string;
  kind: BuddiesLetterKind;
  title: string;
  payload: BuddiesLetterPayload;
  txHash: string | null;
  isRead: boolean;
  decisionState: BuddiesLetterDecisionState | null;
  createdAt: string;
}

const CANONICAL_LETTER_KINDS = new Set<BuddiesLetterKind>([
  'announcement',
  'invitation',
  'trade_offer',
  'friend_request',
  'certificate',
  'message',
]);

const DECISION_BEARING_KINDS = new Set<BuddiesLetterKind>([
  'invitation',
  'trade_offer',
  'friend_request',
]);

const READ_ONLY_KINDS = new Set<BuddiesLetterKind>([
  'announcement',
  'certificate',
]);

export function isCanonicalLetterKind(value: unknown): value is BuddiesLetterKind {
  return typeof value === 'string' && CANONICAL_LETTER_KINDS.has(value as BuddiesLetterKind);
}

/**
 * Normalizes legacy DB kinds (`property_purchase`, `item_purchase`) and
 * payload-embedded `letterKind` overrides into one of the six canonical kinds.
 */
export function normalizeLetterKind(
  rawKind: string | null | undefined,
  payload?: BuddiesLetterPayload | null,
): BuddiesLetterKind {
  if (payload?.letterKind && isCanonicalLetterKind(payload.letterKind)) {
    return payload.letterKind;
  }
  const clean = typeof rawKind === 'string' ? rawKind.trim().toLowerCase() : '';
  if (isCanonicalLetterKind(clean)) {
    return clean;
  }
  if (clean === 'property_purchase' || clean === 'item_purchase') {
    return 'certificate';
  }
  if (
    payload &&
    (payload.deedTokenId ||
      payload.itemName ||
      payload.settlementContract ||
      payload.paymentTx)
  ) {
    return 'certificate';
  }
  return 'message';
}

export function hasLetterDecisionCard(kind: BuddiesLetterKind): boolean {
  return DECISION_BEARING_KINDS.has(kind);
}

export function isLetterReadOnly(kind: BuddiesLetterKind): boolean {
  return READ_ONLY_KINDS.has(kind);
}

export function normalizeLetterDecisionState(
  kind: BuddiesLetterKind,
  rawState: unknown,
): BuddiesLetterDecisionState | null {
  if (!hasLetterDecisionCard(kind)) return null;
  if (rawState === 'accepted' || rawState === 'declined' || rawState === 'pending') {
    return rawState;
  }
  return 'pending';
}

export function letterNeedsAnswer(
  letter: Pick<BuddiesLetter, 'kind' | 'decisionState'>,
): boolean {
  return hasLetterDecisionCard(letter.kind) && letter.decisionState === 'pending';
}

export function canReplyToLetter(
  letter: Pick<BuddiesLetter, 'kind' | 'payload'>,
): boolean {
  return !isLetterReadOnly(letter.kind);
}

export function getLetterReplyRecipientAccount(
  letter: Pick<BuddiesLetter, 'payload'>,
): string | null {
  const raw = (letter.payload.senderAccount || letter.payload.sellerAccount || '').trim().toLowerCase();
  return raw.length >= 2 ? raw : null;
}

export function getLetterSenderDisplayName(
  letter: Pick<BuddiesLetter, 'kind' | 'payload'>,
): string {
  const explicit = letter.payload.senderName?.trim();
  if (explicit) return explicit;
  if (letter.kind === 'certificate') {
    return (
      letter.payload.sellerName?.trim() ||
      letter.payload.sellerAccount?.trim() ||
      'Buddies City'
    );
  }
  if (letter.kind === 'announcement') {
    return 'City Hall';
  }
  return letter.payload.senderAccount?.trim() || 'Buddies Citizen';
}

export function getLetterKindLabel(kind: BuddiesLetterKind): string {
  switch (kind) {
    case 'announcement':
      return 'City Notice';
    case 'invitation':
      return 'Invitation';
    case 'trade_offer':
      return 'Trade Offer';
    case 'friend_request':
      return 'Friend Request';
    case 'certificate':
      return 'Certificate';
    case 'message':
      return 'Letter';
  }
}

export function getLetterDecisionCopy(kind: BuddiesLetterKind): {
  heading: string;
  acceptLabel: string;
  declineLabel: string;
  acceptedBadge: string;
  declinedBadge: string;
} | null {
  switch (kind) {
    case 'invitation':
      return {
        heading: 'Event RSVP',
        acceptLabel: 'Going',
        declineLabel: 'Decline',
        acceptedBadge: 'Going',
        declinedBadge: 'Declined',
      };
    case 'trade_offer':
      return {
        heading: 'Formal Trade Offer',
        acceptLabel: 'Accept',
        declineLabel: 'Decline',
        acceptedBadge: 'Accepted',
        declinedBadge: 'Declined',
      };
    case 'friend_request':
      return {
        heading: 'Friend Request',
        acceptLabel: 'Accept',
        declineLabel: 'Decline',
        acceptedBadge: 'Accepted',
        declinedBadge: 'Declined',
      };
    default:
      return null;
  }
}

export function formatReplySubject(originalSubject: string): string {
  const clean = (originalSubject || '').trim();
  if (!clean) return 'Re: Your letter';
  if (/^re:\s*/i.test(clean)) return clean;
  return `Re: ${clean}`.slice(0, 160);
}

export interface LetterListRowState {
  isUnread: boolean;
  needsAnswer: boolean;
  envelopeIcon: 'closed' | 'open';
  decisionBadge: 'waiting' | 'accepted' | 'declined' | null;
}

export function getLetterListRowState(
  letter: Pick<BuddiesLetter, 'kind' | 'isRead' | 'decisionState'>,
): LetterListRowState {
  const isUnread = !letter.isRead;
  const needsAnswer = letterNeedsAnswer(letter);
  let decisionBadge: LetterListRowState['decisionBadge'] = null;
  if (hasLetterDecisionCard(letter.kind)) {
    if (letter.decisionState === 'accepted') decisionBadge = 'accepted';
    else if (letter.decisionState === 'declined') decisionBadge = 'declined';
    else decisionBadge = 'waiting';
  }
  return {
    isUnread,
    needsAnswer,
    envelopeIcon: isUnread ? 'closed' : 'open',
    decisionBadge,
  };
}
