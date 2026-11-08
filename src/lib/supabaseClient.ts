/**
 * ============================================================================
 * BUDDIES BLITZ 3D — SUPABASE DATABASE, AUTH & REALTIME CLIENT
 * ============================================================================
 * Connects the React + Three.js WebGL client to a dedicated Supabase PostgreSQL
 * project (`VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`) with graceful
 * offline fallback when environment variables are not configured.
 * ============================================================================
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  Nep171GamepassSubAccountLedger,
  Nep171OwnershipHistoryEntry,
  NearOnboardingMode,
} from './nearClient';

const DEFAULT_SUPABASE_URL = '';
const DEFAULT_SUPABASE_ANON_KEY = '';

function resolveEnvVar(key: string, fallback: string): string {
  try {
    const viteEnv =
      typeof import.meta !== 'undefined'
        ? (import.meta as { env?: Record<string, string | undefined> }).env
        : undefined;
    if (viteEnv && viteEnv[key]) return viteEnv[key]!;
  } catch {
    // Ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key]!;
    }
  } catch {
    // Ignore
  }
  return fallback;
}

export const SUPABASE_PROJECT_URL = resolveEnvVar('VITE_SUPABASE_URL', DEFAULT_SUPABASE_URL);
export const SUPABASE_ANON_KEY = resolveEnvVar('VITE_SUPABASE_ANON_KEY', DEFAULT_SUPABASE_ANON_KEY);

let sharedSupabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_PROJECT_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  if (!sharedSupabaseClient) {
    sharedSupabaseClient = createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
      },
    });
  }
  return sharedSupabaseClient;
}

export interface DbPlayerProfileRow {
  id?: string;
  near_account_id: string;
  auth_mode: NearOnboardingMode | 'guest';
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
  investors: Array<{ accountId: string; amountCyon: number; sharePct: number }>;
  simulated_day: number;
  last_headline: string;
  updated_at?: string;
}

export interface DbMarketTransactionInsert {
  merchant_id?: string | null;
  actor_near_account: string;
  action_type:
    | 'exchange_lul_cyon'
    | 'buy_item'
    | 'sell_item'
    | 'invest_shop'
    | 'fast_forward_week'
    | 'mint_gamepass'
    | 'transfer_gamepass'
    | 'claim_base_plot';
  item_id?: string | null;
  nep245_token_id?: string | null;
  currency: 'LUL' | 'CYON' | 'RESPITE' | 'GOLD';
  amount: number;
  unit_price: number;
  reasoning_summary: string;
  near_tx_hash?: string | null;
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
  active_harvesters: string[];
  updated_at?: string;
}

/**
 * Fetches or creates a player profile row in `public.bb_profiles`.
 */
export async function fetchOrCreatePlayerProfile(params: {
  nearAccountId: string;
  displayName?: string;
  authMode?: NearOnboardingMode | 'guest';
  email?: string | null;
}): Promise<DbPlayerProfileRow | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const cleanAccount = params.nearAccountId.trim().toLowerCase().slice(0, 64);

    const { data: existing } = await supabase
      .from('bb_profiles')
      .select('*')
      .eq('near_account_id', cleanAccount)
      .maybeSingle();

    if (existing) {
      return {
        ...existing,
        lul_balance: Number(existing.lul_balance ?? 120),
        cyon_balance: Number(existing.cyon_balance ?? 95),
        respite_balance: Number(existing.respite_balance ?? 25),
        warzone_gold: Number(existing.warzone_gold ?? 600),
        owned_token_ids: Array.isArray(existing.owned_token_ids)
          ? existing.owned_token_ids
          : ['nep245:theme:japanese_zen'],
        unlocked_skins: Array.isArray(existing.unlocked_skins)
          ? existing.unlocked_skins
          : ['default'],
      };
    }

    const newRow: DbPlayerProfileRow = {
      near_account_id: cleanAccount,
      auth_mode: params.authMode || 'social_invisible',
      display_name: (params.displayName || cleanAccount.split('.')[0].toUpperCase()).slice(0, 48),
      email: null, // Never store raw PII email in public table
      lul_balance: 120,
      cyon_balance: 95,
      respite_balance: 25,
      warzone_gold: 600,
      owned_token_ids: ['nep245:theme:japanese_zen'],
      unlocked_skins: ['default'],
    };

    const { data: inserted } = await supabase
      .from('bb_profiles')
      .upsert(newRow, { onConflict: 'near_account_id' })
      .select('*')
      .maybeSingle();

    return inserted
      ? {
          ...inserted,
          lul_balance: Number(inserted.lul_balance),
          cyon_balance: Number(inserted.cyon_balance),
          respite_balance: Number(inserted.respite_balance),
          warzone_gold: Number(inserted.warzone_gold),
        }
      : newRow;
  } catch {
    return null;
  }
}

