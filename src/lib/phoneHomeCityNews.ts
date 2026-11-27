import type { CityFeedPost } from './cityFeedService';
import type { BuddiesLetter } from './supabaseClient';
import { CERRIA_CITY_NAME } from './cerriaBrand';

/**
 * Pure helpers for the Phone Home "City News" widget and canonical
 * balance ordering (RESPITE -> NEAR -> LUL -> CYON).
 */

export type WalletCurrencyId = 'RESPITE' | 'NEAR' | 'LUL' | 'CYON';

export const CANONICAL_BALANCE_ORDER: readonly WalletCurrencyId[] = [
  'RESPITE',
  'NEAR',
  'LUL',
  'CYON',
] as const;

export const MASKED_BALANCE_TEXT = '••••';
export const BALANCE_PEEK_DURATION_MS = 10_000;

export interface WalletBalanceRowData {
  id: WalletCurrencyId;
  label: WalletCurrencyId;
  formattedAmount: string;
}

export function buildOrderedWalletBalances(params: {
  respiteBalance: number;
  nearBalance: number;
  lulBalance: number;
  cyonBalance?: number;
  includeCyon?: boolean;
}): WalletBalanceRowData[] {
  const safeRespite = Number.isFinite(params.respiteBalance) ? params.respiteBalance : 0;
  const safeNear = Number.isFinite(params.nearBalance) ? params.nearBalance : 0;
  const safeLul = Number.isFinite(params.lulBalance) ? params.lulBalance : 0;
  const safeCyon = Number.isFinite(params.cyonBalance ?? 0) ? (params.cyonBalance ?? 0) : 0;

  const nearFormatted =
    safeNear >= 1 ? safeNear.toFixed(2) : Number(safeNear.toFixed(4)).toString();

  const rows: WalletBalanceRowData[] = [
    {
      id: 'RESPITE',
      label: 'RESPITE',
      formattedAmount: Math.floor(safeRespite).toLocaleString(),
    },
    {
      id: 'NEAR',
      label: 'NEAR',
      formattedAmount: nearFormatted,
    },
    {
      id: 'LUL',
      label: 'LUL',
      formattedAmount: Math.floor(safeLul).toLocaleString(),
    },
  ];

  if (params.includeCyon) {
    rows.push({
      id: 'CYON',
      label: 'CYON',
      formattedAmount: Math.floor(safeCyon).toLocaleString(),
    });
  }

  return rows;
}

export interface CityNewsCardSummary {
  headline: string;
  subtitle: string;
  badgeLabel: string;
  targetApp: 'city_feed' | 'letters';
}

export function buildCityNewsCardSummary(params: {
  latestPost?: Pick<CityFeedPost, 'text' | 'authorName' | 'location' | 'createdAtMs'> | null;
  latestUnreadLetter?: Pick<BuddiesLetter, 'title' | 'createdAt' | 'isRead'> | null;
  onlinePeersCount?: number;
}): CityNewsCardSummary {
  const post = params.latestPost ?? null;
  const letter = params.latestUnreadLetter && !params.latestUnreadLetter.isRead
    ? params.latestUnreadLetter
    : null;

  const letterMs = letter ? Date.parse(letter.createdAt) || 0 : 0;
  const postMs = post ? post.createdAtMs || 0 : 0;

  if (letter && (!post || letterMs >= postMs)) {
    return {
      headline: letter.title.trim() || 'New city letter arrived',
      subtitle: 'Unread letter · Tap to read',
      badgeLabel: 'Letter',
      targetApp: 'letters',
    };
  }

  if (post && post.text.trim().length > 0) {
    const metaParts = [post.authorName?.trim(), post.location?.trim()].filter(Boolean);
    return {
      headline: post.text.trim(),
      subtitle: metaParts.length > 0 ? metaParts.join(' · ') : 'Latest on City Feed',
      badgeLabel: 'Feed',
      targetApp: 'city_feed',
    };
  }

  const peers = Math.max(0, Math.floor(params.onlinePeersCount ?? 0));
  return {
    headline: peers > 0 ? `${peers} neighbors out in ${CERRIA_CITY_NAME}` : `${CERRIA_CITY_NAME} City Pulse`,
    subtitle: 'Tap to open City Feed',
    badgeLabel: 'Live',
    targetApp: 'city_feed',
  };
}
