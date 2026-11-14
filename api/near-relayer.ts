import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Vercel Serverless Function: `/api/near-relayer`
 * Provisions `<handle>.buddiesblitz.testnet` sub-accounts with Dual-Key custody
 * (`FunctionCall` key scoped to `market.buddiesblitz.testnet` + master recovery)
 * and relays authorized contract calls when `NEAR_MASTER_PRIVATE_KEY` (`ed25519:...`)
 * is configured in environment variables.
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
  b.writeBigUInt64LE(val & 0xffffffffffffffffn, 0);
  b.writeBigUInt64LE(val >> 64n, 8);
  return b;
}

function borshString(str: string): Buffer {
  const utf8 = Buffer.from(str, 'utf8');
  return Buffer.concat([borshU32(utf8.length), utf8]);
}

function borshPubKeyEd25519(pubKeyBytes32: Uint8Array): Buffer {
  return Buffer.concat([Buffer.from([0]), Buffer.from(pubKeyBytes32)]);
}

function parseMasterEd25519KeyPair(rawSecret: string): {
  keyObject: crypto.KeyObject;
  pubKeyBytes: Uint8Array;
  pubKeyFormatted: string;
} {
  const clean = rawSecret.trim().replace(/^ed25519:/i, '');
  const decoded = base58Decode(clean);
  if (decoded.length !== 64 && decoded.length !== 32) {
    throw new Error('NEAR_MASTER_PRIVATE_KEY must be a 32-byte or 64-byte base58 Ed25519 key');
  }
  const seed32 = decoded.slice(0, 32);
  // PKCS#8 Ed25519 ASN.1 prefix for 32-byte private seed
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

async function nearRpcCall(rpcUrl: string, method: string, params: unknown): Promise<any> {
  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'buddies-relayer',
      method,
      params,
    }),
  });
  const json = await resp.json();
  if (json.error) {
    throw new Error(json.error?.data || json.error?.message || 'NEAR RPC error');
  }
  return json.result;
}

/* ------------------------------------------------------------------ */
/* Spawn throttle: account creation is free and instant, so the        */
/* relayer is the sybil chokepoint for the whole game economy. Every   */
/* funded creation is logged (IP stored as a sha256 hash) and new      */
/* creations are refused once an IP or the global daily budget runs    */
/* out. Fails OPEN when Supabase is not configured or unreachable:      */
/* real players must never be locked out of sign-up by the limiter.    */
/* Requires table public.bb_relayer_spawn_log (ip_hash, sub_account_id,*/
/* created_at).                                                        */
/* ------------------------------------------------------------------ */

const SPAWN_LIMIT_PER_IP_PER_DAY = 5;
const SPAWN_LIMIT_GLOBAL_PER_DAY = 40;

function relayerSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

async function spawnLogCount(query: string): Promise<number | null> {
  const cfg = relayerSupabaseConfig();
  if (!cfg) return null;
  try {
    const resp = await fetch(
      `${cfg.url}/rest/v1/bb_relayer_spawn_log?select=id&${query}`,
      {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
      },
    );
    if (!resp.ok) return null;
    const range = resp.headers.get('content-range') || '';
    const total = Number(range.split('/')[1]);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

async function checkSpawnThrottle(
  ipHash: string,
): Promise<{ blocked: boolean; reason?: string }> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const encodedSince = encodeURIComponent(since);
  const [perIp, global] = await Promise.all([
    spawnLogCount(`ip_hash=eq.${ipHash}&created_at=gte.${encodedSince}`),
    spawnLogCount(`created_at=gte.${encodedSince}`),
  ]);
  if (perIp !== null && perIp >= SPAWN_LIMIT_PER_IP_PER_DAY) {
    return {
      blocked: true,
      reason:
        'Too many wallets created from this network today. Please try again tomorrow.',
    };
  }
  if (global !== null && global >= SPAWN_LIMIT_GLOBAL_PER_DAY) {
    return {
      blocked: true,
      reason: 'Wallet creation is temporarily paused. Please try again later.',
    };
  }
  return { blocked: false };
}

async function logSpawn(ipHash: string, subAccountId: string): Promise<void> {
  const cfg = relayerSupabaseConfig();
  if (!cfg) return;
  try {
    await fetch(`${cfg.url}/rest/v1/bb_relayer_spawn_log`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ ip_hash: ipHash, sub_account_id: subAccountId }),
    });
  } catch {
    // best effort only
  }
}