/**
 * Persists updated 3-currency + Warzone Gold balances & owned NEP-245 token IDs to `public.bb_profiles`.
 */
export async function syncPlayerBalancesToSupabase(params: {
  nearAccountId: string;
  lulBalance: number;
  cyonBalance: number;
  respiteBalance: number;
  warzoneGold?: number;
  ownedTokenIds?: string[];
  unlockedSkins?: string[];
}): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const cleanAccount = params.nearAccountId.trim().toLowerCase().slice(0, 64);
    const payload: Record<string, unknown> = {
      near_account_id: cleanAccount,
      lul_balance: Math.max(0, Math.min(1000000, params.lulBalance)),
      cyon_balance: Math.max(0, Math.min(1000000, params.cyonBalance)),
      respite_balance: Math.max(0, Math.min(100000, params.respiteBalance)),
      updated_at: new Date().toISOString(),
    };
    if (typeof params.warzoneGold === 'number') {
      payload.warzone_gold = Math.max(0, Math.min(1000000, params.warzoneGold));
    }
    if (Array.isArray(params.ownedTokenIds)) {
      payload.owned_token_ids = params.ownedTokenIds;
    }
    if (Array.isArray(params.unlockedSkins)) {
      payload.unlocked_skins = params.unlockedSkins;
    }

    const { error } = await supabase
      .from('bb_profiles')
      .upsert(payload, { onConflict: 'near_account_id' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches the NEP-171 Gamepass Sub-Account & Ownership History Ledger from `public.bb_gamepass_nfts`.
 */
export async function fetchGamepassNftLedgerFromSupabase(
  tokenIdOrOwner?: string,
): Promise<Nep171GamepassSubAccountLedger | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    let query = supabase.from('bb_gamepass_nfts').select('*').limit(1);
    if (tokenIdOrOwner) {
      const clean = tokenIdOrOwner.trim().toLowerCase();
      if (clean.startsWith('nep171-')) {
        query = supabase.from('bb_gamepass_nfts').select('*').eq('token_id', clean).limit(1);
      } else {
        query = supabase
          .from('bb_gamepass_nfts')
          .select('*')
          .eq('owner_near_account', clean)
          .limit(1);
      }
    }

    const { data } = await query.maybeSingle();
    if (!data) return null;

    const history: Nep171OwnershipHistoryEntry[] = Array.isArray(data.ownership_history)
      ? data.ownership_history
      : [];

    return {
      tokenId: data.token_id,
      contractId: 'gamepass.buddiesblitz.testnet',
      ownerNearAccount: data.owner_near_account,
      subAccountId: data.sub_account_id,
      treasuryRespite: Number(data.treasury_respite ?? 18.5),
      totalEarnedRespite: Number(data.total_earned_respite ?? 54.0),
      totalPaidOutRespite: Number(data.total_paid_out_respite ?? 35.5),
      pendingPayoutRespite: Number(data.pending_payout_respite ?? 0),
      activeAccessKey: data.active_access_key || 'ed25519:active_session_key',
      revokedAccessKeys: ['ed25519:Key_founder-alpha_v0_RevokedOnTransfer'],
      network: data.network === 'mainnet' ? 'mainnet' : 'testnet',
      latestTxHash: data.tx_hash || 'near-testnet-tx',
      ownershipHistory: history,
    };
  } catch {
    return null;
  }
}

/**
 * Persists an updated NEP-171 Gamepass Sub-Account Ledger (mint, royalty earning, or atomic transfer)
 * to `public.bb_gamepass_nfts`.
 */
