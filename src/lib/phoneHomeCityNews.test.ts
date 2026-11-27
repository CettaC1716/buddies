import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCityNewsCardSummary,
  buildOrderedWalletBalances,
  CANONICAL_BALANCE_ORDER,
} from './phoneHomeCityNews';

describe('phoneHomeCityNews & balance ordering', () => {
  it('orders wallet balances as RESPITE first, then NEAR, then LUL', () => {
    assert.deepEqual(CANONICAL_BALANCE_ORDER.slice(0, 3), ['RESPITE', 'NEAR', 'LUL']);

    const rows = buildOrderedWalletBalances({
      respiteBalance: 420,
      nearBalance: 1.5,
      lulBalance: 980,
      cyonBalance: 35,
      includeCyon: true,
    });
    assert.deepEqual(
      rows.map((r) => r.id),
      ['RESPITE', 'NEAR', 'LUL', 'CYON'],
    );
    assert.equal(rows[0].formattedAmount, '420');
    assert.equal(rows[1].formattedAmount, '1.50');
    assert.equal(rows[2].formattedAmount, '980');
    assert.equal(rows[3].formattedAmount, '35');
  });

  it('prefers newer unread city letter and routes to letters', () => {
    const summary = buildCityNewsCardSummary({
      latestPost: {
        text: 'Sunset hangout at Central Plaza',
        authorName: 'Hana',
        location: 'Central Plaza',
        createdAtMs: 1_700_000_000_000,
      },
      latestUnreadLetter: {
        title: 'Welcome gift from Cerria City Hall',
        createdAt: new Date(1_700_000_050_000).toISOString(),
        isRead: false,
      },
    });
    assert.equal(summary.targetApp, 'letters');
    assert.equal(summary.headline, 'Welcome gift from Cerria City Hall');
  });

  it('shows latest City Feed post and routes to city_feed when newer', () => {
    const summary = buildCityNewsCardSummary({
      latestPost: {
        text: 'Night market opens by the beach!',
        authorName: 'Kai',
        location: 'East Beach',
        createdAtMs: 1_700_000_100_000,
      },
      latestUnreadLetter: {
        title: 'Older letter',
        createdAt: new Date(1_700_000_010_000).toISOString(),
        isRead: false,
      },
    });
    assert.equal(summary.targetApp, 'city_feed');
    assert.equal(summary.headline, 'Night market opens by the beach!');
    assert.equal(summary.subtitle, 'Kai · East Beach');
  });

  it('provides a city pulse fallback when no posts or letters exist yet', () => {
    const summary = buildCityNewsCardSummary({ onlinePeersCount: 4 });
    assert.equal(summary.targetApp, 'city_feed');
    assert.equal(summary.headline, '4 neighbors out in Cerria');

    const emptySummary = buildCityNewsCardSummary({ onlinePeersCount: 0 });
    assert.equal(emptySummary.headline, 'Cerria City Pulse');
  });
});
