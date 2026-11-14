import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: `/api/npc-trade`
 *
 * Fase 2 of the NPC trade plan: Kai buys Fish NFTs for RESPITE from his
 * own on-chain treasury account (`kai.buddiesblitz.testnet`). The server
 * is the only executor and re-derives every number itself:
 *
 * - `create_session`: verifies on-chain that the player owns the fish,
 *   computes the value envelope from the species formula (mirroring the
 *   client's chain reconstruction), checks treasury + inventory
 *   discipline, and stores a 10-minute session in `bb_trade_sessions`.
 * - `execute`: re-verifies the session, the on-chain listing (seller,
 *   token, price at or below the recomputed ceiling) and every treasury
 *   cap, then signs `buy_fish_nft` as Kai and broadcasts it. The
 *   contract settles both legs atomically (RESPITE Kai -> player, NFT
 *   player -> Kai).
 *
 * Kai's private key lives ONLY in the `KAI_TRADE_PRIVATE_KEY` env var
 * (NEAR format, `ed25519:<base58>`). The allowlist is a single method:
 * `buy_fish_nft` on the market contract. All economics are recomputed
 * at execution time from chain state, so a stored session row can
 * never authorize more than the live rules allow.
 */

const CONTRACT_ID = 'market.buddiesblitz.testnet';
const KAI_ACCOUNT_ID = 'kai.buddiesblitz.testnet';
const RPC_URL = 'https://rpc.testnet.near.org';

/** Treasury caps (plan Bagian 12 decision 2, locked 14 Nov 2026). */
const CAPS = {
  perTx: 250,
  daily: 1000,
  reserveFloor: 500,
  playerDailyShare: 0.4,
  breakerDropPct: 0.1,
  profitLockPct: 0.5,
  sessionTtlMs: 10 * 60 * 1000,
  maxSessionsPerHour: 20,
  stockPerSpeciesRarity: 3,
  stockValueCapPct: 0.4,
} as const;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(input: string): Uint8Array {
  let num = 0n;
  for (const ch of input) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base58 character');
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.push(Number(num & 0xffn));
    num >>= 8n;
  }
  bytes.reverse();
  let leadingZeros = 0;
  for (const ch of input) {
    if (ch === '1') leadingZeros += 1;
    else break;
  }
  return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes]);
}

function base58Encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) {
    num = (num << 8n) + BigInt(b);
  }
  let out = '';
  while (num > 0n) {
    const rem = Number(num % 58n);
    out = BASE58_ALPHABET[rem] + out;
    num /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out || '1';
}

function borshU32(val: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(val >>> 0, 0);
  return b;
}

function borshU64(val: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(val, 0);
  return b;
}

function borshU128(val: bigint): Buffer {
  const b = Buffer.alloc(16);
  let v = val;
  for (let i = 0; i < 16; i += 1) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
}

function borshString(str: string): Buffer {
  const bytes = Buffer.from(str, 'utf8');
  return Buffer.concat([borshU32(bytes.length), bytes]);
}

function borshBytes(bytes: Buffer): Buffer {
  return Buffer.concat([borshU32(bytes.length), bytes]);
}

function borshPubKeyEd25519(pubKeyBytes: Uint8Array): Buffer {
  return Buffer.concat([Buffer.from([0]), Buffer.from(pubKeyBytes)]);
}

interface SignerKey {
  keyObject: crypto.KeyObject;
  pubKeyBytes: Uint8Array;
  pubKeyFormatted: string;
}

function loadSignerKey(rawSecret: string, envName: string): SignerKey {
  const clean = rawSecret.trim().replace(/^ed25519:/i, '');
  const decoded = base58Decode(clean);
  if (decoded.length !== 64 && decoded.length !== 32) {
    throw new Error(`${envName} must be a 32-byte or 64-byte base58 Ed25519 key`);
  }
  const seed32 = decoded.slice(0, 32);
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const keyObject = crypto.createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(seed32)]),
    format: 'der',
    type: 'pkcs8',
  });
  const spki = crypto.createPublicKey(keyObject).export({ format: 'der', type: 'spki' });
  const pubKeyBytes = new Uint8Array(spki.subarray(spki.length - 32));
  return {
    keyObject,
    pubKeyBytes,
    pubKeyFormatted: `ed25519:${base58Encode(pubKeyBytes)}`,
  };
}

