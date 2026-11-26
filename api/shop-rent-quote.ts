import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: `/api/shop-rent-quote`
 * ==================================================
 * Self-contained (zero `../src/` imports for Vercel Node runtime safety).
 *
 * 1. GET `/api/shop-rent-quote` -> returns the active super-admin editable
 *    commercial config (rent price, term days, grace days, building prices).
 * 2. POST `/api/shop-rent-quote` with `{ action: 'update_config', ... }` ->
 *    updates commercial config ONLY when `actorWallet` matches `SUPER_ADMIN_WALLET`
 *    (bound to the super admin's Supabase identity / wallet).
 * 3. POST `/api/shop-rent-quote` with `{ lotId, playerAccount }` ->
 *    issues a short-lived Ed25519-signed rent price quote binding:
 *      buddies-lot-rent-v1|<lot_id>|<account_id>|<amount_respite>|<term_days>|<expires_at_ms>
 *    mirroring the v1.4.0 `/api/fish-attest` attestation pattern.
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ACCOUNT_ID_RE = /^[a-z0-9._-]+(\.testnet|\.near)$/;
const LOT_ID_RE = /^lot-[ns]-0[1-8]$/;

const ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];

let activeCommercialConfig = {
  rentPriceRespite: 50,
  rentTermDays: 30,
  gracePeriodDays: 3,
  extensionCountedFromExpiry: true,
  quoteExpirySeconds: 300,
  buildingPricesRespite: {
    glass_corner_3story: 250,
    canopy_storefront_2story: 200,
    brick_rooftop_deck: 200,
  },
  updatedAtIso: new Date().toISOString(),
  updatedByWallet: null as string | null,
};

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

function loadQuoterKey(rawSecret: string): {
  keyObject: crypto.KeyObject;
  pubKeyFormatted: string;
} {
  const clean = rawSecret.trim().replace(/^ed25519:/i, '');
  const decoded = base58Decode(clean);
  if (decoded.length !== 64 && decoded.length !== 32) {
    throw new Error('Rent quoter private key must be a 32-byte or 64-byte base58 Ed25519 key');
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
    pubKeyFormatted: `ed25519:${base58Encode(pubKeyBytes)}`,
  };
}

export async function handleShopRentQuoteRequest(
  body: Record<string, unknown>,
  envOverride?: { secret?: string; superAdminWallet?: string },
): Promise<{ status: number; payload: Record<string, unknown> }> {
  if (body.action === 'get_config') {
    return {
      status: 200,
      payload: { ok: true, config: activeCommercialConfig },
    };
  }

  if (body.action === 'update_config') {
    const adminWallet = (
      envOverride?.superAdminWallet ??
      process.env.SUPER_ADMIN_WALLET ??
      ''
    )
      .trim()
      .toLowerCase();
    const actorWallet =
      typeof body.actorWallet === 'string' ? body.actorWallet.trim().toLowerCase() : '';
    if (!adminWallet || !actorWallet || actorWallet !== adminWallet) {
      return {
        status: 403,
        payload: { ok: false, error: 'Super-admin wallet authorization required.' },
      };
    }
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const rentPrice =
      typeof patch.rentPriceRespite === 'number' && patch.rentPriceRespite > 0
        ? Math.round(patch.rentPriceRespite)
        : activeCommercialConfig.rentPriceRespite;
    const termDays =
      typeof patch.rentTermDays === 'number' && patch.rentTermDays >= 1
        ? Math.round(patch.rentTermDays)
        : activeCommercialConfig.rentTermDays;
    const graceDays =
      typeof patch.gracePeriodDays === 'number' && patch.gracePeriodDays >= 0
        ? Math.round(patch.gracePeriodDays)
        : activeCommercialConfig.gracePeriodDays;

    activeCommercialConfig = {
      ...activeCommercialConfig,
      rentPriceRespite: rentPrice,
      rentTermDays: termDays,
      gracePeriodDays: graceDays,
      updatedAtIso: new Date().toISOString(),
      updatedByWallet: actorWallet,
    };
    return {
      status: 200,
      payload: { ok: true, config: activeCommercialConfig },
    };
  }

  const secret =
    envOverride?.secret ??
    process.env.RENT_QUOTER_PRIVATE_KEY ??
    process.env.FISH_ATTESTER_PRIVATE_KEY ??
    '';
  if (!secret) {
    return {
      status: 503,
      payload: { ok: false, error: 'Rent price quote signing is not configured on the server.' },
    };
  }

  const lotId = typeof body.lotId === 'string' ? body.lotId.trim() : '';
  const playerAccount =
    typeof body.playerAccount === 'string' ? body.playerAccount.trim() : '';
  if (!LOT_ID_RE.test(lotId)) {
    return { status: 400, payload: { ok: false, error: 'Invalid commercial lot id.' } };
  }
  if (!ACCOUNT_ID_RE.test(playerAccount) || playerAccount.length > 64) {
    return { status: 400, payload: { ok: false, error: 'Invalid player account.' } };
  }

  let quoter: { keyObject: crypto.KeyObject; pubKeyFormatted: string };
  try {
    quoter = loadQuoterKey(secret);
  } catch {
    return { status: 503, payload: { ok: false, error: 'Invalid server signing key.' } };
  }

  const amountRespite = activeCommercialConfig.rentPriceRespite;
  const termDays = activeCommercialConfig.rentTermDays;
  const expiresAtMs = Date.now() + activeCommercialConfig.quoteExpirySeconds * 1000;
  const canonicalMsg = [
    'buddies-lot-rent-v1',
    lotId,
    playerAccount,
    String(amountRespite),
    String(termDays),
    String(expiresAtMs),
  ].join('|');
  const signature = crypto.sign(null, Buffer.from(canonicalMsg, 'utf8'), quoter.keyObject);

  return {
    status: 200,
    payload: {
      ok: true,
      quote: {
        lotId,
        accountId: playerAccount,
        amountRespite,
        termDays,
        expiresAtMs,
        signatureHex: Buffer.from(signature).toString('hex'),
      },
      quoterPublicKey: quoter.pubKeyFormatted,
      config: activeCommercialConfig,
    },
  };
}

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method === 'GET') {
    const result = await handleShopRentQuoteRequest({ action: 'get_config' });
    res.status(result.status).json(result.payload);
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const result = await handleShopRentQuoteRequest(body);
  res.status(result.status).json(result.payload);
}
