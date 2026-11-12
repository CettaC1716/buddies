/**
 * Supabase Full-Stack Client for Buddies Blitz
 * Handles:
 * - Real-time Social Chat (`bb_social_messages`)
 * - Player Profile & Balances (`bb_profiles`)
 * - Autonomous AI Merchant State & Market Transactions (`bb_npc_merchants`, `bb_market_transactions`)
 * - NEP-171 Gamepass Sub-Account Ledgers (`bb_gamepass_nfts`)
 * - Safezone / Warzone Claimed Base Plots (`bb_base_plots`)
 * - 3D Private House Interior State (`bb_house_interiors`)
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  Nep171GamepassSubAccountLedger,
  Nep171OwnershipHistoryEntry,
  NearNetworkId,
} from './nearClient';
import {
  FISH_SPECIES_CATALOG,
  type FishNftMarketplaceListing,
  type FishingWaterZoneId,
} from '../game/buddiesFishingMarket';

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const SUPABASE_URL = (metaEnv.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (metaEnv.VITE_SUPABASE_ANON_KEY || '').trim();

export function isValidSupabaseConfig(url: string, anonKey: string): boolean {
  if (!url || !anonKey) return false;
  if (
    url.includes('your-project-ref.supabase.co') ||
    url.includes('placeholder') ||
    url.includes('example.supabase.co') ||
    anonKey === 'your-anon-key-here' ||
    anonKey === 'placeholder'
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidSupabaseConfig(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface DbPlayerProfile {
  id: string;
  near_account_id: string;
  auth_mode: 'social_invisible' | 'wallet_selector';
  display_name: string;
  email: string | null;
  lul_balance: number;
  cyon_balance: number;
  respite_balance: number;
  warzone_gold: number;
  owned_token_ids: string[];
  unlocked_skins: string[];
  updated_at?: string;
}

export interface DbNpcMerchantRow {
  merchant_id: 'lobby_cafe' | 'beach_house';
  npc_name: string;
  near_wallet_address: string;
  cyon_treasury: number;
  respite_treasury: number;
  is_bankrupt: boolean;
  stock_by_item: Record<string, number>;
  recent_demand_by_item: Record<string, number>;
  investors: Array<{
    investorName: string;
    investedCyon: number;
    sharePercent: number;
    dividendsPaidCyon: number;
  }>;
  simulated_day: number;
  last_headline: string;
  updated_at?: string;
}

export interface DbSocialMessageRow {
  id: string;
  sender_name: string;
  sender_near_account: string | null;
  recipient_name: string | null;
  message: string;
  bubble_color: string;
  created_at: string;
}

export interface DbHouseInteriorRow {
  owner_near_account: string;
  active_theme_id: string;
  daylight_hour: number;
  placed_furniture: unknown[];
  mood_scores: Record<string, number>;
  updated_at?: string;
}

export interface DbGamepassNftRow {
  token_id: string;
  owner_near_account: string;
  sub_account_id: string;
  treasury_respite: number;
  total_earned_respite: number;
  total_paid_out_respite: number;
  pending_payout_respite: number;
  active_access_key: string;
  ownership_history: Nep171OwnershipHistoryEntry[];
  network: NearNetworkId;
  tx_hash: string | null;
  updated_at?: string;
}

export interface DbBasePlotRow {
  plot_key: string;
  team: 'blue' | 'red';
  plot_index: number;
  is_model_estate: boolean;
  is_claimed: boolean;
  claimed_by_near_account: string | null;
  claimed_by_token_id: string | null;
  base_level: number;
  skin_theme_id: string;
  garden_preset_id: string;
  access_mode: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
  allowed_friends: string[];
  active_harvesters: unknown[];
  updated_at?: string;
}

function sanitizeAccountId(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 64);
}

function sanitizeDisplayName(raw: string): string {
  return (
    raw
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 48) || 'COMMANDER'
  );
}

function clampSafeBalance(val: number, max = 1_000_000): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(max, Number(val.toFixed(4))));
}

/**
 * Initiates real Google OAuth sign-in via Supabase Auth.
 */
export async function signInWithSupabaseGoogle(): Promise<{ started: boolean; error?: string }> {
  if (!supabase) {
    return { started: false, error: 'Supabase not configured' };
  }
  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) {
      return { started: false, error: error.message };
    }
    return { started: true };
  } catch (err) {
    return { started: false, error: err instanceof Error ? err.message : 'Google OAuth error' };
  }
}

/**
 * Signs out the active Supabase Auth session (Google OAuth / session).
 */
export async function signOutSupabaseAuth(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out errors
  }
}

/**
 * Fetches the currently authenticated Google OAuth user from Supabase Auth (if any),
 * and subscribes to future `onAuthStateChange` events.
 */
export function subscribeToSupabaseAuthUser(
  onAuthenticated: (user: { email: string; displayName: string; uid: string }) => void,
): () => void {
  if (!supabase) return () => {};

  supabase.auth
    .getSession()
    .then(({ data }) => {
      const u = data?.session?.user;
      if (u && u.email) {
        const meta = (u.user_metadata || {}) as Record<string, unknown>;
        const rawName = String(meta.full_name || meta.name || u.email.split('@')[0] || 'BUDDY');
        onAuthenticated({
          email: u.email,
          displayName: sanitizeDisplayName(rawName),
          uid: u.id,
        });
      }
    })
    .catch(() => {});

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    if (u && u.email) {
      const meta = (u.user_metadata || {}) as Record<string, unknown>;
      const rawName = String(meta.full_name || meta.name || u.email.split('@')[0] || 'BUDDY');
      onAuthenticated({
        email: u.email,
        displayName: sanitizeDisplayName(rawName),
        uid: u.id,
      });
    }
  });

  return () => {
    sub?.subscription?.unsubscribe();
  };
}

/**
 * Fetches an existing player profile by Google email address.
 * Emails are stored in the locked `bb_profile_contacts` table and are never
 * exposed through the REST API; the SECURITY DEFINER RPC
 * `bb_lookup_account_by_email` returns only the matching NEAR account id,
 * then the public profile row is loaded by account id.
 */
export async function fetchPlayerProfileByEmail(email: string): Promise<DbPlayerProfile | null> {
  if (!supabase) return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return null;

  try {
    const { data: accountId, error: rpcError } = await supabase.rpc('bb_lookup_account_by_email', {
      p_email: cleanEmail,
    });
    if (rpcError || !accountId) return null;

    const { data, error } = await supabase
      .from('bb_profiles')
      .select('*')
      .eq('near_account_id', accountId as string)
      .maybeSingle();

    if (error || !data) return null;
    return data as DbPlayerProfile;
  } catch {
    return null;
  }
}

/**
 * Mirrors a recipient's verified on-chain `ft_balance_of` (`market.buddiesblitz.testnet`)
 * into `bb_profiles.respite_balance` strictly as a non-authoritative UI read-cache after an
 * on-chain `ft_transfer` or `buy_fish_nft` settlement.
 */
