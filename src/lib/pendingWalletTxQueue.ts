import type { LocalTxConfirmRequest } from './nearClient';

/**
 * In-phone pending transaction queue rules & plain-English formatting.
 *
 * Every sub-wallet transaction still requires explicit player approval before
 * signing in `nearClient.ts`. Requests carry an expiry and cannot be
 * confirmed once expired.
 */

export const PENDING_TX_TTL_MS = 120_000;

export interface PendingWalletTxItem {
  id: string;
  request: LocalTxConfirmRequest;
  createdAtMs: number;
  expiresAtMs: number;
  resolve: (approved: boolean) => void;
  resolved?: boolean;
}

export interface PendingTxDisplaySummary {
  actionLabel: string;
  itemLabel: string | null;
  amountLabel: string | null;
  recipientLabel: string;
  detailRows: ReadonlyArray<[string, string]>;
  feeNote: string;
}

const PLAIN_ENGLISH_METHOD_LABELS: Record<string, string> = {
  swap_near_for_respite: 'Exchange NEAR for RESPITE',
  claim_hana_welcome_near: 'Claim Starter Pack from Hana',
  claim_hana_welcome_near_attested: 'Claim Starter Pack from Hana',
  buy_merchant_item: 'Buy item from Shop',
  sell_merchant_item: 'Sell item to Shop',
  purchase_citizen_asset: 'Buy House or Companion',
  list_property_deed: 'List House for sale',
  list_property_furniture: 'List Furniture for sale',
  buy_property: 'Buy listed property',
  cancel_property_listing: 'Cancel property listing',
  mint_fish_nft: 'Save Fish as collectible',
  mint_fish_nft_attested: 'Save Fish as collectible',
  list_fish_nft: 'List Fish for sale',
  buy_fish_nft: 'Buy Fish',
  unlist_fish_nft: 'Remove Fish listing',
  ft_transfer: 'Send RESPITE',
  nft_transfer: 'Send Collectible',
  mt_transfer: 'Send Collectible Item',
  fund_deed_royalty: 'Add to House Account',
  claim_deed_payout: 'Collect from House Account',
  authorize_deed_session_key: 'Allow House Access',
  mint_merchant_item: 'Claim Shop Item',
};

const DETAIL_KEY_LABELS: Record<string, string> = {
  catalog_id: 'Item',
  token_id: 'Item code',
  listing_id: 'Listing',
  item_id: 'Item',
  amount: 'Amount',
  price: 'Price',
  receiver_id: 'Recipient',
};

export function createPendingWalletTxItem(params: {
  id: string;
  request: LocalTxConfirmRequest;
  resolve: (approved: boolean) => void;
  nowMs?: number;
  ttlMs?: number;
}): PendingWalletTxItem {
  const createdAtMs = params.nowMs ?? Date.now();
  const ttlMs = params.ttlMs ?? PENDING_TX_TTL_MS;
  return {
    id: params.id,
    request: params.request,
    createdAtMs,
    expiresAtMs: createdAtMs + Math.max(1_000, ttlMs),
    resolve: params.resolve,
    resolved: false,
  };
}

export function isPendingTxExpired(
  item: Pick<PendingWalletTxItem, 'expiresAtMs'>,
  nowMs: number = Date.now(),
): boolean {
  return nowMs >= item.expiresAtMs;
}

export function canConfirmPendingTx(
  item: Pick<PendingWalletTxItem, 'expiresAtMs' | 'resolved'>,
  nowMs: number = Date.now(),
): boolean {
  return !item.resolved && !isPendingTxExpired(item, nowMs);
}

export function getPendingTxRemainingSeconds(
  item: Pick<PendingWalletTxItem, 'expiresAtMs'>,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Math.ceil((item.expiresAtMs - nowMs) / 1000));
}

export function formatPendingTxCountdown(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.floor(remainingSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function partitionPendingWalletTxs<T extends Pick<PendingWalletTxItem, 'expiresAtMs'>>(
  items: readonly T[],
  nowMs: number = Date.now(),
): { active: T[]; expired: T[] } {
  const active: T[] = [];
  const expired: T[] = [];
  for (const item of items) {
    if (isPendingTxExpired(item, nowMs)) {
      expired.push(item);
    } else {
      active.push(item);
    }
  }
  return { active, expired };
}

export function formatNearFromYocto(yocto: string): string {
  try {
    const raw = BigInt(yocto || '0');
    if (raw === 0n) return '0';
    const whole = raw / 10n ** 24n;
    const frac = raw % 10n ** 24n;
    const fracStr = frac.toString().padStart(24, '0').slice(0, 6).replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return '0';
  }
}

export function formatPendingTxSummary(request: LocalTxConfirmRequest): PendingTxDisplaySummary {
  const actionLabel = PLAIN_ENGLISH_METHOD_LABELS[request.methodName] ?? 'Confirm Payment';
  const args = request.args ?? {};

  const itemRaw = args.catalog_id ?? args.item_id ?? args.listing_id ?? args.token_id;
  const itemLabel =
    typeof itemRaw === 'string' || typeof itemRaw === 'number'
      ? String(itemRaw).replace(/_/g, ' ')
      : null;

  const recipientRaw =
    typeof args.receiver_id === 'string' && args.receiver_id.trim().length > 0
      ? args.receiver_id.trim()
      : request.receiverId;

  const depositNear = formatNearFromYocto(request.depositYocto);
  const hasNearDeposit = depositNear !== '0';

  let amountLabel: string | null = null;
  if (hasNearDeposit) {
    amountLabel = `${depositNear} NEAR`;
  } else if (typeof args.amount === 'string' || typeof args.amount === 'number') {
    const num = Number(args.amount);
    const formatted = Number.isFinite(num) ? num.toLocaleString() : String(args.amount);
    amountLabel =
      request.methodName === 'ft_transfer' ? `${formatted} RESPITE` : formatted;
  } else if (typeof args.price === 'string' || typeof args.price === 'number') {
    const num = Number(args.price);
    const formatted = Number.isFinite(num) ? num.toLocaleString() : String(args.price);
    amountLabel = `${formatted} RESPITE`;
  }

  const detailRows: Array<[string, string]> = [];
  const interesting = ['catalog_id', 'item_id', 'listing_id', 'token_id', 'amount', 'price'];
  for (const key of interesting) {
    const value = args[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const displayVal =
        key === 'catalog_id' || key === 'item_id'
          ? String(value).replace(/_/g, ' ')
          : String(value);
      detailRows.push([DETAIL_KEY_LABELS[key] ?? key.replace(/_/g, ' '), displayVal]);
    }
  }

  return {
    actionLabel,
    itemLabel,
    amountLabel,
    recipientLabel: recipientRaw,
    detailRows: detailRows.slice(0, 3),
    feeNote: 'Small service fee (< 0.01 NEAR from balance)',
  };
}