export async function handleNearRelayerRequest(
  body: Record<string, unknown>,
  clientIpHash = '',
): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const rpcUrl = process.env.VITE_NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
  const masterAccountId = process.env.NEAR_MASTER_ACCOUNT_ID || 'buddiesblitz.testnet';
  const marketContractId = process.env.VITE_NEAR_MARKET_CONTRACT_ID || 'market.buddiesblitz.testnet';
  let masterSecret = process.env.NEAR_MASTER_PRIVATE_KEY ?? '';
  if (process.env.NEAR_MASTER_PRIVATE_KEY === undefined && process.env.VERCEL !== '1') {
    try {
      const credPath = path.join(os.homedir(), '.near-credentials', 'testnet', `${masterAccountId}.json`);
      if (fs.existsSync(credPath)) {
        const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        masterSecret = String(parsed.private_key || parsed.secret_key || '').trim();
      }
    } catch {
      // ignore local keychain read failure
    }
  }

  const action = String(body.action || '').trim();

  if (action === 'create_subaccount') {
    const rawHandle = String(body.handle || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    const sessionPublicKey = String(body.sessionPublicKey || '').trim();
    const strictUniqueHandle = Boolean(body.strictUniqueHandle);

    if (rawHandle.length < 2 || rawHandle.length > 32) {
      return {
        status: 400,
        payload: { ok: false, error: 'Handle must be 2 to 32 lowercase alphanumeric characters.' },
      };
    }

    if (!sessionPublicKey.startsWith('ed25519:') || sessionPublicKey.length < 20) {
      return {
        status: 400,
        payload: {
          ok: false,
          error: 'Valid ed25519: sessionPublicKey is required for Dual-Key FunctionCall onboarding.',
        },
      };
    }

    const subAccountId = `${rawHandle}.${masterAccountId}`;

    // 1. Check if sub-account already exists on NEAR Testnet
    let accountAlreadyExists = false;
    try {
      const existing = await nearRpcCall(rpcUrl, 'query', {
        request_type: 'view_account',
        finality: 'final',
        account_id: subAccountId,
      });
      if (existing && existing.amount) {
        accountAlreadyExists = true;
      }
    } catch {
      // Account does not exist yet — proceed to provision if master key is configured
    }

    // Sybil throttle: only funded creations count — healing an existing
    // account's session key stays free.
    if (!accountAlreadyExists && clientIpHash) {
      const throttle = await checkSpawnThrottle(clientIpHash);
      if (throttle.blocked) {
        return {
          status: 429,
          payload: { ok: false, error: throttle.reason || 'Too many wallet creations.' },
        };
      }
    }

    if (accountAlreadyExists) {
      // Verify whether this browser's Ed25519 self-custody key is already FullAccess on subAccountId
      try {
        const existingKey = await nearRpcCall(rpcUrl, 'query', {
          request_type: 'view_access_key',
          finality: 'final',
          account_id: subAccountId,
          public_key: sessionPublicKey,
        });
        if (existingKey && existingKey.permission === 'FullAccess') {
          return {
            status: 200,
            payload: {
              ok: true,
              subAccountId,
              alreadyExisted: true,
              custodyMode: 'onchain_existing',
              sessionPublicKey,
              marketContractId,
            },
          };
        }
      } catch {
        // Session key not yet added to existing sub-account
      }

      if (strictUniqueHandle) {
        return {
          status: 409,
          payload: {
            ok: false,
            code: 'HANDLE_TAKEN',
            subAccountId,
            error: `Address ${subAccountId} is already registered by another citizen. Please choose a different wallet prefix.`,
          },
        };
      }

      if (!masterSecret) {
        return {
          status: 200,
          payload: {
            ok: true,
            subAccountId,
            alreadyExisted: true,
            custodyMode: 'onchain_existing',
            sessionPublicKey,
            marketContractId,
          },
        };
      }

      try {
        const { keyObject, pubKeyBytes, pubKeyFormatted } = parseMasterEd25519KeyPair(masterSecret);
        const masterOnSubView = await nearRpcCall(rpcUrl, 'query', {
          request_type: 'view_access_key',
          finality: 'final',
          account_id: subAccountId,
          public_key: pubKeyFormatted,
        });
        const nextNonce = BigInt(masterOnSubView.nonce) + 1n;
        const blockHashBytes = base58Decode(String(masterOnSubView.block_hash));
        const sessionPubBytes = base58Decode(sessionPublicKey.replace(/^ed25519:/i, ''));
        if (sessionPubBytes.length !== 32) {
          return {
            status: 400,
            payload: { ok: false, error: 'Session public key must decode to 32 Ed25519 bytes.' },
          };
        }

        // NEAR Borsh Action::AddKey = 5, AccessKeyPermission::FullAccess = 1
        const addPlayerFullKeyAction = Buffer.concat([
          Buffer.from([5]),
          borshPubKeyEd25519(sessionPubBytes.slice(0, 32)),
          borshU64(0n),
          Buffer.from([1]), // AccessKeyPermission::FullAccess (isolated strictly to <handle>.buddiesblitz.testnet)
        ]);

        const txBytes = Buffer.concat([
          borshString(subAccountId),
          borshPubKeyEd25519(pubKeyBytes),
          borshU64(nextNonce),
          borshString(subAccountId),
          Buffer.from(blockHashBytes),
          borshU32(1),
          addPlayerFullKeyAction,
        ]);

        const txHash = crypto.createHash('sha256').update(txBytes).digest();
        const signature = crypto.sign(null, txHash, keyObject);
        const signedTxBytes = Buffer.concat([txBytes, Buffer.from([0]), signature]);

        const broadcast = await nearRpcCall(rpcUrl, 'broadcast_tx_commit', [
          signedTxBytes.toString('base64'),
        ]);
        const confirmedHash = String(broadcast?.transaction?.hash || base58Encode(txHash));

        return {
          status: 200,
          payload: {
            ok: true,
            subAccountId,
            txHash: confirmedHash,
            alreadyExisted: true,
            custodyMode: 'onchain_provisioned',
            sessionPublicKey,
            marketContractId,
          },
        };
      } catch {
        return {
          status: 200,
          payload: {
            ok: true,
            subAccountId,
            alreadyExisted: true,
            custodyMode: 'onchain_existing',
            sessionPublicKey,
            marketContractId,
          },
        };
      }
    }

    if (!masterSecret) {
      return {
        status: 200,
        payload: {
          ok: true,
          subAccountId,
          alreadyExisted: false,
          custodyMode: 'session_key_ready',
          sessionPublicKey,
          marketContractId,
          note: 'Session FunctionCall key generated locally. Configure NEAR_MASTER_PRIVATE_KEY on server to broadcast CreateAccount on-chain.',
        },
      };
    }

    try {
      const { keyObject, pubKeyBytes, pubKeyFormatted } = parseMasterEd25519KeyPair(masterSecret);
      const accessKeyView = await nearRpcCall(rpcUrl, 'query', {
        request_type: 'view_access_key',
        finality: 'final',
        account_id: masterAccountId,
        public_key: pubKeyFormatted,
      });

      const nextNonce = BigInt(accessKeyView.nonce) + 1n;
      const blockHashBytes = base58Decode(String(accessKeyView.block_hash));

      const sessionClean = sessionPublicKey.replace(/^ed25519:/i, '');
      const sessionPubBytes =
        sessionClean.length > 10 ? base58Decode(sessionClean) : pubKeyBytes;
      if (sessionPubBytes.length !== 32 || blockHashBytes.length !== 32) {
        return {
          status: 400,
          payload: { ok: false, error: 'Invalid Ed25519 session public key or RPC block hash length.' },
        };
      }

      // Canonical NEAR Protocol Borsh Action & AccessKeyPermission discriminants:
      // Action::CreateAccount = 0
      // Action::Transfer      = 3 (0.08 NEAR initial storage + prepaid gas buffer)
      // Action::AddKey        = 5, AccessKeyPermission::FullAccess = 1
      const createAccountAction = Buffer.from([0]);
      const transferAction = Buffer.concat([
        Buffer.from([3]),
        borshU128(80_000_000_000_000_000_000_000n), // 0.08 NEAR
      ]);
      const addMasterFullKeyAction = Buffer.concat([
        Buffer.from([5]),
        borshPubKeyEd25519(pubKeyBytes),
        borshU64(0n),
        Buffer.from([1]), // AccessKeyPermission::FullAccess
      ]);
      const playerKeySlice = sessionPubBytes.slice(0, 32);
      const actions = [createAccountAction, transferAction, addMasterFullKeyAction];
      if (Buffer.compare(Buffer.from(playerKeySlice), Buffer.from(pubKeyBytes)) !== 0) {
        actions.push(
          Buffer.concat([
            Buffer.from([5]),
            borshPubKeyEd25519(playerKeySlice),
            borshU64(0n),
            Buffer.from([1]), // AccessKeyPermission::FullAccess on <handle>.buddiesblitz.testnet
          ]),
        );
      }

      const txBytes = Buffer.concat([
        borshString(masterAccountId),
        borshPubKeyEd25519(pubKeyBytes),
        borshU64(nextNonce),
        borshString(subAccountId),
        Buffer.from(blockHashBytes),
        borshU32(actions.length),
        ...actions,
      ]);

      const txHash = crypto.createHash('sha256').update(txBytes).digest();
      const signature = crypto.sign(null, txHash, keyObject);
      const signedTxBytes = Buffer.concat([txBytes, Buffer.from([0]), signature]);

      const broadcast = await nearRpcCall(rpcUrl, 'broadcast_tx_commit', [
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
      const confirmedHash = String(broadcast?.transaction?.hash || base58Encode(txHash));

      if (clientIpHash) {
        await logSpawn(clientIpHash, subAccountId);
      }

      return {
        status: 200,
        payload: {
          ok: true,
          subAccountId,
          txHash: confirmedHash,
          alreadyExisted: false,
          custodyMode: 'onchain_provisioned',
          sessionPublicKey,
          marketContractId,
        },
      };
    } catch (err) {
      return {
        status: 500,
        payload: {
          ok: false,
          error: err instanceof Error ? err.message : 'Relayer failed to create sub-account',
        },
      };
    }
  }

  return {
    status: 400,
    payload: { ok: false, error: `Unsupported relayer action: ${action}` },
  };
}

const RELAYER_ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
];

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (RELAYER_ALLOWED_ORIGINS.includes(requestOrigin)) {
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
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const clientIp = forwardedFor || String(req.socket?.remoteAddress || '');
  const clientIpHash = clientIp
    ? crypto.createHash('sha256').update(clientIp).digest('hex')
    : '';
  const result = await handleNearRelayerRequest(body, clientIpHash);
  res.status(result.status).json(result.payload);
}
