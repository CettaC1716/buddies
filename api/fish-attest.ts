import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: `/api/fish-attest`
 *
 * Signs fish-catch attestations for the market contract's
 * `mint_fish_nft_attested` (contract v1.4.0+). The client sends the catch
 * parameters, this endpoint validates their shape and plausibility, and
 * returns an ed25519 signature over the canonical message
 *   buddies-fish-mint-v1|<owner>|<token_id>|<species_id>|<water_zone>|<rarity>|<weight_kg_x100>|<issued_at_ms>
 * which the contract verifies on-chain against the attester public key
 * installed at migration time. The private key lives ONLY in the
 * `FISH_ATTESTER_PRIVATE_KEY` environment variable (NEAR format,
 * `ed25519:<base58>`) and never leaves the server.
 */

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

interface AttesterKey {
  keyObject: crypto.KeyObject;
  pubKeyBytes: Uint8Array;
  pubKeyFormatted: string;
}

function loadAttesterKey(rawSecret: string): AttesterKey {
  const clean = rawSecret.trim().replace(/^ed25519:/i, '');
  const decoded = base58Decode(clean);
  if (decoded.length !== 64 && decoded.length !== 32) {
    throw new Error('FISH_ATTESTER_PRIVATE_KEY must be a 32-byte or 64-byte base58 Ed25519 key');
  }
  const seed32 = decoded.slice(0, 32);
  // PKCS#8 Ed25519 ASN.1 prefix for a 32-byte private seed (same import
  // path as the near-relayer function).
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

// Species plausibility bounds, mirrored from FISH_SPECIES_CATALOG in
// src/game/buddiesFishingMarket.ts (maxWeightKg). The attestation bound
// allows 2x the catalog maximum so a legitimate trophy catch can never be
// rejected, while absurd weights (a 500 kg sardine) are refused. The
// contract additionally enforces its own absolute cap of 500 kg.
const SPECIES_MAX_WEIGHT_KG: Record<string, number> = {
  coral_sardine: 1.8,
  striped_mackerel: 3.4,
  azure_reef_snapper: 6.2,
  golden_harbor_tuna: 16.0,
  nebula_coelacanth: 34.0,
  oasis_silver_carp: 2.4,
  emerald_oasis_perch: 3.1,
  sakura_nishikigoi: 6.8,
  volt_fin_arapaima: 19.5,
  astral_dragon_arowana: 29.0,
};

const RARITY_TIERS = new Set(['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic', 'Legendary']);
const ACCOUNT_ID_RE = /^[a-z0-9._-]+(\.testnet|\.near)$/;
const TOKEN_ID_RE = /^nep171-fish-[a-z0-9_]+-\d{4}$/;

export async function handleFishAttestRequest(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const secret = process.env.FISH_ATTESTER_PRIVATE_KEY ?? '';
  if (!secret) {
    return {
      status: 503,
      payload: { ok: false, error: 'Fish attestation is not configured on the server.' },
    };
  }

  const playerAccount = typeof body.playerAccount === 'string' ? body.playerAccount.trim() : '';
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId.trim() : '';
  const speciesId = typeof body.speciesId === 'string' ? body.speciesId.trim() : '';
  const waterZone = typeof body.waterZone === 'string' ? body.waterZone.trim() : '';
  const rarity = typeof body.rarity === 'string' ? body.rarity.trim() : '';
  const weightKgX100 =
    typeof body.weightKgX100 === 'number' ? Math.floor(body.weightKgX100) : NaN;

  if (!ACCOUNT_ID_RE.test(playerAccount) || playerAccount.length > 64) {
    return { status: 400, payload: { ok: false, error: 'Invalid player account.' } };
  }
  if (!TOKEN_ID_RE.test(tokenId)) {
    return { status: 400, payload: { ok: false, error: 'Invalid fish token id.' } };
  }
  const speciesMaxKg = SPECIES_MAX_WEIGHT_KG[speciesId];
  if (speciesMaxKg === undefined) {
    return { status: 400, payload: { ok: false, error: 'Unknown fish species.' } };
  }
  if (!tokenId.startsWith(`nep171-fish-${speciesId}-`)) {
    return { status: 400, payload: { ok: false, error: 'Token id does not match the species.' } };
  }
  if (!RARITY_TIERS.has(rarity)) {
    return { status: 400, payload: { ok: false, error: 'Unknown rarity tier.' } };
  }
  if (!waterZone || waterZone.length > 48) {
    return { status: 400, payload: { ok: false, error: 'Invalid water zone.' } };
  }
  const maxWeightX100 = Math.ceil(speciesMaxKg * 100 * 2);
  if (!Number.isFinite(weightKgX100) || weightKgX100 < 1 || weightKgX100 > maxWeightX100) {
    return { status: 400, payload: { ok: false, error: 'Fish weight out of plausible bounds.' } };
  }

  let attester: AttesterKey;
  try {
    attester = loadAttesterKey(secret);
  } catch {
    return {
      status: 503,
      payload: { ok: false, error: 'Fish attestation key is misconfigured on the server.' },
    };
  }

  const issuedAtMs = Date.now();
  // Canonical message — must stay byte-identical with
  // BuddiesMarketContract::fish_mint_attestation_message in the contract.
  const message = [
    'buddies-fish-mint-v1',
    playerAccount,
    tokenId,
    speciesId,
    waterZone,
    rarity,
    String(weightKgX100),
    String(issuedAtMs),
  ].join('|');
  const signature = crypto.sign(null, Buffer.from(message, 'utf8'), attester.keyObject);

  return {
    status: 200,
    payload: {
      ok: true,
      signatureHex: Buffer.from(signature).toString('hex'),
      issuedAtMs,
      attesterPublicKey: attester.pubKeyFormatted,
    },
  };
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const result = await handleFishAttestRequest(body);
  res.status(result.status).json(result.payload);
}