export async function mirrorRecipientOnChainRespiteCacheInSupabase(
  recipientNearAccount: string,
  verifiedOnChainRespite: number,
): Promise<boolean> {
  if (!supabase) return false;
  const cleanRecipient = sanitizeAccountId(recipientNearAccount);
  const cleanBalance = clampSafeBalance(verifiedOnChainRespite, 100_000);
  if (cleanRecipient.length < 2) return false;

  try {
    const { data: existing } = await supabase
      .from('bb_profiles')
      .select('display_name')
      .eq('near_account_id', cleanRecipient)
      .maybeSingle();

    const { error } = await supabase.from('bb_profiles').upsert(
      {
        near_account_id: cleanRecipient,
        display_name: existing?.display_name || cleanRecipient.split('.')[0] || 'CITIZEN',
        respite_balance: cleanBalance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'near_account_id' },
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches or creates a Player Profile in `bb_profiles` keyed by `near_account_id`.
 * Never grants fake initial balances or unpurchased tokens.
 */
export async function fetchOrCreatePlayerProfile(params: {
  nearAccountId: string;
  authMode: 'social_invisible' | 'wallet_selector';
  displayName: string;
  email?: string;
}): Promise<DbPlayerProfile | null> {
  if (!supabase) return null;
  const cleanAccount = sanitizeAccountId(params.nearAccountId);
  if (cleanAccount.length < 2) return null;

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('bb_profiles')
      .select('*')
      .eq('near_account_id', cleanAccount)
      .maybeSingle();

    if (!fetchErr && existing) {
      if (params.email && !existing.email) {
        await supabase
          .from('bb_profiles')
          .update({
            email: params.email.trim().toLowerCase().slice(0, 120),
            display_name: sanitizeDisplayName(params.displayName),
            updated_at: new Date().toISOString(),
          })
          .eq('near_account_id', cleanAccount);
      }
      return existing as DbPlayerProfile;
    }

    const newRow = {
      near_account_id: cleanAccount,
      auth_mode: params.authMode,
      display_name: sanitizeDisplayName(params.displayName),
      email: params.email ? params.email.trim().toLowerCase().slice(0, 120) : null,
      lul_balance: 0,
      cyon_balance: 0,
      respite_balance: 0,
      warzone_gold: 0,
      owned_token_ids: [],
      unlocked_skins: ['default'],
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('bb_profiles')
      .upsert(newRow, { onConflict: 'near_account_id' })
      .select('*')
      .single();

    if (insertErr) return null;
    return inserted as DbPlayerProfile;
  } catch {
    return null;
  }
}

/**
 * Syncs updated player balances and owned NEP-245 tokens to `bb_profiles`.
 */
export async function syncPlayerBalancesToSupabase(params: {
  nearAccountId: string;
  lulBalance: number;
  cyonBalance: number;
  respiteBalance: number;
  warzoneGold?: number;
  ownedTokenIds?: string[];
  unlockedSkins?: string[];
  displayName?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  const cleanAccount = sanitizeAccountId(params.nearAccountId);
  if (cleanAccount.length < 2) return false;

  try {
    const updatePayload: Record<string, unknown> = {
      near_account_id: cleanAccount,
      lul_balance: clampSafeBalance(params.lulBalance),
      cyon_balance: clampSafeBalance(params.cyonBalance),
      respite_balance: clampSafeBalance(params.respiteBalance, 100_000),
      updated_at: new Date().toISOString(),
    };
    if (params.warzoneGold !== undefined) {
      updatePayload.warzone_gold = clampSafeBalance(params.warzoneGold);
    }
    if (params.ownedTokenIds !== undefined) {
      updatePayload.owned_token_ids = params.ownedTokenIds.slice(0, 100);
    }
    if (params.unlockedSkins !== undefined) {
      updatePayload.unlocked_skins = params.unlockedSkins.slice(0, 50);
    }
    if (params.displayName !== undefined) {
      updatePayload.display_name = sanitizeDisplayName(params.displayName);
    }

    const { error } = await supabase
      .from('bb_profiles')
      .upsert(updatePayload, { onConflict: 'near_account_id' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches all NPC Merchant rows (`lobby_cafe`, `beach_house`) from `bb_npc_merchants`.
 */
export async function fetchNpcMerchantsFromSupabase(): Promise<DbNpcMerchantRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('bb_npc_merchants').select('*');
    if (error || !data) return [];
    return data as DbNpcMerchantRow[];
  } catch {
    return [];
  }
}

/**
 * Persists an NPC Merchant's treasury, stock, investors, and AI reasoning headline to `bb_npc_merchants`.
 */
export async function syncNpcMerchantToSupabase(params: {
  merchantId?: 'lobby_cafe' | 'beach_house';
  merchant_id?: 'lobby_cafe' | 'beach_house';
  npcName?: string;
  nearWalletAddress?: string;
  cyonTreasury?: number;
  cyon_treasury?: number;
  respiteTreasury?: number;
  isBankrupt?: boolean;
  is_bankrupt?: boolean;
  stockByItem?: Record<string, number>;
  stock_by_item?: Record<string, number>;
  recentDemandByItem?: Record<string, number>;
  recent_demand_by_item?: Record<string, number>;
  investors?: DbNpcMerchantRow['investors'];
  simulatedDay?: number;
  simulated_day?: number;
  lastHeadline?: string;
  last_headline?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  const merchantId = params.merchantId || params.merchant_id;
  if (!merchantId) return false;
  try {
    const payload: Record<string, unknown> = {
      merchant_id: merchantId,
      updated_at: new Date().toISOString(),
    };
    if (params.npcName !== undefined) payload.npc_name = params.npcName.slice(0, 64);
    if (params.nearWalletAddress !== undefined) {
      payload.near_wallet_address = sanitizeAccountId(params.nearWalletAddress);
    }
    const cyon = params.cyonTreasury ?? params.cyon_treasury;
    if (cyon !== undefined) payload.cyon_treasury = clampSafeBalance(cyon, 5_000_000);
    if (params.respiteTreasury !== undefined) {
      payload.respite_treasury = clampSafeBalance(params.respiteTreasury, 500_000);
    }
    const bankrupt = params.isBankrupt ?? params.is_bankrupt;
    if (bankrupt !== undefined) payload.is_bankrupt = Boolean(bankrupt);
    const stock = params.stockByItem ?? params.stock_by_item;
    if (stock !== undefined) payload.stock_by_item = stock;
    const demand = params.recentDemandByItem ?? params.recent_demand_by_item;
    if (demand !== undefined) payload.recent_demand_by_item = demand;
    if (params.investors !== undefined) payload.investors = params.investors.slice(0, 50);
    const day = params.simulatedDay ?? params.simulated_day;
    if (day !== undefined) payload.simulated_day = Math.max(1, Math.min(100_000, Math.floor(day)));
    const headline = params.lastHeadline ?? params.last_headline;
    if (headline !== undefined) payload.last_headline = headline.slice(0, 240);

    const { error } = await supabase
      .from('bb_npc_merchants')
      .upsert(payload, { onConflict: 'merchant_id' });
    return !error;
  } catch {
    return false;
  }
}

export interface DbMarketTransactionRow {
  id: string;
  merchant_id: 'lobby_cafe' | 'beach_house' | null;
  actor_near_account: string;
  action_type: string;
  item_id: string | null;
  nep245_token_id: string | null;
  currency: 'LUL' | 'CYON' | 'RESPITE' | 'GOLD' | 'NEAR';
  amount: number;
  unit_price: number;
  reasoning_summary: string;
  near_tx_hash: string | null;
  created_at: string;
}

const sessionMarketTransactions: DbMarketTransactionRow[] = [];
const marketTransactionListeners = new Set<(rows: DbMarketTransactionRow[]) => void>();

export function subscribeToMarketTransactions(
  listener: (rows: DbMarketTransactionRow[]) => void,
): () => void {
  marketTransactionListeners.add(listener);
  listener([...sessionMarketTransactions]);
  return () => {
    marketTransactionListeners.delete(listener);
  };
}

/**
 * Logs an economy or NFT transaction to `bb_market_transactions`.
 */
export async function logMarketTransactionToSupabase(params: {
  merchantId?: 'lobby_cafe' | 'beach_house' | null;
  merchant_id?: 'lobby_cafe' | 'beach_house' | null;
  actorNearAccount?: string;
  actor_near_account?: string;
  actionType?: string;
  action_type?: string;
  itemId?: string;
  item_id?: string;
  nep245TokenId?: string;
  nep245_token_id?: string;
  currency: 'LUL' | 'CYON' | 'RESPITE' | 'GOLD' | 'NEAR';
  amount: number;
  unitPrice?: number;
  unit_price?: number;
  reasoningSummary?: string;
  reasoning_summary?: string;
  nearTxHash?: string;
  near_tx_hash?: string;
}): Promise<boolean> {
  const rawActor = params.actorNearAccount || params.actor_near_account || '';
  const cleanActor = sanitizeAccountId(rawActor);
  const summary = (params.reasoningSummary || params.reasoning_summary || '')
    .replace(/[<>]/g, '')
    .slice(0, 280);
  const txHash = params.nearTxHash || params.near_tx_hash;
  const actionType = (params.actionType || params.action_type || 'BUY_ITEM').toUpperCase();
  const createdAt = new Date().toISOString();

  const localEntry: DbMarketTransactionRow = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    merchant_id: params.merchantId ?? params.merchant_id ?? null,
    actor_near_account: cleanActor || 'guest-session',
    action_type: actionType,
    item_id: params.itemId ?? params.item_id ?? null,
    nep245_token_id: params.nep245TokenId ?? params.nep245_token_id ?? null,
    currency: params.currency,
    amount: clampSafeBalance(params.amount),
    unit_price: clampSafeBalance(params.unitPrice ?? params.unit_price ?? 0),
    reasoning_summary: summary,
    near_tx_hash: txHash ? txHash.slice(0, 96) : null,
    created_at: createdAt,
  };

  sessionMarketTransactions.unshift(localEntry);
  if (sessionMarketTransactions.length > 50) {
    sessionMarketTransactions.length = 50;
  }
  marketTransactionListeners.forEach((cb) => {
    cb([...sessionMarketTransactions]);
  });

  if (!supabase || cleanActor.length < 2) return false;

  try {
    const { error } = await supabase.from('bb_market_transactions').insert({
      merchant_id: localEntry.merchant_id,
      actor_near_account: cleanActor,
      action_type: localEntry.action_type,
      item_id: localEntry.item_id,
      nep245_token_id: localEntry.nep245_token_id,
      currency: localEntry.currency,
      amount: localEntry.amount,
      unit_price: localEntry.unit_price,
      reasoning_summary: localEntry.reasoning_summary,
      near_tx_hash: localEntry.near_tx_hash,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches transaction history from `bb_market_transactions` in Supabase merged with current session transactions.
 */
export async function fetchMarketTransactionsFromSupabase(
  actorNearAccount?: string | null,
  limit = 40,
): Promise<DbMarketTransactionRow[]> {
  const cleanActor = actorNearAccount ? sanitizeAccountId(actorNearAccount) : '';
  const localFiltered = cleanActor
    ? sessionMarketTransactions.filter(
        (tx) => tx.actor_near_account === cleanActor || tx.actor_near_account === 'guest-session',
      )
    : [...sessionMarketTransactions];

  if (!supabase || cleanActor.length < 2) {
    return localFiltered.slice(0, limit);
  }

  try {
    const { data, error } = await supabase
      .from('bb_market_transactions')
      .select('*')
      .eq('actor_near_account', cleanActor)
      .order('created_at', { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)));

    if (error || !data) {
      return localFiltered.slice(0, limit);
    }

    const remoteRows = (data as Array<Record<string, unknown>>).map((r, idx) => ({
      id: String(r.id ?? `db-tx-${idx}`),
      merchant_id: (r.merchant_id as 'lobby_cafe' | 'beach_house' | null) ?? null,
      actor_near_account: String(r.actor_near_account ?? cleanActor),
      action_type: String(r.action_type ?? 'TRANSACTION'),
      item_id: r.item_id ? String(r.item_id) : null,
      nep245_token_id: r.nep245_token_id ? String(r.nep245_token_id) : null,
      currency: (r.currency as DbMarketTransactionRow['currency']) ?? 'LUL',
      amount: Number(r.amount ?? 0),
      unit_price: Number(r.unit_price ?? 0),
      reasoning_summary: String(r.reasoning_summary ?? ''),
      near_tx_hash: r.near_tx_hash ? String(r.near_tx_hash) : null,
      created_at: String(r.created_at ?? new Date().toISOString()),
    }));

    const seenKeys = new Set<string>();
    const merged: DbMarketTransactionRow[] = [];
    for (const row of [...remoteRows, ...localFiltered]) {
      const dedupeKey = `${row.action_type}:${row.currency}:${row.amount}:${row.near_tx_hash ?? row.reasoning_summary}`;
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        merged.push(row);
      }
    }
    return merged.slice(0, limit);
  } catch {
    return localFiltered.slice(0, limit);
  }
}

export interface FishNftSaleRecord {
  speciesName: string;
  weightKg: number | null;
  priceRespite: number;
  buyerAccount: string;
  sellerAccount: string | null;
  txHash: string | null;
  soldAtIso: string;
}

export interface FishNftMarketSalesStats {
  topSale: FishNftSaleRecord | null;
  recentSale: FishNftSaleRecord | null;
  totalSalesCount: number;
}

function parseFishNftSaleRow(row: DbMarketTransactionRow): FishNftSaleRecord | null {
  const priceRespite = Math.max(0, Number(row.unit_price || 0), Number(row.amount || 0));
  if (priceRespite <= 0) return null;

  const spec = row.item_id
    ? FISH_SPECIES_CATALOG.find((s) => s.speciesId === row.item_id)
    : undefined;
  const summary = String(row.reasoning_summary || '');
  const speciesMatch = summary.match(/bought\s+(.+?)\s+NFT/i);
  const weightMatch = summary.match(/\(([\d.]+)\s*kg\)/i);
  const sellerMatch = summary.match(/from\s+([a-z0-9_.-]+)\s+for/i);

  const speciesName =
    spec?.speciesName || (speciesMatch?.[1] ? speciesMatch[1].trim() : 'Fish NFT');
  const parsedWeight = weightMatch?.[1] ? Number(weightMatch[1]) : NaN;
  const weightKg = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null;

  return {
    speciesName,
    weightKg,
    priceRespite,
    buyerAccount: String(row.actor_near_account || 'player'),
    sellerAccount: sellerMatch?.[1] ? sellerMatch[1].trim() : null,
    txHash: row.near_tx_hash ? String(row.near_tx_hash) : null,
    soldAtIso: String(row.created_at || new Date().toISOString()),
  };
}

/**
 * Fetches live completed Fish NFT sales stats (`BUY_FISH_NFT`) from `bb_market_transactions`
 * merged with in-memory session sales so Hana and Kai can answer market record questions accurately.
 */
export async function fetchFishNftMarketSalesStats(): Promise<FishNftMarketSalesStats> {
  const localSales = sessionMarketTransactions.filter(
    (tx) => tx.action_type.toUpperCase() === 'BUY_FISH_NFT' && Math.max(tx.unit_price, tx.amount) > 0,
  );

  let remoteRows: DbMarketTransactionRow[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bb_market_transactions')
        .select('*')
        .in('action_type', ['BUY_FISH_NFT', 'buy_fish_nft'])
        .gt('amount', 0)
        .order('amount', { ascending: false })
        .limit(40);

      if (!error && Array.isArray(data)) {
        remoteRows = (data as Array<Record<string, unknown>>).map((r, idx) => ({
          id: String(r.id ?? `fish-sale-${idx}`),
          merchant_id: (r.merchant_id as 'lobby_cafe' | 'beach_house' | null) ?? 'beach_house',
          actor_near_account: String(r.actor_near_account ?? 'player'),
          action_type: String(r.action_type ?? 'BUY_FISH_NFT'),
          item_id: r.item_id ? String(r.item_id) : null,
          nep245_token_id: r.nep245_token_id ? String(r.nep245_token_id) : null,
          currency: (r.currency as DbMarketTransactionRow['currency']) ?? 'RESPITE',
          amount: Number(r.amount ?? 0),
          unit_price: Number(r.unit_price ?? 0),
          reasoning_summary: String(r.reasoning_summary ?? ''),
          near_tx_hash: r.near_tx_hash ? String(r.near_tx_hash) : null,
          created_at: String(r.created_at ?? new Date().toISOString()),
        }));
      }
    } catch {
      // fall back to local sales
    }
  }

  const seenKeys = new Set<string>();
  const parsedSales: FishNftSaleRecord[] = [];
  for (const row of [...remoteRows, ...localSales]) {
    const key = row.near_tx_hash || `${row.actor_near_account}:${row.nep245_token_id}:${row.amount}:${row.created_at}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const parsed = parseFishNftSaleRow(row);
    if (parsed) {
      parsedSales.push(parsed);
    }
  }

  if (parsedSales.length === 0) {
    return {
      topSale: null,
      recentSale: null,
      totalSalesCount: 0,
    };
  }

  const sortedByPrice = [...parsedSales].sort((a, b) => b.priceRespite - a.priceRespite);
  const sortedByDate = [...parsedSales].sort(
    (a, b) => new Date(b.soldAtIso).getTime() - new Date(a.soldAtIso).getTime(),
  );

  return {
    topSale: sortedByPrice[0] ?? null,
    recentSale: sortedByDate[0] ?? null,
    totalSalesCount: parsedSales.length,
  };
}

/**
 * Fetches recent social chat messages from `bb_social_messages`.
 */
export async function fetchRecentSocialMessages(limit = 35): Promise<DbSocialMessageRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('bb_social_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)));

    if (error || !data) return [];
    return (data as DbSocialMessageRow[]).reverse();
  } catch {
    return [];
  }
}

/**
 * Inserts a new chat message into `bb_social_messages`.
 */
export async function insertSocialMessageToSupabase(params: {
  senderName?: string;
  sender_name?: string;
  senderNearAccount?: string;
  sender_near_account?: string;
  recipientName?: string | null;
  recipient_name?: string | null;
  message: string;
  bubbleColor?: string;
  bubble_color?: string;
  room_id?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  const cleanMsg = params.message.replace(/[<>]/g, '').trim().slice(0, 280);
  if (!cleanMsg) return false;

  const sender = params.senderName || params.sender_name || 'COMMANDER';
  const senderAccount = params.senderNearAccount || params.sender_near_account;
  const recipient = params.recipientName ?? params.recipient_name;
  const color = params.bubbleColor || params.bubble_color || '#38bdf8';

  try {
    const { error } = await supabase.from('bb_social_messages').insert({
      sender_name: sanitizeDisplayName(sender),
      sender_near_account: senderAccount ? sanitizeAccountId(senderAccount) : null,
      recipient_name: recipient ? sanitizeDisplayName(recipient) : null,
      message: cleanMsg,
      bubble_color: color.slice(0, 16),
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Subscribes to live Supabase Realtime `INSERT` events on `bb_social_messages`.
 */
export function subscribeToSocialMessagesRealtime(
  onNewMessage: (row: DbSocialMessageRow) => void,
): RealtimeChannel | null {
  if (!supabase) return null;
  try {
    const channel = supabase
      .channel('bb_social_messages_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bb_social_messages' },
        (payload) => {
          if (payload.new) {
            onNewMessage(payload.new as DbSocialMessageRow);
          }
        },
      )
      .subscribe();
    return channel;
  } catch {
    return null;
  }
}

/**
 * Persists a player's 3D Private House Interior placement & mood scores to `bb_house_interiors`.
 */
export async function syncHouseInteriorToSupabase(params: {
  ownerNearAccount: string;
  activeThemeId: string;
  daylightHour: number;
  placedFurniture: unknown[];
  moodScores?: Record<string, number>;
}): Promise<boolean> {
  if (!supabase) return false;
  const cleanOwner = sanitizeAccountId(params.ownerNearAccount);
  if (cleanOwner.length < 2) return false;

  try {
    const { error } = await supabase.from('bb_house_interiors').upsert(
      {
        owner_near_account: cleanOwner,
        active_theme_id: params.activeThemeId.slice(0, 64),
        daylight_hour: Math.max(0, Math.min(24, Number(params.daylightHour) || 14)),
        placed_furniture: params.placedFurniture.slice(0, 60),
        mood_scores: params.moodScores ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_near_account' },
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches a player's saved 3D Private House Interior from `bb_house_interiors`.
 */
export async function fetchHouseInteriorFromSupabase(
  ownerNearAccount: string,
): Promise<DbHouseInteriorRow | null> {
  if (!supabase) return null;
  const cleanOwner = sanitizeAccountId(ownerNearAccount);
  if (cleanOwner.length < 2) return null;

  try {
    const { data, error } = await supabase
      .from('bb_house_interiors')
      .select('*')
      .eq('owner_near_account', cleanOwner)
      .maybeSingle();

    if (error || !data) return null;
    return data as DbHouseInteriorRow;
  } catch {
    return null;
  }
}

/**
 * Fetches the NEP-171 Gamepass Sub-Account Ledger (`bb_gamepass_nfts`) from Supabase.
 * Never fabricates fallback balances or fake keys.
 */
export async function fetchGamepassNftLedgerFromSupabase(
  tokenId = 'nep171-gamepass-estate-01',
): Promise<Nep171GamepassSubAccountLedger | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('bb_gamepass_nfts')
      .select('*')
      .eq('token_id', tokenId)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as DbGamepassNftRow;
    return {
      tokenId: row.token_id,
      ownerNearAccount: row.owner_near_account,
      subAccountId: row.sub_account_id,
      network: (row.network || 'testnet') as NearNetworkId,
      treasuryRespite: Number(row.treasury_respite ?? 0),
      totalEarnedRespite: Number(row.total_earned_respite ?? 0),
      totalPaidOutRespite: Number(row.total_paid_out_respite ?? 0),
      pendingPayoutRespite: Number(row.pending_payout_respite ?? 0),
      activeAccessKey: row.active_access_key || '',
      revokedAccessKeys: [],
      lastTransferTxHash: row.tx_hash || '',
      ownershipHistory: Array.isArray(row.ownership_history) ? row.ownership_history : [],
    };
  } catch {
    return null;
  }
}

/**
 * Fetches all base plots (`bb_base_plots`) from Supabase.
 */
export async function fetchBasePlotsFromSupabase(): Promise<DbBasePlotRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('bb_base_plots')
      .select('*')
      .order('plot_key', { ascending: true });
    if (error || !data) return [];
    return data as DbBasePlotRow[];
  } catch {
    return [];
  }
}

/**
 * Persists a Safezone / Warzone base plot claim, release, or access mode update to `bb_base_plots`.
 * Strictly enforces that `blue_0` (Model Estate Showcase) cannot be overwritten.
 */
export async function syncBasePlotToSupabase(params: {
  plotKey?: string;
  team: 'blue' | 'red';
  plotIndex: number;
  isClaimed: boolean;
  claimedByNearAccount: string | null;
  claimedByTokenId?: string | null;
  baseLevel?: number;
  skinThemeId?: string;
  gardenPresetId?: string;
  accessMode?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
  allowedFriends?: string[];
  activeHarvesters?: string[];
}): Promise<boolean> {
  if (!supabase) return false;
  const plotKey = params.plotKey || `${params.team}_${params.plotIndex}`;
  if (plotKey === 'blue_0') return false;

  try {
    const { error } = await supabase.from('bb_base_plots').upsert(
      {
        plot_key: plotKey.slice(0, 16),
        team: params.team,
        plot_index: params.plotIndex,
        is_model_estate: false,
        is_claimed: Boolean(params.isClaimed),
        claimed_by_near_account: params.claimedByNearAccount
          ? sanitizeAccountId(params.claimedByNearAccount)
          : null,
        claimed_by_token_id: params.claimedByTokenId ? params.claimedByTokenId.slice(0, 96) : null,
        base_level: Math.max(1, Math.min(3, params.baseLevel ?? 1)),
        skin_theme_id: (params.skinThemeId || 'default').slice(0, 64),
        garden_preset_id: (params.gardenPresetId || 'zen_garden').slice(0, 64),
        access_mode: params.accessMode || 'PUBLIC',
        allowed_friends: (params.allowedFriends ?? []).map((f) => sanitizeAccountId(f)).slice(0, 50),
        active_harvesters: params.activeHarvesters ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'plot_key' },
    );
    return !error;
  } catch {
    return false;
  }
}

const FISH_MARKETPLACE_ROW_ID = 'kai_fish_marketplace_ledger';

/**
 * Fetches live P2P Fish NFT Marketplace listings from normalized `bb_fish_listings`
 * (with automatic fallback to legacy `bb_gamepass_nfts` row if table migration is pending).
 */
export async function fetchFishMarketplaceListingsFromSupabase(): Promise<
  FishNftMarketplaceListing[]
> {
  if (!supabase) return [];
  try {
    const { data: rows, error: rowsErr } = await supabase
      .from('bb_fish_listings')
      .select('*')
      .order('listed_at', { ascending: false })
      .limit(60);

    if (!rowsErr && Array.isArray(rows)) {
      return rows.map((r: Record<string, unknown>) => {
        const speciesId = String(r.species_id || 'coral_sardine');
        const spec = FISH_SPECIES_CATALOG.find((s) => s.speciesId === speciesId);
        const waterZoneRaw = String(r.water_zone || '');
        const waterZone: FishingWaterZoneId =
          waterZoneRaw === 'central_oasis' || waterZoneRaw.toLowerCase().includes('oasis')
            ? 'central_oasis'
            : spec?.waterZone || 'east_beach';
        const sellerNearAccount = String(r.seller_near_account || '');
        const weightKg = Number(r.weight_kg ?? 1);
        const priceRespite = Number(r.price_respite ?? 1);
        return {
          listingId: String(r.listing_id || ''),
          nftTokenId: String(r.token_id || ''),
          speciesId,
          speciesName: String(r.species_name || spec?.speciesName || 'Coral Sardine'),
          waterZone,
          waterZoneLabel:
            waterZone === 'central_oasis' ? 'Central Oasis Lake' : 'East Beach Shoreline',
          rarity: String(r.rarity || spec?.rarity || 'Common') as FishNftMarketplaceListing['rarity'],
          weightKg,
          lengthCm: Number(r.length_cm ?? 30),
          isTrophy: spec ? weightKg >= spec.maxWeightKg * 0.7 : false,
          colorHex: spec?.colorHex || '#38bdf8',
          caughtByAccount: String(r.seller_display_name || sellerNearAccount || 'Citizen Angler'),
          sellerNearAccount,
          priceRespite,
          priceLul: priceRespite,
          nearTxHash: String(r.tx_hash || ''),
          listedAtIso: String(r.listed_at || new Date().toISOString()),
        };
      });
    }

    const { data, error } = await supabase
      .from('bb_gamepass_nfts')
      .select('ownership_history')
      .eq('token_id', FISH_MARKETPLACE_ROW_ID)
      .maybeSingle();

    if (!error && data && Array.isArray(data.ownership_history)) {
      return data.ownership_history as unknown as FishNftMarketplaceListing[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Persists P2P Fish NFT Marketplace listings to normalized `bb_fish_listings`
 * (reconciling removed/bought listings cleanly) and logs to `bb_market_transactions`.
 */
export async function syncFishMarketplaceListingsToSupabase(params: {
  listings: FishNftMarketplaceListing[];
  removedListingId?: string;
  actorNearAccount?: string;
  actionSummary?: string;
  nearTxHash?: string;
  amountLul?: number;
  transaction?: {
    merchant_id?: 'lobby_cafe' | 'beach_house' | null;
    actor_near_account?: string;
    action_type?: string;
    item_id?: string;
    nep245_token_id?: string;
    currency?: 'LUL' | 'CYON' | 'RESPITE' | 'GOLD' | 'NEAR';
    amount?: number;
    unit_price?: number;
    reasoning_summary?: string;
    near_tx_hash?: string;
  };
}): Promise<boolean> {
  if (!supabase) return false;
  const cleanActor = sanitizeAccountId(
    params.actorNearAccount || params.transaction?.actor_near_account || '',
  );
  const txHash = params.nearTxHash || params.transaction?.near_tx_hash || '';
  try {
    let persisted = false;

    if (params.removedListingId) {
      await supabase
        .from('bb_fish_listings')
        .delete()
        .eq('listing_id', params.removedListingId.slice(0, 96));
    }

    const boundedListings = params.listings.slice(0, 60);
    if (boundedListings.length > 0) {
      const upsertRows = boundedListings.map((item) => ({
        listing_id: item.listingId.slice(0, 96),
        token_id: item.nftTokenId.slice(0, 96),
        seller_near_account: sanitizeAccountId(
          item.sellerNearAccount || cleanActor || 'citizen.testnet',
        ),
        seller_display_name: sanitizeDisplayName(item.caughtByAccount || 'Citizen Angler'),
        species_id: String(item.speciesId).slice(0, 64),
        species_name: String(item.speciesName).slice(0, 64),
        water_zone: String(item.waterZoneLabel || 'East Beach Shoreline').slice(0, 64),
        rarity: item.rarity,
        weight_kg: Math.max(0.01, Math.min(500, Number(item.weightKg) || 1)),
        length_cm: Math.max(1, Math.min(1000, Number(item.lengthCm) || 30)),
        price_respite: Math.max(1, Math.min(100_000, Math.round(Number(item.priceRespite) || 1))),
        tx_hash: (item.nearTxHash || txHash).slice(0, 96),
        listed_at: item.listedAtIso || new Date().toISOString(),
      }));

      const { error: tableErr } = await supabase
        .from('bb_fish_listings')
        .upsert(upsertRows, { onConflict: 'listing_id' });
      persisted = !tableErr;
    } else {
      persisted = true;
    }

    if (!persisted) {
      const { error: fallbackErr } = await supabase.from('bb_gamepass_nfts').upsert(
        {
          token_id: FISH_MARKETPLACE_ROW_ID,
          owner_near_account: cleanActor || 'kai-merchant.buddiesblitz.testnet',
          sub_account_id: 'fishmarket.kai-merchant.buddiesblitz.testnet',
          treasury_respite: 0,
          total_earned_respite: 0,
          total_paid_out_respite: 0,
          pending_payout_respite: 0,
          active_access_key: 'ed25519:kai_fish_marketplace',
          ownership_history: boundedListings,
          network: 'testnet',
          tx_hash: (txHash || 'kai-fish-marketplace-sync').slice(0, 96),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token_id' },
      );
      persisted = !fallbackErr;
    }

    if (params.transaction) {
      await logMarketTransactionToSupabase({
        merchant_id: params.transaction.merchant_id ?? 'beach_house',
        actor_near_account: cleanActor,
        action_type: params.transaction.action_type ?? 'BUY_ITEM',
        item_id: params.transaction.item_id ?? 'nep171_fish_nft',
        nep245_token_id: params.transaction.nep245_token_id,
        currency: params.transaction.currency ?? 'RESPITE',
        amount: params.transaction.amount ?? 0,
        unit_price: params.transaction.unit_price ?? 0,
        reasoning_summary: params.transaction.reasoning_summary ?? '',
        near_tx_hash: txHash,
      });
    } else if (cleanActor.length >= 2) {
      await logMarketTransactionToSupabase({
        merchantId: 'beach_house',
        actorNearAccount: cleanActor,
        actionType: 'BUY_ITEM',
        itemId: 'nep171_fish_nft',
        currency: 'RESPITE',
        amount: params.amountLul ?? 0,
        reasoningSummary: params.actionSummary || '',
        nearTxHash: txHash,
      });
    }
    return persisted;
  } catch {
    return false;
  }
}

export interface WarzoneRealtimePeer {
  sessionId: string;
  nearAccountId: string | null;
  team: 'blue' | 'red';
  x: number;
  z: number;
  hasClaimedBase: boolean;
  inWarzone: boolean;
}

export interface WarzonePresenceController {
  updateLocalPresence: (state: Omit<WarzoneRealtimePeer, 'sessionId'>) => void;
  unsubscribe: () => void;
}

/**
 * Subscribes to live Supabase Realtime Presence for the Warzone (`bb_warzone_presence`).
 * Reports only real connected multiplayer peers currently in the Warzone.
 */
export function subscribeToWarzoneRealtimePresence(
  onPeersChange: (peers: WarzoneRealtimePeer[]) => void,
): WarzonePresenceController {
  if (!supabase) {
    onPeersChange([]);
    return {
      updateLocalPresence: () => {},
      unsubscribe: () => {},
    };
  }

  const sessionId = `peer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let isSubscribed = false;
  let latestLocalState: Omit<WarzoneRealtimePeer, 'sessionId'> | null = null;

  try {
    const channel = supabase.channel('bb_warzone_presence', {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    const syncPeers = () => {
      try {
        const state = channel.presenceState<WarzoneRealtimePeer>();
        const peers: WarzoneRealtimePeer[] = [];
        for (const [key, entries] of Object.entries(state)) {
          if (key === sessionId || !Array.isArray(entries) || entries.length === 0) continue;
          const latest = entries[entries.length - 1];
          if (latest && latest.inWarzone && (latest.team === 'blue' || latest.team === 'red')) {
            peers.push({
              sessionId: key,
              nearAccountId: latest.nearAccountId ?? null,
              team: latest.team,
              x: Number.isFinite(latest.x) ? Number(latest.x) : 0,
              z: Number.isFinite(latest.z) ? Number(latest.z) : 0,
              hasClaimedBase: Boolean(latest.hasClaimedBase),
              inWarzone: true,
            });
          }
        }
        onPeersChange(peers);
      } catch {
        onPeersChange([]);
      }
    };

    channel
      .on('presence', { event: 'sync' }, syncPeers)
      .on('presence', { event: 'join' }, syncPeers)
      .on('presence', { event: 'leave' }, syncPeers)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribed = true;
          if (latestLocalState) {
            channel
              .track({
                sessionId,
                ...latestLocalState,
              })
              .catch(() => {});
          }
        }
      });

    return {
      updateLocalPresence: (nextState) => {
        latestLocalState = nextState;
        if (isSubscribed) {
          channel
            .track({
              sessionId,
              ...nextState,
            })
            .catch(() => {});
        }
      },
      unsubscribe: () => {
        isSubscribed = false;
        channel.untrack().catch(() => {});
        supabase.removeChannel(channel).catch(() => {});
      },
    };
  } catch {
    onPeersChange([]);
    return {
      updateLocalPresence: () => {},
      unsubscribe: () => {},
    };
  }
}

export type MultiplayerZoneKey = string; // 'city' | 'warzone' | 'house:sample' | 'house:<owner>'

export interface WorldMultiplayerPeerState {
  sessionId: string;
  nearAccountId: string | null;
  displayName: string;
  gender: 'male' | 'female';
  team: 'blue' | 'red';
  zoneKey: MultiplayerZoneKey;
  inWorld: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  jumpOffset: number;
  weaponId: string;
  carryingCrate: string;
  isSitting: boolean;
  isDriving: boolean;
  isHiddenInVehicle: boolean;
  fishingPhase: 'idle' | 'charging' | 'casting' | 'nibble' | 'bite' | 'fighting';
  isReeling: boolean;
  rodBend: number;
  hasClaimedBase: boolean;
  chatBubbleText: string | null;
  updatedAtMs: number;
}

export interface WorldMultiplayerShotEvent {
  fromSessionId: string;
  fromTeam: 'blue' | 'red';
  zoneKey: MultiplayerZoneKey;
  weaponType: string;
  originX: number;
  originY: number;
  originZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  speed: number;
  damage: number;
}

export interface WorldMultiplayerController {
  readonly sessionId: string;
  publishLocalPose: (
    pose: Omit<WorldMultiplayerPeerState, 'sessionId' | 'updatedAtMs'>,
    forcePresenceTrack?: boolean,
  ) => void;
  broadcastShot: (shot: Omit<WorldMultiplayerShotEvent, 'fromSessionId'>) => void;
  unsubscribe: () => void;
}

let cachedFallbackTabSessionId: string | null = null;

export function getOrCreateTabMultiplayerSessionId(): string {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const existing = window.sessionStorage.getItem('bb_mp_tab_session_id_v1');
      if (existing && existing.startsWith('mp-')) {
        return existing;
      }
      const created = `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem('bb_mp_tab_session_id_v1', created);
      return created;
    } catch {
      // fall through to memory fallback
    }
  }
  if (!cachedFallbackTabSessionId) {
    cachedFallbackTabSessionId = `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return cachedFallbackTabSessionId;
}

/**
 * Real-time cross-device multiplayer character & combat sync over Supabase Realtime
 * (`bb_world_multiplayer_v1`), combining:
 *   - WebSocket Broadcast (`self: false, ack: false`) at ~12 Hz for low-latency 60 FPS avatar interpolation
 *   - Realtime Presence (`sync` / `join` / `leave`) for instant discovery of idle peers and immediate disconnect cleanup
 */
export function subscribeToWorldMultiplayer(handlers: {
  onPeersChange: (peers: WorldMultiplayerPeerState[]) => void;
  onRemoteShot?: (shot: WorldMultiplayerShotEvent) => void;
}): WorldMultiplayerController {
  const sessionId = getOrCreateTabMultiplayerSessionId();

  if (!supabase) {
    handlers.onPeersChange([]);
    return {
      sessionId,
      publishLocalPose: () => {},
      broadcastShot: () => {},
      unsubscribe: () => {},
    };
  }

  let isSubscribed = false;
  let lastPresenceTrackMs = 0;
  let lastTrackedZoneKey = '';
  let lastTrackedName = '';
  let lastTrackedGender = '';
  let lastTrackedInWorld = false;
  let latestLocalPose: WorldMultiplayerPeerState | null = null;
  const peersById = new Map<string, WorldMultiplayerPeerState>();

  const sanitizePeer = (raw: Partial<WorldMultiplayerPeerState>, keyFallback?: string): WorldMultiplayerPeerState | null => {
    const sid = typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : keyFallback || '';
    if (!sid || sid === sessionId) return null;
    return {
      sessionId: sid,
      nearAccountId: typeof raw.nearAccountId === 'string' && raw.nearAccountId ? raw.nearAccountId : null,
      displayName: (typeof raw.displayName === 'string' && raw.displayName.trim() ? raw.displayName.trim() : 'CITIZEN').slice(0, 28),
      gender: raw.gender === 'female' ? 'female' : 'male',
      team: raw.team === 'red' ? 'red' : 'blue',
      zoneKey: typeof raw.zoneKey === 'string' && raw.zoneKey ? raw.zoneKey : 'city',
      inWorld: Boolean(raw.inWorld),
      x: Number.isFinite(raw.x) ? Number(raw.x) : -85.5,
      z: Number.isFinite(raw.z) ? Number(raw.z) : 0,
      vx: Number.isFinite(raw.vx) ? Number(raw.vx) : 0,
      vz: Number.isFinite(raw.vz) ? Number(raw.vz) : 0,
      yaw: Number.isFinite(raw.yaw) ? Number(raw.yaw) : 0,
      jumpOffset: Number.isFinite(raw.jumpOffset) ? Number(raw.jumpOffset) : 0,
      weaponId: typeof raw.weaponId === 'string' && raw.weaponId ? raw.weaponId : 'unarmed',
      carryingCrate: typeof raw.carryingCrate === 'string' ? raw.carryingCrate : 'none',
      isSitting: Boolean(raw.isSitting),
      isDriving: Boolean(raw.isDriving),
      isHiddenInVehicle: Boolean(raw.isHiddenInVehicle),
      fishingPhase:
        raw.fishingPhase === 'charging' ||
        raw.fishingPhase === 'casting' ||
        raw.fishingPhase === 'nibble' ||
        raw.fishingPhase === 'bite' ||
        raw.fishingPhase === 'fighting'
          ? raw.fishingPhase
          : 'idle',
      isReeling: Boolean(raw.isReeling),
      rodBend: Number.isFinite(raw.rodBend) ? Number(raw.rodBend) : 0,
      hasClaimedBase: Boolean(raw.hasClaimedBase),
      chatBubbleText: typeof raw.chatBubbleText === 'string' && raw.chatBubbleText ? raw.chatBubbleText.slice(0, 64) : null,
      updatedAtMs: Date.now(),
    };
  };

  const emitActivePeers = () => {
    const now = Date.now();
    const active: WorldMultiplayerPeerState[] = [];
    for (const [sid, peer] of peersById.entries()) {
      if (now - peer.updatedAtMs > 45_000) {
        peersById.delete(sid);
        continue;
      }
      active.push(peer);
    }
    handlers.onPeersChange(active);
  };

  try {
    const channel = supabase.channel('bb_world_multiplayer_v1', {
      config: {
        presence: { key: sessionId },
        broadcast: { self: false, ack: false },
      },
    });

    const reconcilePresence = () => {
      try {
        const state = channel.presenceState<Partial<WorldMultiplayerPeerState>>();
        const presentKeys = new Set<string>();
        for (const [key, entries] of Object.entries(state)) {
          if (key === sessionId || !Array.isArray(entries) || entries.length === 0) continue;
          presentKeys.add(key);
          const latest = entries[entries.length - 1];
          const clean = sanitizePeer(latest, key);
          if (!clean) continue;
          const existing = peersById.get(clean.sessionId);
          // Only overwrite position from coarse Presence if we don't have a fresher Broadcast packet (<1.8s old)
          if (!existing || Date.now() - existing.updatedAtMs > 1800 || existing.zoneKey !== clean.zoneKey) {
            peersById.set(clean.sessionId, clean);
          } else {
            existing.displayName = clean.displayName;
            existing.gender = clean.gender;
            existing.nearAccountId = clean.nearAccountId;
            existing.inWorld = clean.inWorld;
            existing.hasClaimedBase = clean.hasClaimedBase;
            // NOTE: do NOT bump existing.updatedAtMs here. That timestamp belongs to the
            // fresher Broadcast pose; refreshing it without new position data made the
            // renderer treat a stale pose as brand new (visible backward judder ~every 3s).
            // Liveness is maintained by the peer's own pose broadcasts (<=1.1s idle,
            // 2.4s heartbeat), so pruning clocks stay correct without this bump.
          }
        }
        // Immediately prune disconnected peers no longer in Presence (unless they broadcast <2.5s ago while joining)
        const now = Date.now();
        for (const [sid, peer] of peersById.entries()) {
          if (!presentKeys.has(sid) && now - peer.updatedAtMs > 2500) {
            peersById.delete(sid);
          }
        }
        emitActivePeers();
      } catch {
        // ignore transient presence parse errors
      }
    };

    channel
      .on('presence', { event: 'sync' }, reconcilePresence)
      .on('presence', { event: 'join' }, reconcilePresence)
      .on('presence', { event: 'leave' }, (payload) => {
        const leftKey = typeof payload.key === 'string' ? payload.key : '';
        if (leftKey && peersById.has(leftKey)) {
          peersById.delete(leftKey);
          emitActivePeers();
        } else {
          reconcilePresence();
        }
      })
      .on('broadcast', { event: 'peer_pose' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object') return;
        const clean = sanitizePeer(payload as Partial<WorldMultiplayerPeerState>);
        if (!clean) return;
        peersById.set(clean.sessionId, clean);
        emitActivePeers();
      })
      .on('broadcast', { event: 'peer_shot' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object' || !handlers.onRemoteShot) return;
        const raw = payload as Partial<WorldMultiplayerShotEvent>;
        if (!raw.fromSessionId || raw.fromSessionId === sessionId) return;
        handlers.onRemoteShot({
          fromSessionId: raw.fromSessionId,
          fromTeam: raw.fromTeam === 'red' ? 'red' : 'blue',
          zoneKey: typeof raw.zoneKey === 'string' ? raw.zoneKey : 'warzone',
          weaponType: typeof raw.weaponType === 'string' ? raw.weaponType : 'BlitzPistol',
          originX: Number(raw.originX) || 0,
          originY: Number(raw.originY) || 1.2,
          originZ: Number(raw.originZ) || 0,
          dirX: Number(raw.dirX) || 0,
          dirY: Number(raw.dirY) || 0,
          dirZ: Number(raw.dirZ) || 1,
          speed: Number(raw.speed) || 38,
          damage: Number(raw.damage) || 18,
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribed = true;
          if (latestLocalPose) {
            lastPresenceTrackMs = Date.now();
            channel.track(latestLocalPose).catch(() => {});
            channel
              .send({
                type: 'broadcast',
                event: 'peer_pose',
                payload: latestLocalPose,
              })
              .catch(() => {});
          }
        }
      });

    // Background-tab heartbeat so idle or unfocused tabs remain alive & visible to other devices
    const heartbeatTimer = setInterval(() => {
      if (!isSubscribed || !latestLocalPose) return;
      const refreshed: WorldMultiplayerPeerState = {
        ...latestLocalPose,
        vx: typeof document !== 'undefined' && document.hidden ? 0 : latestLocalPose.vx,
        vz: typeof document !== 'undefined' && document.hidden ? 0 : latestLocalPose.vz,
        updatedAtMs: Date.now(),
      };
      channel
        .send({
          type: 'broadcast',
          event: 'peer_pose',
          payload: refreshed,
        })
        .catch(() => {});
      emitActivePeers();
    }, 2400);

    return {
      sessionId,
      publishLocalPose: (pose, forcePresenceTrack = false) => {
        const now = Date.now();
        const packet: WorldMultiplayerPeerState = {
          sessionId,
          ...pose,
          updatedAtMs: now,
        };
        latestLocalPose = packet;
        if (!isSubscribed) return;

        channel
          .send({
            type: 'broadcast',
            event: 'peer_pose',
            payload: packet,
          })
          .catch(() => {});

        const metaChanged =
          packet.zoneKey !== lastTrackedZoneKey ||
          packet.displayName !== lastTrackedName ||
          packet.gender !== lastTrackedGender ||
          packet.inWorld !== lastTrackedInWorld;

        if (forcePresenceTrack || metaChanged || now - lastPresenceTrackMs >= 3000) {
          lastPresenceTrackMs = now;
          lastTrackedZoneKey = packet.zoneKey;
          lastTrackedName = packet.displayName;
          lastTrackedGender = packet.gender;
          lastTrackedInWorld = packet.inWorld;
          channel.track(packet).catch(() => {});
        }
      },
      broadcastShot: (shot) => {
        if (!isSubscribed) return;
        channel
          .send({
            type: 'broadcast',
            event: 'peer_shot',
            payload: {
              fromSessionId: sessionId,
              ...shot,
            } satisfies WorldMultiplayerShotEvent,
          })
          .catch(() => {});
      },
      unsubscribe: () => {
        isSubscribed = false;
        clearInterval(heartbeatTimer);
        channel.untrack().catch(() => {});
        supabase.removeChannel(channel).catch(() => {});
      },
    };
  } catch {
    handlers.onPeersChange([]);
    return {
      sessionId,
      publishLocalPose: () => {},
      broadcastShot: () => {},
      unsubscribe: () => {},
    };
  }
}


/* ------------------------------------------------------------------ */
/* Property marketplace (Hana): player listings for house deeds and    */
/* NFT furniture. The board lives in Supabase; settlement is on-chain   */
/* (RESPITE ft_transfer, then nft_transfer / mt_transfer by seller).   */
/* ------------------------------------------------------------------ */

export interface DbPropertyListingRow {
  id: string;
  seller_account: string;
  seller_name: string | null;
  asset_kind: 'house' | 'furniture';
  asset_id: string;
  asset_label: string;
  price_respite: number;
  status: 'active' | 'paid' | 'sold' | 'cancelled';
  buyer_account: string | null;
  payment_tx: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchPropertyListingsFromSupabase(): Promise<DbPropertyListingRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('bb_property_listings')
      .select('*')
      .in('status', ['active', 'paid', 'sold'])
      .order('created_at', { ascending: false })
      .limit(80);
    if (error || !data) return [];
    return data as DbPropertyListingRow[];
  } catch {
    return [];
  }
}

export async function upsertPropertyListingToSupabase(
  row: Omit<DbPropertyListingRow, 'created_at' | 'updated_at'>,
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('bb_property_listings')
      .upsert(
        { ...row, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      );
    return !error;
  } catch {
    return false;
  }
}