async function nearRpcCall(method: string, params: unknown): Promise<any> {
  const resp = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'npc-trade', method, params }),
  });
  const data: any = await resp.json();
  if (data.error) throw new Error(`NEAR RPC ${method} failed: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function viewFunction<T>(methodName: string, args: Record<string, unknown>): Promise<T> {
  const result = await nearRpcCall('query', {
    request_type: 'call_function',
    finality: 'final',
    account_id: CONTRACT_ID,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args), 'utf8').toString('base64'),
  });
  const text = Buffer.from(result.result as number[]).toString('utf8');
  return JSON.parse(text) as T;
}

/* ------------------------------------------------------------------ */
/* Supabase REST (sessions + treasury ledger)                          */
/* ------------------------------------------------------------------ */

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

async function sbFetch(path: string, init?: RequestInit): Promise<any> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error('Supabase is not configured on the server.');
  const resp = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers || {}),
    },
  });
  if (!resp.ok) {
    throw new Error(`Supabase request failed (${resp.status}): ${await resp.text()}`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

interface TradeSessionRow {
  id: string;
  player_account: string;
  token_id: string;
  species_id: string;
  rarity: string;
  weight_kg_x100: number;
  base_value_respite: number;
  ceiling_respite: number;
  status: string;
  expires_at: string;
  agreed_price_respite?: number | null;
  settled_at?: string | null;
}

interface RespiteLedger {
  dayKey: string;
  poolStartOfDay: number | null;
  breakerTripped: boolean;
  lockedReserve: number;
}

function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function loadLedger(): Promise<RespiteLedger> {
  const rows = await sbFetch(
    `bb_npc_treasury?merchant_location=eq.kai_respite&select=ledger&limit=1`,
  );
  const today = utcDayKey();
  const raw = Array.isArray(rows) && rows.length > 0 ? rows[0].ledger : null;
  if (!raw || typeof raw !== 'object') {
    return { dayKey: today, poolStartOfDay: null, breakerTripped: false, lockedReserve: 0 };
  }
  if (raw.dayKey !== today) {
    return {
      dayKey: today,
      poolStartOfDay: null,
      breakerTripped: false,
      lockedReserve: Number(raw.lockedReserve) || 0,
    };
  }
  return {
    dayKey: today,
    poolStartOfDay:
      raw.poolStartOfDay == null ? null : Number(raw.poolStartOfDay),
    breakerTripped: raw.breakerTripped === true,
    lockedReserve: Number(raw.lockedReserve) || 0,
  };
}

async function saveLedger(ledger: RespiteLedger): Promise<void> {
  const existing = await sbFetch(
    `bb_npc_treasury?merchant_location=eq.kai_respite&select=merchant_location&limit=1`,
  );
  const body = {
    merchant_location: 'kai_respite',
    ledger,
    updated_at: new Date().toISOString(),
  };
  if (Array.isArray(existing) && existing.length > 0) {
    await sbFetch(`bb_npc_treasury?merchant_location=eq.kai_respite`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } else {
    await sbFetch(`bb_npc_treasury`, { method: 'POST', body: JSON.stringify(body) });
  }
}

/* ------------------------------------------------------------------ */
/* Fish valuation — mirrors the client's chain reconstruction exactly  */
/* (App.tsx: suggestedRespite = max(4, round(spec.suggestedRespitePrice */
/* x (isTrophy ? 1.25 : 1))), isTrophy = weight >= 0.7 x maxWeightKg).  */
/* E (expected resale) = 1.25 x V, Kai's own Fase-3 listing anchor      */
/* (list at max(buy x 1.25, suggested)); the hard ceiling is            */
/* min(1.15 x V, 0.80 x E) = V, so the 0.80 x E margin invariant of    */
/* plan Bagian 13.1 holds at every reachable price.                    */
/* ------------------------------------------------------------------ */

const SPECIES: Record<string, { suggestedRespitePrice: number; maxWeightKg: number }> = {
  coral_sardine: { suggestedRespitePrice: 5, maxWeightKg: 1.8 },
  striped_mackerel: { suggestedRespitePrice: 8, maxWeightKg: 3.4 },
  azure_reef_snapper: { suggestedRespitePrice: 15, maxWeightKg: 6.2 },
  golden_harbor_tuna: { suggestedRespitePrice: 28, maxWeightKg: 16.0 },
  nebula_coelacanth: { suggestedRespitePrice: 60, maxWeightKg: 34.0 },
  oasis_silver_carp: { suggestedRespitePrice: 6, maxWeightKg: 2.4 },
  emerald_oasis_perch: { suggestedRespitePrice: 8, maxWeightKg: 3.1 },
  sakura_nishikigoi: { suggestedRespitePrice: 16, maxWeightKg: 6.8 },
  volt_fin_arapaima: { suggestedRespitePrice: 32, maxWeightKg: 19.5 },
  astral_dragon_arowana: { suggestedRespitePrice: 65, maxWeightKg: 29.0 },
};

interface FishChainData {
  owner: string;
  speciesId: string;
  rarity: string;
  weightKgX100: number;
}

async function fetchFishChainData(tokenId: string): Promise<FishChainData | null> {
  try {
    const token = await viewFunction<any>('nft_token', { token_id: tokenId });
    if (!token || typeof token.owner_id !== 'string') return null;
    const extraRaw = token.metadata?.extra;
    const extra = typeof extraRaw === 'string' ? JSON.parse(extraRaw) : extraRaw || {};
    const speciesId = String(extra.species_id || '');
    const rarity = String(extra.rarity || '');
    const weightKgX100 = Number(extra.weight_kg_x100) || 0;
    if (!speciesId || !rarity || weightKgX100 <= 0) return null;
    return { owner: token.owner_id, speciesId, rarity, weightKgX100 };
  } catch {
    return null;
  }
}

function valueFish(fish: FishChainData): { v: number; e: number; ceiling: number; opening: number } | null {
  const spec = SPECIES[fish.speciesId];
  if (!spec) return null;
  const weightKg = fish.weightKgX100 / 100;
  const isTrophy = weightKg >= spec.maxWeightKg * 0.7;
  const v = Math.max(4, Math.round(spec.suggestedRespitePrice * (isTrophy ? 1.25 : 1)));
  const e = Math.round(v * 1.25);
  const ceiling = Math.min(Math.round(v * 1.15), Math.floor(e * 0.8));
  const opening = Math.max(1, Math.floor(v * 0.8));
  return { v, e, ceiling, opening };
}

async function kaiRespiteBalance(): Promise<number> {
  const bal = await viewFunction<string>('ft_balance_of', { account_id: KAI_ACCOUNT_ID });
  return Number(bal) || 0;
}

async function settledSessionsSince(isoSince: string): Promise<TradeSessionRow[]> {
  const rows = await sbFetch(
    `bb_trade_sessions?status=eq.settled&settled_at=gte.${encodeURIComponent(isoSince)}&select=*&order=settled_at.desc&limit=500`,
  );
  return Array.isArray(rows) ? rows : [];
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const ACCOUNT_ID_RE = /^[a-z0-9._-]+(\.testnet|\.near)$/;

async function createSession(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const playerAccount = typeof body.playerAccount === 'string' ? body.playerAccount.trim() : '';
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId.trim() : '';
  if (!ACCOUNT_ID_RE.test(playerAccount) || playerAccount.length > 64) {
    return { status: 400, payload: { ok: false, reason: 'bad_request', error: 'Invalid player account.' } };
  }
  if (!tokenId || tokenId.length > 96) {
    return { status: 400, payload: { ok: false, reason: 'bad_request', error: 'Invalid token id.' } };
  }

  if (!process.env.KAI_TRADE_PRIVATE_KEY) {
    return { status: 503, payload: { ok: false, reason: 'not_configured', error: 'Kai’s NFT trading desk is not open yet.' } };
  }

  const fish = await fetchFishChainData(tokenId);
  if (!fish) {
    return { status: 404, payload: { ok: false, reason: 'unknown_fish', error: 'Fish NFT not found on-chain.' } };
  }
  if (fish.owner !== playerAccount) {
    return { status: 403, payload: { ok: false, reason: 'not_owner', error: 'The player does not own this fish NFT.' } };
  }
  const valuation = valueFish(fish);
  if (!valuation) {
    return { status: 422, payload: { ok: false, reason: 'no_market', error: 'Kai has no market for this species yet.' } };
  }

  // Rate limit: sessions created in the last hour.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await sbFetch(
    `bb_trade_sessions?player_account=eq.${encodeURIComponent(playerAccount)}&created_at=gte.${encodeURIComponent(hourAgo)}&select=id`,
  );
  if (Array.isArray(recent) && recent.length >= CAPS.maxSessionsPerHour) {
    return { status: 429, payload: { ok: false, reason: 'rate_limited', error: 'Too many trade sessions this hour.' } };
  }

  // Reuse a still-open session for this player + token.
  const openRows = await sbFetch(
    `bb_trade_sessions?player_account=eq.${encodeURIComponent(playerAccount)}&token_id=eq.${encodeURIComponent(tokenId)}&status=eq.open&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=created_at.desc&limit=1`,
  );
  if (Array.isArray(openRows) && openRows.length > 0) {
    const s = openRows[0] as TradeSessionRow;
    return {
      status: 200,
      payload: {
        ok: true,
        sessionId: s.id,
        baseValueRespite: s.base_value_respite,
        ceilingRespite: s.ceiling_respite,
        openingOffer: Math.max(1, Math.floor(s.base_value_respite * 0.8)),
        patience: 3,
        memoryFinalPrice: null,
        reused: true,
      },
    };
  }

  // Treasury + inventory discipline.
  const balance = await kaiRespiteBalance();
  const ledger = await loadLedger();
  if (ledger.breakerTripped) {
    return { status: 200, payload: { ok: false, reason: 'breaker', error: 'Kai\u2019s NFT treasury is paused for today.' } };
  }
  if (balance - CAPS.reserveFloor < valuation.opening) {
    return { status: 200, payload: { ok: false, reason: 'treasury_low', error: 'Kai\u2019s NFT treasury is too low for this fish today.' } };
  }
  const dayStart = new Date(`${utcDayKey()}T00:00:00.000Z`).toISOString();
  const settledToday = await settledSessionsSince(dayStart);
  const stock = await settledSessionsSince(new Date(0).toISOString());
  const sameKindStock = stock.filter(
    (s) => s.species_id === fish.speciesId && s.rarity === fish.rarity,
  ).length;
  if (sameKindStock >= CAPS.stockPerSpeciesRarity) {
    return { status: 200, payload: { ok: false, reason: 'stock_full', error: 'Kai already holds enough of this kind.' } };
  }
  const stockValue = stock.reduce((sum, s) => sum + (Number(s.agreed_price_respite) || 0), 0);
  if (stockValue + valuation.opening > CAPS.stockValueCapPct * (balance + stockValue)) {
    return { status: 200, payload: { ok: false, reason: 'stock_cap', error: 'Kai\u2019s inventory share is at its limit.' } };
  }

  // Memory (24h) + patience from treasury stress.
  const memoryRows = await sbFetch(
    `bb_trade_sessions?status=eq.settled&player_account=eq.${encodeURIComponent(playerAccount)}&species_id=eq.${encodeURIComponent(fish.speciesId)}&settled_at=gte.${encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}&select=*&order=settled_at.desc&limit=1`,
  );
  const memoryFinalPrice =
    Array.isArray(memoryRows) && memoryRows.length > 0
      ? Number(memoryRows[0].agreed_price_respite) || null
      : null;
  const spentToday = settledToday.reduce((sum, s) => sum + (Number(s.agreed_price_respite) || 0), 0);
  const remainingBudget = CAPS.daily - spentToday;
  let patience = memoryFinalPrice != null ? 2 : 3;
  if (remainingBudget <= CAPS.daily * 0.25) patience = 1;

  const expiresAt = new Date(Date.now() + CAPS.sessionTtlMs).toISOString();
  const inserted = await sbFetch(`bb_trade_sessions`, {
    method: 'POST',
    body: JSON.stringify({
      npc: 'kai',
      player_account: playerAccount,
      token_id: tokenId,
      species_id: fish.speciesId,
      rarity: fish.rarity,
      weight_kg_x100: fish.weightKgX100,
      base_value_respite: valuation.v,
      ceiling_respite: valuation.ceiling,
      status: 'open',
      expires_at: expiresAt,
    }),
  });
  const row = Array.isArray(inserted) ? inserted[0] : inserted;
  return {
    status: 200,
    payload: {
      ok: true,
      sessionId: row.id,
      baseValueRespite: valuation.v,
      ceilingRespite: valuation.ceiling,
      openingOffer: valuation.opening,
      patience,
      memoryFinalPrice,
    },
  };
}

async function broadcastKaiBuy(listingId: string, signer: SignerKey): Promise<string> {
  const accessKeyView = await nearRpcCall('query', {
    request_type: 'view_access_key',
    finality: 'final',
    account_id: KAI_ACCOUNT_ID,
    public_key: signer.pubKeyFormatted,
  });
  const nextNonce = BigInt(accessKeyView.nonce) + 1n;
  const blockHashBytes = base58Decode(String(accessKeyView.block_hash));
  if (blockHashBytes.length !== 32) throw new Error('Invalid block hash from RPC.');

  const argsJson = Buffer.from(JSON.stringify({ listing_id: listingId }), 'utf8');
  const functionCallAction = Buffer.concat([
    Buffer.from([2]), // Action::FunctionCall
    borshString('buy_fish_nft'),
    borshBytes(argsJson),
    borshU64(30_000_000_000_000n), // 30 Tgas
    borshU128(0n),
  ]);
  const txBytes = Buffer.concat([
    borshString(KAI_ACCOUNT_ID),
    borshPubKeyEd25519(signer.pubKeyBytes),
    borshU64(nextNonce),
    borshString(CONTRACT_ID),
    Buffer.from(blockHashBytes),
    borshU32(1),
    functionCallAction,
  ]);
  const txHash = crypto.createHash('sha256').update(txBytes).digest();
  const signature = crypto.sign(null, txHash, signer.keyObject);
  const signedTxBytes = Buffer.concat([txBytes, Buffer.from([0]), signature]);
  const broadcast = await nearRpcCall('broadcast_tx_commit', [
    signedTxBytes.toString('base64'),
  ]);
  if (broadcast?.status && typeof broadcast.status === 'object' && 'Failure' in broadcast.status) {
    throw new Error(`NEAR execution failed: ${JSON.stringify(broadcast.status.Failure)}`);
  }
  if (Array.isArray(broadcast?.receipts_outcome)) {
    for (const r of broadcast.receipts_outcome) {
      if (r?.outcome?.status && typeof r.outcome.status === 'object' && 'Failure' in r.outcome.status) {
        throw new Error(`NEAR receipt failed: ${JSON.stringify(r.outcome.status.Failure)}`);
      }
    }
  }
  return String(broadcast?.transaction?.hash || base58Encode(txHash));
}

async function executeSession(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  const playerAccount = typeof body.playerAccount === 'string' ? body.playerAccount.trim() : '';
  if (!sessionId || !listingId || !ACCOUNT_ID_RE.test(playerAccount)) {
    return { status: 400, payload: { ok: false, reason: 'bad_request', error: 'Missing session, listing, or player.' } };
  }

  const rows = await sbFetch(`bb_trade_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`);
  const session = (Array.isArray(rows) ? rows[0] : null) as TradeSessionRow | null;
  if (!session) {
    return { status: 404, payload: { ok: false, reason: 'no_session', error: 'Trade session not found.' } };
  }
  if (session.player_account !== playerAccount) {
    return { status: 403, payload: { ok: false, reason: 'wrong_player', error: 'Session belongs to another player.' } };
  }
  if (session.status !== 'open') {
    return { status: 409, payload: { ok: false, reason: 'session_closed', error: 'Trade session is no longer open.' } };
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await sbFetch(`bb_trade_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'expired' }),
    });
    return { status: 410, payload: { ok: false, reason: 'expired', error: 'Trade session expired.' } };
  }

  // Recompute the economics from live chain data — never trust the row.
  const fish = await fetchFishChainData(session.token_id);
  if (!fish || fish.owner !== playerAccount) {
    return { status: 409, payload: { ok: false, reason: 'not_owner', error: 'The player no longer owns this fish.' } };
  }
  const valuation = valueFish(fish);
  if (!valuation) {
    return { status: 422, payload: { ok: false, reason: 'no_market', error: 'Kai has no market for this species.' } };
  }

  const listings = await viewFunction<any[]>('get_fish_listings', {});
  const listing = Array.isArray(listings)
    ? listings.find((l) => String(l.listing_id) === listingId)
    : null;
  if (!listing) {
    return { status: 404, payload: { ok: false, reason: 'no_listing', error: 'Listing not found on-chain.' } };
  }
  if (String(listing.token_id) !== session.token_id || String(listing.seller_id) !== playerAccount) {
    return { status: 409, payload: { ok: false, reason: 'listing_mismatch', error: 'Listing does not match the session.' } };
  }
  const price = Number(listing.price_respite);
  if (!Number.isFinite(price) || price < 1) {
    return { status: 400, payload: { ok: false, reason: 'bad_price', error: 'Invalid listing price.' } };
  }
  if (price > valuation.ceiling) {
    return { status: 422, payload: { ok: false, reason: 'above_ceiling', error: 'Price exceeds Kai\u2019s ceiling for this fish.' } };
  }
  if (price > CAPS.perTx) {
    return { status: 422, payload: { ok: false, reason: 'above_tx_cap', error: 'Price exceeds the per-trade treasury cap.' } };
  }

  // Treasury caps from the settled-session audit trail (UTC day).
  const dayStart = new Date(`${utcDayKey()}T00:00:00.000Z`).toISOString();
  const settledToday = await settledSessionsSince(dayStart);
  const spentToday = settledToday.reduce((sum, s) => sum + (Number(s.agreed_price_respite) || 0), 0);
  const playerSpentToday = settledToday
    .filter((s) => s.player_account === playerAccount)
    .reduce((sum, s) => sum + (Number(s.agreed_price_respite) || 0), 0);
  if (spentToday + price > CAPS.daily) {
    return { status: 200, payload: { ok: false, reason: 'budget', error: 'Kai\u2019s daily NFT budget is spent.' } };
  }
  if (playerSpentToday + price > CAPS.daily * CAPS.playerDailyShare) {
    return { status: 200, payload: { ok: false, reason: 'player_cap', error: 'This player reached Kai\u2019s daily share limit.' } };
  }

  const balance = await kaiRespiteBalance();
  const ledger = await loadLedger();
  if (ledger.poolStartOfDay == null) {
    ledger.poolStartOfDay = balance;
  }
  if (ledger.breakerTripped || balance < ledger.poolStartOfDay * (1 - CAPS.breakerDropPct)) {
    ledger.breakerTripped = true;
    await saveLedger(ledger);
    return { status: 200, payload: { ok: false, reason: 'breaker', error: 'Kai\u2019s NFT treasury breaker is tripped for today.' } };
  }
  if (balance < price || balance - price < CAPS.reserveFloor) {
    return { status: 200, payload: { ok: false, reason: 'pool', error: 'Kai\u2019s NFT treasury cannot cover this without breaking its reserve.' } };
  }

  const secret = process.env.KAI_TRADE_PRIVATE_KEY ?? '';
  if (!secret) {
    return { status: 503, payload: { ok: false, reason: 'not_configured', error: 'Kai trade signer is not configured on the server.' } };
  }
  let signer: SignerKey;
  try {
    signer = loadSignerKey(secret, 'KAI_TRADE_PRIVATE_KEY');
  } catch {
    return { status: 503, payload: { ok: false, reason: 'not_configured', error: 'Kai trade signer key is misconfigured.' } };
  }

  let txHash: string;
  try {
    txHash = await broadcastKaiBuy(listingId, signer);
  } catch (err) {
    await sbFetch(`bb_trade_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed' }),
    });
    return {
      status: 502,
      payload: {
        ok: false,
        reason: 'chain_failed',
        error: `Kai\u2019s purchase transaction failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  ledger.lockedReserve += Math.floor(Math.max(0, valuation.v - price) * CAPS.profitLockPct);
  await saveLedger(ledger);
  await sbFetch(`bb_trade_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'settled',
      listing_id: listingId,
      agreed_price_respite: price,
      tx_hash: txHash,
      settled_at: new Date().toISOString(),
    }),
  });

  return {
    status: 200,
    payload: { ok: true, txHash, priceRespite: price, tokenId: session.token_id },
  };
}

export async function handleNpcTradeRequest(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const action = typeof body.action === 'string' ? body.action : '';
  try {
    if (action === 'create_session') return await createSession(body);
    if (action === 'execute') return await executeSession(body);
    return { status: 400, payload: { ok: false, reason: 'bad_action', error: `Unsupported npc-trade action: ${action}` } };
  } catch (err) {
    return {
      status: 500,
      payload: {
        ok: false,
        reason: 'server_error',
        error: err instanceof Error ? err.message : 'Unknown server error',
      },
    };
  }
}

const TRADE_ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (TRADE_ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const result = await handleNpcTradeRequest(body);
  res.status(result.status).json(result.payload);
}
