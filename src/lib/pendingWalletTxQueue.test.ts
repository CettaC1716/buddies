import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canConfirmPendingTx,
  createPendingWalletTxItem,
  formatPendingTxCountdown,
  formatPendingTxSummary,
  getPendingTxRemainingSeconds,
  isPendingTxExpired,
  partitionPendingWalletTxs,
} from './pendingWalletTxQueue';

describe('pendingWalletTxQueue', () => {
  it('enforces expiry and prevents confirming expired requests', () => {
    const now = 1_700_000_000_000;
    const item = createPendingWalletTxItem({
      id: 'tx-1',
      request: {
        signerAccountId: 'alice.buddiesblitz.testnet',
        receiverId: 'market.buddiesblitz.testnet',
        methodName: 'buy_merchant_item',
        args: { catalog_id: 'cozy_lamp', price: 25 },
        gas: '30000000000000',
        depositYocto: '0',
      },
      resolve: () => {},
      nowMs: now,
      ttlMs: 60_000,
    });

    assert.equal(isPendingTxExpired(item, now + 30_000), false);
    assert.equal(canConfirmPendingTx(item, now + 30_000), true);
    assert.equal(getPendingTxRemainingSeconds(item, now + 30_000), 30);
    assert.equal(formatPendingTxCountdown(30), '0:30');
    assert.equal(formatPendingTxCountdown(95), '1:35');

    assert.equal(isPendingTxExpired(item, now + 60_000), true);
    assert.equal(canConfirmPendingTx(item, now + 60_000), false);
    assert.equal(getPendingTxRemainingSeconds(item, now + 75_000), 0);
  });

  it('partitions active and expired pending requests', () => {
    const now = 1_700_000_000_000;
    const expiredItem = createPendingWalletTxItem({
      id: 'old',
      request: {
        signerAccountId: 'a.buddiesblitz.testnet',
        receiverId: 'b.buddiesblitz.testnet',
        methodName: 'ft_transfer',
        args: { receiver_id: 'bob.buddiesblitz.testnet', amount: '10' },
        gas: '30000000000000',
        depositYocto: '0',
      },
      resolve: () => {},
      nowMs: now - 130_000,
      ttlMs: 120_000,
    });
    const freshItem = createPendingWalletTxItem({
      id: 'fresh',
      request: {
        signerAccountId: 'a.buddiesblitz.testnet',
        receiverId: 'b.buddiesblitz.testnet',
        methodName: 'swap_near_for_respite',
        args: {},
        gas: '30000000000000',
        depositYocto: '250000000000000000000000',
      },
      resolve: () => {},
      nowMs: now - 10_000,
      ttlMs: 120_000,
    });

    const { active, expired } = partitionPendingWalletTxs([expiredItem, freshItem], now);
    assert.deepEqual(
      active.map((i) => i.id),
      ['fresh'],
    );
    assert.deepEqual(
      expired.map((i) => i.id),
      ['old'],
    );
  });

  it('formats plain-English summaries with action, amount, and recipient', () => {
    const transferSummary = formatPendingTxSummary({
      signerAccountId: 'alice.buddiesblitz.testnet',
      receiverId: 'respite.buddiesblitz.testnet',
      methodName: 'ft_transfer',
      args: { receiver_id: 'bob.buddiesblitz.testnet', amount: '120' },
      gas: '30000000000000',
      depositYocto: '0',
    });
    assert.equal(transferSummary.actionLabel, 'Send RESPITE');
    assert.equal(transferSummary.amountLabel, '120 RESPITE');
    assert.equal(transferSummary.recipientLabel, 'bob.buddiesblitz.testnet');

    const swapSummary = formatPendingTxSummary({
      signerAccountId: 'alice.buddiesblitz.testnet',
      receiverId: 'swap.buddiesblitz.testnet',
      methodName: 'swap_near_for_respite',
      args: {},
      gas: '30000000000000',
      depositYocto: '250000000000000000000000',
    });
    assert.equal(swapSummary.actionLabel, 'Exchange NEAR for RESPITE');
    assert.equal(swapSummary.amountLabel, '0.25 NEAR');
    assert.equal(swapSummary.recipientLabel, 'swap.buddiesblitz.testnet');
  });
});
