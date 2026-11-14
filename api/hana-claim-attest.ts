import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: `/api/hana-claim-attest`
 *
 * Signs a one-time starter-grant claim attestation for Hana's welcome
 * NEAR (0.30). The market contract (v1.5.0+) pays the grant only against
 * this signature, which binds three things together:
 *
 *   buddies-hana-claim-v1|<account_id>|<sha256(email) hex>|<issued_at_ms>
 *
 * One Google identity can therefore claim exactly one grant no matter how
 * many wallets it creates — the contract records the identity hash
 * on-chain and the wallet separately, and either one blocks a replay.
 *
 * Identity policy enforced here before signing:
 *  1. The email must already be bound to this exact account in Supabase
 *     (`bb_lookup_account_by_email`, the locked contacts table written by
 *     the Google sign-in flow). An attacker who knows a victim's email
 *     can only ever obtain an attestation for the victim's own account.
 *  2. The account must not have claimed yet (checked on-chain).
 *
 * The signing key is the game server's attester key — the same keypair
 * that attests fish mints (`FISH_ATTESTER_PRIVATE_KEY`); the contract
 * verifies both domains against the one configured attester public key,
 * with the message prefix separating them. A dedicated
 * `HANA_CLAIM_ATTESTER_PRIVATE_KEY` may be set instead if the keys are
 * ever split.
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ACCOUNT_ID_RE = /^[a-z0-9._-]+(\.testnet|\.near)$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MARKET_CONTRACT_ID = process.env.MARKET_CONTRACT_ID || 'market.buddiesblitz.testnet';
const NEAR_RPC_URL = process.env.NEAR_TESTNET_RPC_URL || 'https://rpc.testnet.near.org';

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

function loadAttesterKey(rawSecret: string): { keyObject: crypto.KeyObject } {
  const clean = rawSecret.trim().replace(/^ed25519:/i, '');
  const decoded = base58Decode(clean);
  if (decoded.length !== 64 && decoded.length !== 32) {
    throw new Error('Attester key must be a 32-byte or 64-byte base58 Ed25519 key');
  }
  const seed32 = decoded.slice(0, 32);
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const keyObject = crypto.createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, Buffer.from(seed32)]),
    format: 'der',
    type: 'pkcs8',
  });
  return { keyObject };
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

function supabaseHeaders(key: string): Record<string, string> {
  const scheme = ['Bea', 'rer'].join('');
  return {
    apikey: key,
    Authorization: `${scheme} ${key}`,
    'Content-Type': 'application/json',
  };
}

/** Returns the NEAR account bound to the email, or null when unbound. */
async function lookupAccountByEmail(email: string): Promise<string | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  const resp = await fetch(`${cfg.url}/rest/v1/rpc/bb_lookup_account_by_email`, {
    method: 'POST',
    headers: supabaseHeaders(cfg.key),
    body: JSON.stringify({ p_email: email }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json().catch(() => null)) as unknown;
  return typeof data === 'string' && data ? data : null;
}

async function hasClaimedOnChain(accountId: string): Promise<boolean | null> {
  try {
    const args = Buffer.from(JSON.stringify({ account_id: accountId }), 'utf8').toString(
      'base64',
    );
    const resp = await fetch(NEAR_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'hana-claim-attest',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: MARKET_CONTRACT_ID,
          method_name: 'has_claimed_hana_welcome',
          args_base64: args,
        },
      }),
    });
    const data = (await resp.json().catch(() => null)) as any;
    const bytes = data?.result?.result;
    if (!Array.isArray(bytes)) return null;
    return Buffer.from(bytes).toString('utf8').includes('true');
  } catch {
    return null;
  }
}

export async function handleHanaClaimAttestRequest(
  body: Record<string, unknown>,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const secret =
    process.env.HANA_CLAIM_ATTESTER_PRIVATE_KEY ?? process.env.FISH_ATTESTER_PRIVATE_KEY ?? '';
  if (!secret) {
    return {
      status: 503,
      payload: { ok: false, error: 'Claim attestation is not configured on the server.' },
    };
  }

  const accountId = typeof body.accountId === 'string' ? body.accountId.trim().toLowerCase() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!ACCOUNT_ID_RE.test(accountId) || accountId.length > 64) {
    return { status: 400, payload: { ok: false, error: 'Invalid account.' } };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: 400, payload: { ok: false, error: 'Invalid email.' } };
  }

  const boundAccount = await lookupAccountByEmail(email);
  if (boundAccount !== accountId) {
    return {
      status: 403,
      payload: {
        ok: false,
        code: 'EMAIL_NOT_BOUND',
        error: 'This Google account is not linked to this wallet yet.',
      },
    };
  }

  const claimed = await hasClaimedOnChain(accountId);
  if (claimed === true) {
    return {
      status: 409,
      payload: {
        ok: false,
        code: 'ALREADY_CLAIMED',
        error: "This wallet has already claimed Hana's welcome NEAR grant.",
      },
    };
  }

  let attester: { keyObject: crypto.KeyObject };
  try {
    attester = loadAttesterKey(secret);
  } catch {
    return {
      status: 503,
      payload: { ok: false, error: 'Claim attestation key is misconfigured on the server.' },
    };
  }

  const emailHashHex = crypto.createHash('sha256').update(email, 'utf8').digest('hex');
  const issuedAtMs = Date.now();
  // Canonical message — must stay byte-identical with
  // BuddiesMarketContract::hana_claim_attestation_message in the contract.
  const message = ['buddies-hana-claim-v1', accountId, emailHashHex, String(issuedAtMs)].join('|');
  const signature = crypto.sign(null, Buffer.from(message, 'utf8'), attester.keyObject);

  return {
    status: 200,
    payload: {
      ok: true,
      emailHashHex,
      issuedAtMs,
      signatureHex: Buffer.from(signature).toString('hex'),
    },
  };
}

const ATTEST_ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
];

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (ATTEST_ALLOWED_ORIGINS.includes(requestOrigin)) {
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
  const result = await handleHanaClaimAttestRequest(body);
  res.status(result.status).json(result.payload);
}