export async function syncGamepassNftLedgerToSupabase(
  ledger: Nep171GamepassSubAccountLedger,
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { error } = await supabase.from('bb_gamepass_nfts').upsert(
      {
        token_id: ledger.tokenId,
        owner_near_account: ledger.ownerNearAccount,
        sub_account_id: ledger.subAccountId,
        treasury_respite: Math.max(0, ledger.treasuryRespite),
        total_earned_respite: Math.max(0, ledger.totalEarnedRespite),
        total_paid_out_respite: Math.max(0, ledger.totalPaidOutRespite),
        pending_payout_respite: Math.max(0, ledger.pendingPayoutRespite),
        active_access_key: ledger.activeAccessKey,
        ownership_history: ledger.ownershipHistory,
        network: ledger.network,
        tx_hash: ledger.latestTxHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token_id' },
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches live NPC Merchant states (`lobby_cafe` BRAM & `beach_house` KAI) from `public.bb_npc_merchants`.
 */
export async function fetchNpcMerchantsFromSupabase(): Promise<DbNpcMerchantRow[]> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('bb_npc_merchants')
      .select('*')
      .order('merchant_id', { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({
      merchant_id: row.merchant_id as 'lobby_cafe' | 'beach_house',
      npc_name: row.npc_name,
      near_wallet_address: row.near_wallet_address,
      cyon_treasury: Number(row.cyon_treasury ?? 300),
      respite_treasury: Number(row.respite_treasury ?? 45),
      is_bankrupt: Boolean(row.is_bankrupt),
      stock_by_item: (row.stock_by_item as Record<string, number>) || {},
      recent_demand_by_item: (row.recent_demand_by_item as Record<string, number>) || {},
      investors: Array.isArray(row.investors) ? row.investors : [],
      simulated_day: Number(row.simulated_day ?? 1),
      last_headline: row.last_headline || '',
      updated_at: row.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Syncs an NPC Merchant's treasury, stock, demand, bankruptcy & simulated day to `public.bb_npc_merchants`,
 * and optionally appends an immutable receipt to `public.bb_market_transactions`.
 */
export async function syncNpcMerchantAndLogTransaction(params: {
  merchant: Partial<DbNpcMerchantRow> & { merchant_id: 'lobby_cafe' | 'beach_house' };
  transaction?: DbMarketTransactionInsert;
}): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof params.merchant.cyon_treasury === 'number') {
      updatePayload.cyon_treasury = Math.max(0, params.merchant.cyon_treasury);
    }
    if (typeof params.merchant.respite_treasury === 'number') {
      updatePayload.respite_treasury = Math.max(0, params.merchant.respite_treasury);
    }
    if (typeof params.merchant.is_bankrupt === 'boolean') {
      updatePayload.is_bankrupt = params.merchant.is_bankrupt;
    }
    if (params.merchant.stock_by_item) {
      updatePayload.stock_by_item = params.merchant.stock_by_item;
    }
    if (params.merchant.recent_demand_by_item) {
      updatePayload.recent_demand_by_item = params.merchant.recent_demand_by_item;
    }
    if (params.merchant.investors) {
      updatePayload.investors = params.merchant.investors;
    }
    if (typeof params.merchant.simulated_day === 'number') {
      updatePayload.simulated_day = Math.max(1, params.merchant.simulated_day);
    }
    if (typeof params.merchant.last_headline === 'string') {
      updatePayload.last_headline = params.merchant.last_headline.slice(0, 280);
    }

    await supabase
      .from('bb_npc_merchants')
      .update(updatePayload)
      .eq('merchant_id', params.merchant.merchant_id);

    if (params.transaction) {
      await supabase.from('bb_market_transactions').insert({
        merchant_id: params.transaction.merchant_id ?? params.merchant.merchant_id,
        actor_near_account: params.transaction.actor_near_account.slice(0, 64),
        action_type: params.transaction.action_type,
        item_id: params.transaction.item_id ?? null,
        nep245_token_id: params.transaction.nep245_token_id ?? null,
        currency: params.transaction.currency,
        amount: Math.max(0, params.transaction.amount),
        unit_price: Math.max(0, params.transaction.unit_price),
        reasoning_summary: params.transaction.reasoning_summary.slice(0, 280),
        near_tx_hash: params.transaction.near_tx_hash ?? null,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Logs a standalone market / on-chain transaction receipt into `public.bb_market_transactions`.
 */
export async function insertMarketTransactionReceipt(
  tx: DbMarketTransactionInsert,
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { error } = await supabase.from('bb_market_transactions').insert({
      merchant_id: tx.merchant_id ?? null,
      actor_near_account: tx.actor_near_account.slice(0, 64),
      action_type: tx.action_type,
      item_id: tx.item_id ?? null,
      nep245_token_id: tx.nep245_token_id ?? null,
      currency: tx.currency,
      amount: Math.max(0, tx.amount),
      unit_price: Math.max(0, tx.unit_price),
      reasoning_summary: tx.reasoning_summary.slice(0, 280),
      near_tx_hash: tx.near_tx_hash ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches recent transaction receipts from `public.bb_market_transactions` for the live Economy / Wallet audit feed.
 */
export async function fetchRecentMarketTransactions(limit = 12): Promise<
  Array<{
    id: string;
    merchant_id: string | null;
    actor_near_account: string;
    action_type: string;
    item_id: string | null;
    nep245_token_id: string | null;
    currency: string;
    amount: number;
    unit_price: number;
    reasoning_summary: string;
    near_tx_hash: string | null;
    created_at: string;
  }>
> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from('bb_market_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map((r) => ({
      id: String(r.id),
      merchant_id: r.merchant_id,
      actor_near_account: String(r.actor_near_account),
      action_type: String(r.action_type),
      item_id: r.item_id,
      nep245_token_id: r.nep245_token_id,
      currency: String(r.currency),
      amount: Number(r.amount ?? 0),
      unit_price: Number(r.unit_price ?? 0),
      reasoning_summary: String(r.reasoning_summary ?? ''),
      near_tx_hash: r.near_tx_hash,
      created_at: String(r.created_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Syncs a Commander Base Plot claim or release (`blue_0`..`red_3`) to `public.bb_base_plots`.
 */
export async function syncBasePlotToSupabase(params: {
  team: 'blue' | 'red';
  plotIndex: number;
  isClaimed: boolean;
  claimedByNearAccount: string | null;
  claimedByTokenId: string | null;
  activeHarvesters?: string[];
  accessMode?: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
}): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const plotKey = `${params.team}_${params.plotIndex}`;
    if (plotKey === 'blue_0') return false; // Never mutate permanent Model Estate
    const { error } = await supabase
      .from('bb_base_plots')
      .update({
        is_claimed: params.isClaimed,
        claimed_by_near_account: params.claimedByNearAccount,
        claimed_by_token_id: params.claimedByTokenId,
        active_harvesters: params.activeHarvesters || [],
        access_mode: params.accessMode || 'PUBLIC',
        updated_at: new Date().toISOString(),
      })
      .eq('plot_key', plotKey);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Saves the player's Cutaway 3D House Interior Studio layout to `public.bb_house_interiors`.
 */
export async function syncHouseInteriorToSupabase(params: {
  ownerNearAccount: string;
  activeThemeId: string;
  daylightHour: number;
  placedFurniture: unknown[];
  moodScores?: Record<string, number>;
}): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { error } = await supabase.from('bb_house_interiors').upsert(
      {
        owner_near_account: params.ownerNearAccount.trim().toLowerCase().slice(0, 64),
        active_theme_id: params.activeThemeId,
        daylight_hour: Math.max(0, Math.min(24, params.daylightHour)),
        placed_furniture: params.placedFurniture,
        mood_scores: params.moodScores || {},
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
 * Inserts a new chat message into `public.bb_social_messages`.
 */
export async function insertSocialChatMessageToSupabase(params: {
  senderName: string;
  senderNearAccount?: string | null;
  recipientName?: string | null;
  message: string;
  bubbleColor?: string;
}): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const cleanMsg = params.message.trim().slice(0, 280);
    if (!cleanMsg) return false;
    const { error } = await supabase.from('bb_social_messages').insert({
      sender_name: params.senderName.slice(0, 48),
      sender_near_account: params.senderNearAccount ? params.senderNearAccount.slice(0, 64) : null,
      recipient_name: params.recipientName ? params.recipientName.slice(0, 48) : null,
      message: cleanMsg,
      bubble_color: params.bubbleColor || '#38bdf8',
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Subscribes to Supabase Realtime updates across `bb_npc_merchants`, `bb_gamepass_nfts`, and `bb_social_messages`.
 */
export function subscribeToBuddiesBlitzRealtime(callbacks: {
  onMerchantUpdated?: (row: DbNpcMerchantRow) => void;
  onSocialMessageInserted?: (msg: {
    id: string;
    sender_name: string;
    sender_near_account: string | null;
    recipient_name: string | null;
    message: string;
    bubble_color: string;
    created_at: string;
  }) => void;
}): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return () => {};
    const channel: RealtimeChannel = supabase
      .channel('buddies-blitz-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bb_npc_merchants' },
        (payload) => {
          if (payload.new && callbacks.onMerchantUpdated) {
            const r = payload.new as Record<string, unknown>;
            callbacks.onMerchantUpdated({
              merchant_id: r.merchant_id as 'lobby_cafe' | 'beach_house',
              npc_name: String(r.npc_name || ''),
              near_wallet_address: String(r.near_wallet_address || ''),
              cyon_treasury: Number(r.cyon_treasury ?? 300),
              respite_treasury: Number(r.respite_treasury ?? 45),
              is_bankrupt: Boolean(r.is_bankrupt),
              stock_by_item: (r.stock_by_item as Record<string, number>) || {},
              recent_demand_by_item: (r.recent_demand_by_item as Record<string, number>) || {},
              investors: Array.isArray(r.investors) ? r.investors : [],
              simulated_day: Number(r.simulated_day ?? 1),
              last_headline: String(r.last_headline || ''),
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bb_social_messages' },
        (payload) => {
          if (payload.new && callbacks.onSocialMessageInserted) {
            const r = payload.new as Record<string, unknown>;
            callbacks.onSocialMessageInserted({
              id: String(r.id || Date.now()),
              sender_name: String(r.sender_name || 'Guest'),
              sender_near_account: r.sender_near_account ? String(r.sender_near_account) : null,
              recipient_name: r.recipient_name ? String(r.recipient_name) : null,
              message: String(r.message || ''),
              bubble_color: String(r.bubble_color || '#38bdf8'),
              created_at: String(r.created_at || new Date().toISOString()),
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
