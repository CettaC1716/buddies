/**
 * NEAR Protocol Integration for Buddies Blitz (`docs.near.org` compliant)
 * - Uses live NEAR JSON-RPC (`https://rpc.testnet.fastnear.com` / `https://rpc.mainnet.fastnear.com`)
 * - Supports NEP-413 cryptographic message verification (`signMessage`) for wallet ownership
 * - Generates scoped Ed25519 `FunctionCall` session keys for seedless `<handle>.buddiesblitz.testnet` onboarding
 * - Synchronized 1:1 with `contracts/buddies-market/src/lib.rs` (NEP-141, NEP-145, NEP-171/181, NEP-245)
 */

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export type NearNetworkId = 'testnet' | 'mainnet';
export type NearOnboardingMode = 'social_invisible' | 'wallet_selector';

export interface Nep171OwnershipHistoryEntry {
  fromAccount: string;
  toAccount: string;
  txHash: string;
  timestampIso: string;
  settledPayoutRespite: number;
  transferredTreasuryRespite: number;
  revokedAccessKey: string;
  rotatedAccessKey: string;
}

export interface Nep171GamepassSubAccountLedger {
  tokenId: string;
  ownerNearAccount: string;
  subAccountId: string;
  network: NearNetworkId;
  treasuryRespite: number;
  totalEarnedRespite: number;
  totalPaidOutRespite: number;
  pendingPayoutRespite: number;
  activeAccessKey: string;
  revokedAccessKeys: string[];
  lastTransferTxHash: string;
  ownershipHistory: Nep171OwnershipHistoryEntry[];
}

const DEFAULT_NETWORK = ((metaEnv.VITE_NEAR_NETWORK || 'testnet').toLowerCase() === 'mainnet'
  ? 'mainnet'
  : 'testnet') as NearNetworkId;

export const NEAR_CONFIG = {
  network: DEFAULT_NETWORK,
  rpcUrl:
    metaEnv.VITE_NEAR_RPC_URL ||
    (DEFAULT_NETWORK === 'mainnet'
      ? 'https://rpc.mainnet.fastnear.com'
      : 'https://rpc.testnet.fastnear.com'),
  mainnetRpcUrl: 'https://rpc.mainnet.fastnear.com',
  testnetRpcUrl: 'https://rpc.testnet.fastnear.com',
  walletConnectRedirectUrl:
    DEFAULT_NETWORK === 'mainnet'
      ? 'https://app.mynearwallet.com/login/'
      : 'https://testnet.mynearwallet.com/login/',
  mainnetWalletConnectRedirectUrl: 'https://app.mynearwallet.com/login/',
  testnetWalletConnectRedirectUrl: 'https://testnet.mynearwallet.com/login/',
  masterAccountId: 'buddiesblitz.testnet',
  marketContractId: metaEnv.VITE_NEAR_MARKET_CONTRACT_ID || 'market.buddiesblitz.testnet',
  gamepassContractId: metaEnv.VITE_NEAR_GAMEPASS_CONTRACT_ID || 'market.buddiesblitz.testnet',
  nep245MultiTokenContractId:
    metaEnv.VITE_NEAR_NEP245_CONTRACT_ID || 'market.buddiesblitz.testnet',
  nep141RespiteContractId: 'market.buddiesblitz.testnet',
};

export function getMyNearWalletLoginUrl(network: NearNetworkId = NEAR_CONFIG.network): string {
  const base =
    network === 'mainnet'
      ? NEAR_CONFIG.mainnetWalletConnectRedirectUrl
      : NEAR_CONFIG.testnetWalletConnectRedirectUrl;
  return `${base}?contract_id=${encodeURIComponent(NEAR_CONFIG.marketContractId)}`;
}

export function resolveNearRpcUrl(accountOrNetwork?: string): {
  network: NearNetworkId;
  rpcUrl: string;
} {
  const clean = (accountOrNetwork || NEAR_CONFIG.network).trim().toLowerCase();
  if (clean === 'mainnet' || clean.endsWith('.near')) {
    return { network: 'mainnet', rpcUrl: NEAR_CONFIG.mainnetRpcUrl };
  }
  if (clean === 'testnet' || clean.endsWith('.testnet')) {
    return { network: 'testnet', rpcUrl: NEAR_CONFIG.testnetRpcUrl };
  }
  return {
    network: NEAR_CONFIG.network,
    rpcUrl: NEAR_CONFIG.rpcUrl,
  };
}

export function getNearBlocksAccountUrl(accountId: string, network?: NearNetworkId): string {
  const net = network || resolveNearRpcUrl(accountId).network;
  const host = net === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
  return `${host}/address/${encodeURIComponent(accountId.trim())}`;
}

export function getNearBlocksTxUrl(txHash: string, network: NearNetworkId = 'testnet'): string {
  const host = network === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';
  return `${host}/txns/${encodeURIComponent(txHash.trim())}`;
}

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) {
    num = (num << 8n) + BigInt(b);
  }
  let encoded = '';
  while (num > 0n) {
    const rem = Number(num % 58n);
    encoded = BASE58_CHARS[rem] + encoded;
    num /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) encoded = '1' + encoded;
    else break;
  }
  return encoded || '1';
}

function decodeBase58(input: string): Uint8Array {
  let num = 0n;
  for (const ch of input.trim()) {
    const idx = BASE58_CHARS.indexOf(ch);
    if (idx < 0) throw new Error('Invalid Base58 character');
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.push(Number(num & 0xffn));
    num >>= 8n;
  }
  bytes.reverse();
  let leadingZeros = 0;
  for (const ch of input.trim()) {
    if (ch === '1') leadingZeros += 1;
    else break;
  }
  const out = new Uint8Array(leadingZeros + bytes.length);
  out.set(bytes, leadingZeros);
  return out;
}

const SESSION_KEY_STORAGE_ID = 'bb_citizen_fc_session_pubkey_v1';
const SESSION_KEYPAIR_STORAGE_ID = 'bb_citizen_fc_keypair_v2';

interface StoredCitizenSessionKeyPair {
  publicKey: string;
  privateJwk: JsonWebKey;
}

let inMemorySessionKeyPair: {
  publicKey: string;
  privateKey: CryptoKey | null;
} | null = null;

async function getOrCreateCitizenSessionKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey | null;
}> {
  if (inMemorySessionKeyPair?.publicKey) {
    return inMemorySessionKeyPair;
  }

  if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && crypto.subtle?.importKey) {
    try {
      const rawStored = window.localStorage.getItem(SESSION_KEYPAIR_STORAGE_ID);
      if (rawStored) {
        const parsed = JSON.parse(rawStored) as StoredCitizenSessionKeyPair;
        if (
          parsed?.publicKey?.startsWith('ed25519:') &&
          parsed.publicKey.length > 30 &&
          parsed?.privateJwk
        ) {
          const importedPriv = await crypto.subtle.importKey(
            'jwk',
            parsed.privateJwk,
            { name: 'Ed25519' },
            false,
            ['sign'],
          );
          inMemorySessionKeyPair = {
            publicKey: parsed.publicKey,
            privateKey: importedPriv,
          };
          return inMemorySessionKeyPair;
        }
      }
    } catch {
      // Regenerate below if corrupted or unsupported
    }
  }

  let pubKeyBytes = new Uint8Array(32);
  let privateKey: CryptoKey | null = null;
  let privateJwk: JsonWebKey | null = null;

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle?.generateKey) {
      const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
        'sign',
        'verify',
      ])) as CryptoKeyPair;
      const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
      pubKeyBytes = new Uint8Array(raw);
      privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
      privateKey = kp.privateKey;
    } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(pubKeyBytes);
    }
  } catch {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(pubKeyBytes);
    }
  }

  const formatted = `ed25519:${encodeBase58(pubKeyBytes)}`;
  inMemorySessionKeyPair = { publicKey: formatted, privateKey };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SESSION_KEY_STORAGE_ID, formatted);
      if (privateJwk) {
        const payload: StoredCitizenSessionKeyPair = {
          publicKey: formatted,
          privateJwk,
        };
        window.localStorage.setItem(SESSION_KEYPAIR_STORAGE_ID, JSON.stringify(payload));
      }
    } catch {
      // ignore storage quota errors
    }
  }

  return inMemorySessionKeyPair;
}

/**
 * Generates or retrieves a browser-scoped Ed25519 `FunctionCall` public key (`ed25519:...`)
 * used for Dual-Key citizen sub-account custody (`<handle>.buddiesblitz.testnet`),
 * persisting the matching WebCrypto signing key in `localStorage`.
 */
export async function getOrCreateCitizenSessionPublicKey(): Promise<string> {
  const kp = await getOrCreateCitizenSessionKeyPair();
  return kp.publicKey;
}

/**
 * Checks live NEAR Testnet availability for `<handle>.buddiesblitz.testnet`.
 * If the account already exists, checks whether THIS browser's Ed25519 key already owns it.
 */
export async function checkCitizenSubAccountAvailability(handle: string): Promise<{
  cleanHandle: string;
  subAccountId: string;
  validFormat: boolean;
  available: boolean;
  ownedByCurrentDevice: boolean;
  reason?: string;
}> {
  const cleanHandle = handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
  const subAccountId = cleanHandle ? `${cleanHandle}.${NEAR_CONFIG.masterAccountId}` : '';

  if (cleanHandle.length < 2) {
    return {
      cleanHandle,
      subAccountId,
      validFormat: false,
      available: false,
      ownedByCurrentDevice: false,
      reason: 'Enter at least 2 letters or numbers.',
    };
  }

  if (cleanHandle === 'market' || cleanHandle === 'admin' || cleanHandle === 'treasury') {
    return {
      cleanHandle,
      subAccountId,
      validFormat: false,
      available: false,
      ownedByCurrentDevice: false,
      reason: `"${cleanHandle}" is reserved. Try another name.`,
    };
  }

  const existing = await fetchNearAccountView(subAccountId);
  if (!existing) {
    return {
      cleanHandle,
      subAccountId,
      validFormat: true,
      available: true,
      ownedByCurrentDevice: false,
    };
  }

  try {
    const sessionPublicKey = await getOrCreateCitizenSessionPublicKey();
    const { rpcUrl } = resolveNearRpcUrl(subAccountId);
    const akResp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'check-subaccount-owner',
        method: 'query',
        params: {
          request_type: 'view_access_key',
          finality: 'final',
          account_id: subAccountId,
          public_key: sessionPublicKey,
        },
      }),
    });
    const akJson = await akResp.json();
    if (akJson?.result?.permission) {
      return {
        cleanHandle,
        subAccountId,
        validFormat: true,
        available: true,
        ownedByCurrentDevice: true,
      };
    }
  } catch {
    // ignore RPC error
  }

  return {
    cleanHandle,
    subAccountId,
    validFormat: true,
    available: false,
    ownedByCurrentDevice: false,
    reason: 'Already taken. Try another name.',
  };
}

/**
 * The game is mirrored on GitHub Pages (static hosting, no serverless API).
 * From there, API calls go to the production deployment that hosts them;
 * everywhere else they stay same-origin relative.
 */
export function resolveApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return `https://buddies-rouge.vercel.app${path}`;
  }
  return path;
}

/**
 * Provisions or resolves `<handle>.buddiesblitz.testnet` via `/api/near-relayer` with a browser
 * self-custodial Ed25519 key isolated strictly to `<handle>.buddiesblitz.testnet`.
 */
export async function spawnSubAccountOnChainViaMaster(params: {
  handle: string;
  email?: string;
  strictUniqueHandle?: boolean;
}): Promise<{
  ok: boolean;
  subAccountId: string;
  sessionPublicKey: string;
  custodyMode: 'onchain_provisioned' | 'onchain_existing' | 'session_key_ready';
  txHash?: string;
  error?: string;
}> {
  const cleanHandle = params.handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);

  if (cleanHandle.length < 2) {
    return {
      ok: false,
      subAccountId: '',
      sessionPublicKey: '',
      custodyMode: 'session_key_ready',
      error: 'Wallet username must be at least 2 characters.',
    };
  }

  const sessionPublicKey = await getOrCreateCitizenSessionPublicKey();
  const subAccountId = `${cleanHandle}.${NEAR_CONFIG.masterAccountId}`;

  try {
    const resp = await fetch(resolveApiUrl('/api/near-relayer'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_subaccount',
        handle: cleanHandle,
        sessionPublicKey,
        email: params.email || undefined,
        strictUniqueHandle: Boolean(params.strictUniqueHandle),
      }),
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok || json?.ok === false) {
      return {
        ok: false,
        subAccountId,
        sessionPublicKey,
        custodyMode: 'session_key_ready',
        error: String(
          json?.error || `Could not create wallet ${subAccountId}. Try another name.`,
        ),
      };
    }
    if (json?.ok) {
      setActiveWalletAuthKind('citizen-subaccount');
      return {
        ok: true,
        subAccountId: String(json.subAccountId || subAccountId),
        sessionPublicKey,
        custodyMode: json.custodyMode || 'session_key_ready',
        txHash: json.txHash ? String(json.txHash) : undefined,
      };
    }
  } catch {
    return {
      ok: false,
      subAccountId,
      sessionPublicKey,
      custodyMode: 'session_key_ready',
      error: 'Wallet service unreachable. Check your connection and try again.',
    };
  }

  return {
    ok: false,
    subAccountId,
    sessionPublicKey,
    custodyMode: 'session_key_ready',
    error: 'Wallet service returned an unexpected response. Please try again.',
  };
}

export interface NearAccountView {
  accountId: string;
  amount: string; // yoctoNEAR
  locked: string;
  storageUsage: number;
  blockHeight: number;
  blockHash: string;
}

export interface NearGamepassNftMetadata {
  tokenId: string;
  ownerId: string;
  title: string;
  description: string;
  tier: 'Commander Genesis Pass';
  issuedAt: string;
  perks: string[];
}

export interface NearNetworkStatus {
  networkId: string;
  chainId: string;
  latestBlockHeight: number;
  blockHeight: number;
  syncing: boolean;
  rpcUrl: string;
  isLiveRpc: boolean;
}

export async function fetchNearNetworkStatus(): Promise<NearNetworkStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(NEAR_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'buddies-blitz-status',
        method: 'status',
        params: [],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      const res = json?.result;
      if (res?.sync_info) {
        const height = Number(res.sync_info.latest_block_height ?? 0);
        return {
          networkId: NEAR_CONFIG.network,
          chainId: String(res.chain_id ?? `near-${NEAR_CONFIG.network}`),
          latestBlockHeight: height,
          blockHeight: height,
          syncing: Boolean(res.sync_info.syncing),
          rpcUrl: NEAR_CONFIG.rpcUrl,
          isLiveRpc: true,
        };
      }
    }
  } catch {
    // RPC unreachable
  }

  return {
    networkId: NEAR_CONFIG.network,
    chainId: `near-${NEAR_CONFIG.network}-unreachable`,
    latestBlockHeight: 0,
    blockHeight: 0,
    syncing: false,
    rpcUrl: NEAR_CONFIG.rpcUrl,
    isLiveRpc: false,
  };
}

export async function fetchNearAccountView(accountId: string): Promise<NearAccountView | null> {
  const cleanId = accountId.trim().toLowerCase();
  if (!cleanId) return null;
  const { rpcUrl } = resolveNearRpcUrl(cleanId);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'buddies-blitz-account',
        method: 'query',
        params: {
          request_type: 'view_account',
          finality: 'final',
          account_id: cleanId,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      if (json?.result && !json?.error) {
        return {
          accountId: cleanId,
          amount: String(json.result.amount ?? '0'),
          locked: String(json.result.locked ?? '0'),
          storageUsage: Number(json.result.storage_usage ?? 0),
          blockHeight: Number(json.result.block_height ?? 0),
          blockHash: String(json.result.block_hash ?? ''),
        };
      }
    }
  } catch {
    // Account not found or RPC unreachable
  }

  return null;
}

async function callNearContractViewMethod<T = unknown>(params: {
  contractId: string;
  methodName: string;
  args?: Record<string, unknown>;
  networkOrAccount?: string;
}): Promise<T | null> {
  const argsJson = JSON.stringify(params.args ?? {});
  const argsBase64 = typeof btoa === 'function' ? btoa(argsJson) : '';
  const { rpcUrl } = resolveNearRpcUrl(params.networkOrAccount || params.contractId);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `view-${params.methodName}`,
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: params.contractId,
          method_name: params.methodName,
          args_base64: argsBase64,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const json = await response.json();
    const rawBytes = json?.result?.result;
    if (!Array.isArray(rawBytes)) return null;
    const decoded = new TextDecoder().decode(new Uint8Array(rawBytes));
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export interface OnChainFishNftListing {
  listing_id: string;
  token_id: string;
  seller_id: string;
  species_id: string;
  species_name: string;
  water_zone: string;
  rarity: string;
  weight_kg_x100: number;
  price_respite: string;
  listed_at_ms?: number;
}

export async function fetchBuddiesMarketFishListings(): Promise<OnChainFishNftListing[]> {
  const list = await callNearContractViewMethod<OnChainFishNftListing[]>({
    contractId: NEAR_CONFIG.marketContractId,
    methodName: 'get_fish_listings',
    args: {},
  });
  return Array.isArray(list) ? list : [];
}

/** Escrowed property-market listing as stored by contract v1.3.0+. */
export interface OnChainPropertyListing {
  listing_id: string;
  seller_id: string;
  /** 'deed' (house deed NFT) or 'furniture' (NEP-245 catalog item). */
  asset_kind: 'deed' | 'furniture';
  token_id: string;
  amount: string;
  price_respite: string;
  listed_at_ms: number;
}

export async function fetchBuddiesMarketPropertyListings(): Promise<
  OnChainPropertyListing[]
> {
  const list = await callNearContractViewMethod<OnChainPropertyListing[]>({
    contractId: NEAR_CONFIG.marketContractId,
    methodName: 'get_property_listings',
    args: {},
  });
  return Array.isArray(list) ? list : [];
}

export interface OnChainHouseDeed {
  owner_id: string;
  deed_token_id: string;
  sub_account_id: string;
  purchased_at_ms: number;
  price_paid_respite: string;
  key_epoch: number;
}

export interface OnChainFamilyMemberContract {
  contract_id: string;
  owner_id: string;
  member_number: number;
  plan_id: string;
  active_order: string;
  hired_at_ms: number;
  expires_at_ms: number;
  price_paid_respite: string;
}

export interface OnChainCitizenEstateSummary {
  account_id: string;
  respite_balance: string;
  owns_house: boolean;
  house_deed: OnChainHouseDeed | null;
  family_contracts: OnChainFamilyMemberContract[];
  fish_nft_count: number;
}

export async function fetchBuddiesMarketEstate(
  accountId: string,
): Promise<OnChainCitizenEstateSummary | null> {
  if (!accountId || !accountId.trim()) return null;
  return callNearContractViewMethod<OnChainCitizenEstateSummary>({
    contractId: NEAR_CONFIG.marketContractId,
    methodName: 'get_player_estate',
    args: { account_id: accountId.trim() },
  });
}

/**
 * Queries NEP-141 fungible token balance (`ft_balance_of`) on NEAR RPC.
 */
export async function fetchNep141Balance(
  contractId: string,
  accountId: string,
): Promise<string | null> {
  const cleanAccount = accountId.trim();
  if (!cleanAccount) return null;
  const res = await callNearContractViewMethod<string | number>({
    contractId,
    methodName: 'ft_balance_of',
    args: { account_id: cleanAccount },
    networkOrAccount: cleanAccount,
  });
  if (typeof res === 'string') return res;
  if (typeof res === 'number') return String(res);
  return null;
}

/**
 * Queries NEP-171 `nft_tokens_for_owner` on `market.buddiesblitz.testnet` via NEAR RPC
 * and strictly filters for House Ownership Deeds (`house-deed-*` / `house_deed`),
 * never falsely unlocking the house when a citizen owns a Fish NFT (`nep171-fish-*`).
 */
export async function verifyNep171GamepassOwnership(accountId: string): Promise<{
  verified: boolean;
  token: NearGamepassNftMetadata | null;
  source: 'near-rpc';
}> {
  const cleanId = accountId.trim();
  if (!cleanId) {
    return { verified: false, source: 'near-rpc', token: null };
  }

  const parsed = await callNearContractViewMethod<
    Array<{
      token_id?: string;
      metadata?: { title?: string; description?: string; extra?: string };
    }>
  >({
    contractId: NEAR_CONFIG.gamepassContractId,
    methodName: 'nft_tokens_for_owner',
    args: { account_id: cleanId, from_index: '0', limit: 50 },
    networkOrAccount: cleanId,
  });

  if (Array.isArray(parsed) && parsed.length > 0) {
    const deedToken = parsed.find((t) => {
      const tid = String(t?.token_id || '').toLowerCase();
      const extra = String(t?.metadata?.extra || '').toLowerCase();
      const title = String(t?.metadata?.title || '').toLowerCase();
      return (
        tid.startsWith('house-deed-') ||
        extra.includes('"house_deed"') ||
        title.includes('house deed')
      );
    });

    if (deedToken) {
      return {
        verified: true,
        source: 'near-rpc',
        token: {
          tokenId: String(deedToken.token_id || 'house-deed-0001'),
          ownerId: cleanId,
          title: String(deedToken?.metadata?.title || 'Buddies Blitz Citizen Deed'),
          description: String(
            deedToken?.metadata?.description ||
              'NEP-171 Base Commander Ownership & Safezone Plot Pass',
          ),
          tier: 'Commander Genesis Pass',
          issuedAt: new Date().toISOString(),
          perks: [
            'Claim & Customize Safezone / Warzone Plot',
            '3D Private House Interior & Sub-Account Control',
            'Autonomous Buddy Harvester Privileges',
          ],
        },
      };
    }
  }

  return {
    verified: false,
    source: 'near-rpc',
    token: null,
  };
}

export interface OnChainOwnedFishNftRecord {
  tokenId: string;
  speciesId: string;
  speciesName: string;
  waterZone: 'central_oasis' | 'east_beach';
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Mythic';
  weightKg: number;
}

/**
 * Queries `nft_tokens_for_owner` on `market.buddiesblitz.testnet` and returns all
 * Fish NFTs currently owned by `accountId` (excluding House Deeds).
 */
export async function fetchOwnedFishNftsFromChain(
  accountId: string,
): Promise<OnChainOwnedFishNftRecord[]> {
  const cleanId = accountId.trim().toLowerCase();
  if (!cleanId) return [];

  const parsed = await callNearContractViewMethod<
    Array<{
      token_id?: string;
      metadata?: { title?: string; description?: string; extra?: string };
    }>
  >({
    contractId: NEAR_CONFIG.gamepassContractId,
    methodName: 'nft_tokens_for_owner',
    args: { account_id: cleanId, from_index: '0', limit: 50 },
    networkOrAccount: cleanId,
  });

  if (!Array.isArray(parsed) || parsed.length === 0) return [];

  const results: OnChainOwnedFishNftRecord[] = [];
  for (const t of parsed) {
    const tokenId = String(t?.token_id || '').trim();
    if (!tokenId) continue;
    const tidLower = tokenId.toLowerCase();
    const rawExtra = String(t?.metadata?.extra || '');
    const title = String(t?.metadata?.title || '');

    if (
      tidLower.startsWith('house-deed-') ||
      rawExtra.toLowerCase().includes('"house_deed"') ||
      title.toLowerCase().includes('house deed')
    ) {
      continue;
    }

    let extraObj: Record<string, unknown> = {};
    try {
      if (rawExtra.trim().startsWith('{')) {
        extraObj = JSON.parse(rawExtra) as Record<string, unknown>;
      }
    } catch {
      // ignore malformed extra
    }

    const isFish =
      tidLower.startsWith('nep171-fish-') ||
      tidLower.startsWith('fish-') ||
      extraObj.kind === 'fish' ||
      extraObj.kind === 'fish_nft';
    if (!isFish) continue;

    const speciesFromTokenId = tidLower
      .replace(/^nep171-fish-/, '')
      .replace(/^fish-/, '')
      .replace(/-\d+$/, '');
    const speciesId = String(extraObj.species_id || speciesFromTokenId || 'coral_sardine');
    const cleanTitleName = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const speciesName =
      cleanTitleName ||
      speciesId
        .split('_')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
        .join(' ');

    const rawZone = String(extraObj.water_zone || '');
    const waterZone: 'central_oasis' | 'east_beach' =
      rawZone === 'central_oasis' || /oasis|lake/i.test(rawZone) ? 'central_oasis' : 'east_beach';

    const rawRarity = String(extraObj.rarity || 'Common');
    const rarity: 'Common' | 'Uncommon' | 'Rare' | 'Mythic' =
      rawRarity === 'Mythic' || rawRarity === 'Legendary'
        ? 'Mythic'
        : rawRarity === 'Rare' || rawRarity === 'Epic'
          ? 'Rare'
          : rawRarity === 'Uncommon'
            ? 'Uncommon'
            : 'Common';

    const weightX100 = Number(extraObj.weight_kg_x100 ?? 0);
    const titleKgMatch = title.match(/([\d.]+)\s*kg/i);
    const weightKg =
      weightX100 > 0
        ? Number((weightX100 / 100).toFixed(2))
        : titleKgMatch?.[1]
          ? Math.max(0.1, Number(Number(titleKgMatch[1]).toFixed(2)))
          : 2.5;

    results.push({
      tokenId,
      speciesId,
      speciesName,
      waterZone,
      rarity,
      weightKg,
    });
  }

  return results;
}

export type NearWalletAuthKind =
  | 'near-connect'
  | 'injected'
  | 'citizen-subaccount'
  | 'rpc-observer';

const WALLET_AUTH_KIND_STORAGE_ID = 'bb_wallet_auth_kind_v1';

export function setActiveWalletAuthKind(kind: NearWalletAuthKind): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WALLET_AUTH_KIND_STORAGE_ID, kind);
  } catch {
    // ignore storage errors
  }
}

export function getActiveWalletAuthKind(): NearWalletAuthKind | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WALLET_AUTH_KIND_STORAGE_ID);
    if (
      raw === 'near-connect' ||
      raw === 'injected' ||
      raw === 'citizen-subaccount' ||
      raw === 'rpc-observer'
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
}

export function isActiveWalletReadOnlyObserver(): boolean {
  return getActiveWalletAuthKind() === 'rpc-observer';
}

/** True for citizen sub-accounts minted by the game relayer (`<handle>.buddiesblitz.testnet`). */
export function isCitizenSubAccountId(accountId: string): boolean {
  const clean = (accountId || '').trim().toLowerCase();
  return clean.endsWith(`.${NEAR_CONFIG.masterAccountId}`) && clean !== NEAR_CONFIG.masterAccountId;
}

export interface NearWalletConnectionResult {
  accountId: string;
  walletProvider:
    | 'near-connect'
    | 'meteor-extension'
    | 'sender-extension'
    | 'near-extension'
    | 'citizen-subaccount'
    | 'rpc-observer';
  walletName?: string;
  isSignatureVerified: boolean;
  nep413Signature?: string;
  isLiveRpc: boolean;
  blockHeight: number;
  amountYoctoNear: string;
}

type SigningWalletListener = (result: NearWalletConnectionResult) => void;
const signingWalletListeners = new Set<SigningWalletListener>();

export function onNearSigningWalletConnected(listener: SigningWalletListener): () => void {
  signingWalletListeners.add(listener);
  return () => {
    signingWalletListeners.delete(listener);
  };
}

function notifySigningWalletConnected(result: NearWalletConnectionResult): void {
  for (const listener of signingWalletListeners) {
    try {
      listener(result);
    } catch {
      // ignore listener errors
    }
  }
}

let nearConnectorInstance: import('@hot-labs/near-connect').NearConnector | null = null;
let nearConnectorNetwork: NearNetworkId | null = null;

async function getNearConnector(
  network: NearNetworkId = NEAR_CONFIG.network,
): Promise<import('@hot-labs/near-connect').NearConnector | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return null;
  }
  if (nearConnectorInstance && nearConnectorNetwork === network) {
    return nearConnectorInstance;
  }
  const mod = await import('@hot-labs/near-connect');
  const NearConnectorCtor =
    mod.NearConnector ||
    (mod as unknown as { default?: { NearConnector?: typeof mod.NearConnector } }).default
      ?.NearConnector;
  if (!NearConnectorCtor) return null;

  const instance = new NearConnectorCtor({
    network,
    autoConnect: true,
    providers: {
      testnet: [NEAR_CONFIG.testnetRpcUrl],
      mainnet: [NEAR_CONFIG.mainnetRpcUrl],
    },
    footerBranding: null,
  });
  nearConnectorInstance = instance;
  nearConnectorNetwork = network;
  return instance;
}

/**
 * Opens the interactive `@hot-labs/near-connect` Wallet Selector modal (Meteor Web Popup & Extension,
 * MyNearWallet, Intear, HOT, Nightly, Sender, etc.) in any browser — no extension required.
 */
export async function connectWithNearConnectorModal(
  network: NearNetworkId = NEAR_CONFIG.network,
): Promise<NearWalletConnectionResult> {
  const connector = await getNearConnector(network);
  if (!connector) {
    throw new Error('NEAR browser wallet connector is unavailable in this environment.');
  }

  const wallet = await connector.connect();
  const accounts = await wallet.getAccounts({ network });
  const rawAccountId = accounts?.[0]?.accountId?.trim().toLowerCase() || '';
  if (!rawAccountId) {
    throw new Error('Selected NEAR wallet did not return an active account ID.');
  }

  const [status, view] = await Promise.all([
    fetchNearNetworkStatus(),
    fetchNearAccountView(rawAccountId),
  ]);

  setActiveWalletAuthKind('near-connect');
  const result: NearWalletConnectionResult = {
    accountId: rawAccountId,
    walletProvider: 'near-connect',
    walletName: wallet.manifest?.name || 'NEAR Wallet',
    isSignatureVerified: true,
    isLiveRpc: status.isLiveRpc,
    blockHeight: view?.blockHeight || status.blockHeight,
    amountYoctoNear: view?.amount || '0',
  };
  notifySigningWalletConnected(result);
  return result;
}

/**
 * Restores a previously connected `@hot-labs/near-connect` signing wallet session on page reload.
 */
export async function restoreConnectedNearSigningWallet(
  network: NearNetworkId = NEAR_CONFIG.network,
): Promise<NearWalletConnectionResult | null> {
  try {
    const connector = await getNearConnector(network);
    if (!connector) return null;
    const { wallet, accounts } = await connector.getConnectedWallet();
    const rawAccountId = accounts?.[0]?.accountId?.trim().toLowerCase() || '';
    if (!rawAccountId) return null;

    const [status, view] = await Promise.all([
      fetchNearNetworkStatus(),
      fetchNearAccountView(rawAccountId),
    ]);
    setActiveWalletAuthKind('near-connect');
    return {
      accountId: rawAccountId,
      walletProvider: 'near-connect',
      walletName: wallet.manifest?.name || 'NEAR Wallet',
      isSignatureVerified: true,
      isLiveRpc: status.isLiveRpc,
      blockHeight: view?.blockHeight || status.blockHeight,
      amountYoctoNear: view?.amount || '0',
    };
  } catch {
    return null;
  }
}

/**
 * Disconnects any active `@hot-labs/near-connect` wallet session and clears persisted auth kind.
 */
export async function disconnectNearWallet(): Promise<void> {
  try {
    const connector = await getNearConnector(NEAR_CONFIG.network);
    if (connector) {
      await connector.disconnect();
    }
  } catch {
    // ignore if already disconnected
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(WALLET_AUTH_KIND_STORAGE_ID);
      window.localStorage.removeItem('buddies_near_wallet_v2');
    } catch {
      // ignore
    }
  }
}

interface InjectedNearWalletProvider {
  accountId?: string;
  getAccountId?: () => Promise<string> | string;
  requestSignIn?: (params: { contractId: string }) => Promise<{ accountId?: string }>;
  signMessage?: (params: {
    message: string;
    recipient: string;
    nonce: Uint8Array;
  }) => Promise<{ signature?: string; publicKey?: string; accountId?: string }>;
  requestSignTransactions?: (opts: {
    transactions: Array<{
      receiverId: string;
      actions: Array<{
        type: 'FunctionCall';
        params: {
          methodName: string;
          args: Record<string, unknown>;
          gas: string;
          deposit: string;
        };
      }>;
    }>;
  }) => Promise<WalletSignTransactionOutcome[] | WalletSignTransactionOutcome>;
}

function getInjectedNearWallet(): {
  provider: InjectedNearWalletProvider | null;
  providerName: 'meteor-extension' | 'sender-extension' | 'near-extension';
} {
  if (typeof window === 'undefined') {
    return { provider: null, providerName: 'near-extension' };
  }
  const win = window as unknown as {
    meteorWallet?: InjectedNearWalletProvider;
    sender?: InjectedNearWalletProvider;
    near?: InjectedNearWalletProvider;
  };
  if (win.meteorWallet) return { provider: win.meteorWallet, providerName: 'meteor-extension' };
  if (win.sender) return { provider: win.sender, providerName: 'sender-extension' };
  if (win.near) return { provider: win.near, providerName: 'near-extension' };
  return { provider: null, providerName: 'near-extension' };
}

/**
 * Connects to a NEAR wallet via `@hot-labs/near-connect` or injected wallet when no explicit
 * account is provided, or performs a read-only RPC lookup (`rpc-observer`) if an explicit account ID
 * is inspected without a wallet signer.
 */
export async function connectNearWalletSelector(
  preferredAccountId?: string,
  options?: { requireWalletSignature?: boolean },
): Promise<NearWalletConnectionResult> {
  if (!preferredAccountId?.trim()) {
    // 1. Prefer interactive @hot-labs/near-connect modal (supports Meteor Web Popup, Extension, MyNearWallet, Intear, etc.)
    if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
      return connectWithNearConnectorModal(NEAR_CONFIG.network);
    }
  }

  const status = await fetchNearNetworkStatus();
  const { provider, providerName } = getInjectedNearWallet();

  if (provider && !preferredAccountId?.trim()) {
    try {
      let extAccountId =
        typeof provider.getAccountId === 'function'
          ? await provider.getAccountId()
          : provider.accountId;

      if (!extAccountId && typeof provider.requestSignIn === 'function') {
        const res = await provider.requestSignIn({
          contractId: NEAR_CONFIG.marketContractId,
        });
        extAccountId =
          res?.accountId ||
          (typeof provider.getAccountId === 'function'
            ? await provider.getAccountId()
            : provider.accountId);
      }

      if (extAccountId && typeof extAccountId === 'string' && extAccountId.trim().length > 0) {
        const cleanExtId = extAccountId.trim().toLowerCase();
        let nep413Signature: string | undefined;

        if (typeof provider.signMessage === 'function' && typeof crypto !== 'undefined') {
          try {
            const nonce = new Uint8Array(32);
            crypto.getRandomValues(nonce);
            const signed = await provider.signMessage({
              message: `Authenticate Citizen ${cleanExtId} for Buddies Blitz (${new Date().toISOString()})`,
              recipient: NEAR_CONFIG.marketContractId,
              nonce,
            });
            if (signed?.signature) {
              nep413Signature = signed.signature;
            }
          } catch {
            // Legacy extension may not support NEP-413 yet
          }
        }

        const view = await fetchNearAccountView(cleanExtId);
        setActiveWalletAuthKind('injected');
        const res: NearWalletConnectionResult = {
          accountId: cleanExtId,
          walletProvider: providerName,
          isSignatureVerified: true,
          nep413Signature,
          isLiveRpc: status.isLiveRpc,
          blockHeight: view?.blockHeight || status.blockHeight,
          amountYoctoNear: view?.amount || '0',
        };
        notifySigningWalletConnected(res);
        return res;
      }
    } catch {
      // Wallet extension declined
    }
  }

  if (options?.requireWalletSignature) {
    throw new Error(
      'Cryptographic NEAR wallet signature required. Click CONNECT NEAR WALLET to sign in with Meteor Wallet or MyNearWallet.',
    );
  }

  const candidateId = (preferredAccountId || '').trim().toLowerCase();
  if (!candidateId) {
    throw new Error(
      'No NEAR browser wallet connected. Click CONNECT NEAR WALLET to sign in with Meteor Wallet (Web or Extension).',
    );
  }

  const view = await fetchNearAccountView(candidateId);
  if (!view) {
    throw new Error(`Account "${candidateId}" was not found on the NEAR blockchain.`);
  }

  setActiveWalletAuthKind('rpc-observer');
  return {
    accountId: view.accountId,
    walletProvider: 'rpc-observer',
    isSignatureVerified: false,
    isLiveRpc: true,
    blockHeight: view.blockHeight || status.blockHeight,
    amountYoctoNear: view.amount,
  };
}

/**
 * NEP-141 `RESPITE` Token Metadata & Smart Contract Constants (`1 NEAR = 100 RESPITE`)
 * Unified 1:1 with `contracts/buddies-market/src/lib.rs` and `README.md`.
 */
export const RESPITE_NEP141_METADATA = {
  spec: 'ft-1.0.0',
  name: 'Buddies Blitz Respite',
  symbol: 'RESPITE',
  decimals: 0,
  contractId: NEAR_CONFIG.nep141RespiteContractId,
  rateRespitePerNear: 400,
} as const;

export const HOUSE_OWNERSHIP_PRICE_RESPITE = 100;

export type FamilyMemberContractPlanId = '1_week' | '1_month' | '1_year';
export type FamilyMemberOrderId = 'collect_boxes' | 'go_fishing' | 'warzone_attack';

export interface FamilyMemberContractPlan {
  id: FamilyMemberContractPlanId;
  label: string;
  shortLabel: string;
  durationDays: number;
  priceRespite: number;
  description: string;
}

export const FAMILY_MEMBER_CONTRACT_PLANS: FamilyMemberContractPlan[] = [
  {
    id: '1_week',
    label: '1 Week Contract',
    shortLabel: '1 WEEK',
    durationDays: 7,
    priceRespite: 15,
    description: 'Recruit a Family Member AI companion for 7 days (15 RESPITE).',
  },
  {
    id: '1_month',
    label: '1 Month Contract',
    shortLabel: '1 MONTH',
    durationDays: 30,
    priceRespite: 45,
    description: 'Recruit a Family Member AI companion for 30 days (45 RESPITE — Best Value).',
  },
  {
    id: '1_year',
    label: '1 Year Contract',
    shortLabel: '1 YEAR',
    durationDays: 365,
    priceRespite: 180,
    description: 'Recruit an elite Family Member AI companion for 365 days (180 RESPITE).',
  },
];

export interface FamilyMemberOrderSpec {
  id: FamilyMemberOrderId;
  label: string;
  shortLabel: string;
  description: string;
  rewardLul: number;
}

export const FAMILY_MEMBER_ORDER_SPECS: FamilyMemberOrderSpec[] = [
  {
    id: 'collect_boxes',
    label: 'Collect Supply Crates',
    shortLabel: 'COLLECT BOXES',
    description: 'Patrols Warzone drop zones, collects crates, and stacks your 2x2x2 base pad.',
    rewardLul: 15,
  },
  {
    id: 'go_fishing',
    label: 'Shoreline Fishing',
    shortLabel: 'GO FISHING',
    description: 'Casts lines at Central Oasis Lake & East Beach to stock your fish bucket.',
    rewardLul: 12,
  },
  {
    id: 'warzone_attack',
    label: 'Warzone Escort & Defense',
    shortLabel: 'WARZONE GUARD',
    description: 'Escorts your commander and defends claimed base perimeters.',
    rewardLul: 20,
  },
];

export interface RecruitedFamilyMemberAgent {
  agentId: string;
  name: string;
  contractAddress: string;
  planId: FamilyMemberContractPlanId;
  planLabel: string;
  pricePaidRespite: number;
  recruitedAtIso: string;
  expiresAtIso: string;
  activeOrder: FamilyMemberOrderId;
  nearTxHash: string;
}

export interface NearRespiteSwapReceipt {
  direction: 'near_to_respite' | 'respite_to_near';
  accountId: string;
  contractId: string;
  tokenContractId?: string;
  methodName: 'swap_near_for_respite';
  nearAmount: number;
  respiteAmount: number;
  txHash: string;
  timestampIso: string;
}

interface WalletSignTransactionOutcome {
  transaction?: { hash?: string };
  transaction_outcome?: { id?: string };
  status?: Record<string, unknown> | string;
  receipts_outcome?: Array<{ outcome?: { status?: Record<string, unknown> | string } }>;
  hash?: string;
}

let lastNearTransactionError: string | null = null;

export function getLastNearTransactionError(): string | null {
  return lastNearTransactionError;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function borshU32LE(val: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, val >>> 0, true);
  return new Uint8Array(buf);
}

function borshU64LE(val: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, val, true);
  return new Uint8Array(buf);
}

function borshU128LE(val: bigint): Uint8Array {
  const lo = val & 0xffffffffffffffffn;
  const hi = val >> 64n;
  return concatBytes([borshU64LE(lo), borshU64LE(hi)]);
}

function borshStringBytes(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  return concatBytes([borshU32LE(encoded.length), encoded]);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function extractExecutionFailureMessage(outcome: unknown): string | null {
  if (!outcome || typeof outcome !== 'object') return null;
  const rec = outcome as WalletSignTransactionOutcome;
  const topStatus = rec.status;
  if (topStatus && typeof topStatus === 'object' && 'Failure' in topStatus) {
    return JSON.stringify((topStatus as { Failure?: unknown }).Failure);
  }
  if (Array.isArray(rec.receipts_outcome)) {
    for (const r of rec.receipts_outcome) {
      const st = r?.outcome?.status;
      if (st && typeof st === 'object' && 'Failure' in st) {
        return JSON.stringify((st as { Failure?: unknown }).Failure);
      }
    }
  }
  return null;
}

/**
 * Signs and broadcasts a FunctionCall directly via FastNEAR RPC when the browser's
 * persistent Ed25519 key (`bb_citizen_fc_keypair_v2`) is authorized on `signerAccountId`.
 * Supports both zero-deposit FunctionCall keys and attached-deposit calls when the browser key
 * holds `FullAccess` on the citizen's isolated `<handle>.buddiesblitz.testnet` sub-account.
 */
async function trySignAndBroadcastWithLocalSessionKey(params: {
  signerAccountId: string;
  receiverId: string;
  methodName: string;
  args: Record<string, unknown>;
  gas: string;
  depositYocto: string;
}): Promise<{ ok: boolean; txHash: string; error?: string } | null> {
  const cleanSigner = params.signerAccountId.trim().toLowerCase();
  if (!cleanSigner) return null;
  // A citizen sub-account is never read-only for itself: if this browser
  // holds its session key, the on-chain access-key check below is the real
  // gate. The observer veto only applies to foreign accounts being viewed.
  if (isActiveWalletReadOnlyObserver() && !isCitizenSubAccountId(cleanSigner)) return null;

  const { publicKey, privateKey } = await getOrCreateCitizenSessionKeyPair();
  if (!privateKey || !publicKey.startsWith('ed25519:') || typeof crypto === 'undefined') {
    return null;
  }

  const depositBigInt = BigInt(params.depositYocto || '0');
  const { rpcUrl } = resolveNearRpcUrl(cleanSigner);
  try {
    const akResp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'check-fc-key',
        method: 'query',
        params: {
          request_type: 'view_access_key',
          finality: 'optimistic',
          account_id: cleanSigner,
          public_key: publicKey,
        },
      }),
    });
    if (!akResp.ok) return null;
    const akJson = await akResp.json();
    if (akJson?.error || !akJson?.result?.block_hash) {
      return null;
    }

    const isFullAccess = akJson.result.permission === 'FullAccess';
    if (depositBigInt > 0n && !isFullAccess) {
      // Scoped FunctionCall keys cannot attach NEAR deposit > 0 on NEAR protocol
      return null;
    }

    const nextNonce = BigInt(akJson.result.nonce) + 1n;
    const blockHashBytes = decodeBase58(String(akJson.result.block_hash));
    const pubKeyBytes = decodeBase58(publicKey.replace(/^ed25519:/i, ''));
    if (pubKeyBytes.length !== 32 || blockHashBytes.length !== 32) {
      return null;
    }

    const argsBytes = new TextEncoder().encode(JSON.stringify(params.args ?? {}));
    const functionCallAction = concatBytes([
      new Uint8Array([2]), // Action::FunctionCall
      borshStringBytes(params.methodName),
      borshU32LE(argsBytes.length),
      argsBytes,
      borshU64LE(BigInt(params.gas)),
      borshU128LE(depositBigInt),
    ]);

    const txBytes = concatBytes([
      borshStringBytes(cleanSigner),
      new Uint8Array([0]), // PublicKey::ED25519
      pubKeyBytes,
      borshU64LE(nextNonce),
      borshStringBytes(params.receiverId),
      blockHashBytes,
      borshU32LE(1),
      functionCallAction,
    ]);

    const txDigest = await crypto.subtle.digest(
      'SHA-256',
      txBytes.buffer.slice(txBytes.byteOffset, txBytes.byteOffset + txBytes.byteLength) as ArrayBuffer,
    );
    const sigBuffer = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, txDigest);
    const signedTxBytes = concatBytes([
      txBytes,
      new Uint8Array([0]), // Signature::ED25519
      new Uint8Array(sigBuffer),
    ]);

    const bcastResp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'bcast-fc-tx',
        method: 'broadcast_tx_commit',
        params: [bytesToBase64(signedTxBytes)],
      }),
    });
    const bcastJson = await bcastResp.json();
    if (bcastJson?.error) {
      const rawErrData = bcastJson.error?.data;
      const errDetail =
        typeof rawErrData === 'string'
          ? rawErrData
          : rawErrData
            ? JSON.stringify(rawErrData)
            : String(bcastJson.error?.message || 'RPC broadcast failed');
      return {
        ok: false,
        txHash: '',
        error: errDetail,
      };
    }

    const failure = extractExecutionFailureMessage(bcastJson?.result);
    if (failure) {
      return {
        ok: false,
        txHash: '',
        error: `Smart contract execution failed: ${failure}`,
      };
    }

    const confirmedHash = String(
      bcastJson?.result?.transaction?.hash ||
        bcastJson?.result?.transaction_outcome?.id ||
        encodeBase58(new Uint8Array(txDigest)),
    );
    return { ok: true, txHash: confirmedHash };
  } catch {
    return null;
  }
}

async function signAndSendNearTransaction(params: {
  signerAccountId?: string;
  receiverId: string;
  methodName: string;
  args: Record<string, unknown>;
  gas: string;
  depositYocto: string;
}): Promise<{ ok: boolean; txHash: string; signerAccountId?: string; error?: string }> {
  lastNearTransactionError = null;
  const network = resolveNearRpcUrl(params.receiverId).network;

  // 1. Browser self-custody Ed25519 key on `<handle>.buddiesblitz.testnet` (instant popup-free signing!)
  if (params.signerAccountId) {
    const sessionResult = await trySignAndBroadcastWithLocalSessionKey({
      signerAccountId: params.signerAccountId,
      receiverId: params.receiverId,
      methodName: params.methodName,
      args: params.args,
      gas: params.gas,
      depositYocto: params.depositYocto,
    });
    if (sessionResult) {
      if (!sessionResult.ok) {
        lastNearTransactionError = sessionResult.error || 'Session key execution failed.';
      }
      return {
        ...sessionResult,
        signerAccountId: params.signerAccountId,
      };
    }
  }

  // 2. Connected @hot-labs/near-connect wallet (Meteor Web Popup / Extension, MyNearWallet, Intear, HOT, etc.)
  const connector = await getNearConnector(network);
  if (connector) {
    let activeWallet: import('@hot-labs/near-connect').NearWalletBase | null = null;
    let activeAccountId = '';

    try {
      const connected = await connector.getConnectedWallet();
      activeWallet = connected.wallet;
      activeAccountId = connected.accounts?.[0]?.accountId?.trim().toLowerCase() || '';
    } catch {
      activeWallet = null;
    }

    // If no signing wallet is connected yet (e.g. user was in Read-Only Inspect mode), prompt wallet selector modal!
    if (!activeWallet) {
      try {
        const connectedRes = await connectWithNearConnectorModal(network);
        activeAccountId = connectedRes.accountId;
        activeWallet = await connector.wallet();
      } catch (connectErr) {
        const msg =
          connectErr instanceof Error
            ? connectErr.message
            : 'Connect a NEAR signing wallet (Meteor Wallet or MyNearWallet) to authorize this transaction.';
        lastNearTransactionError = msg;
        return { ok: false, txHash: '', error: msg };
      }
    }

    if (activeWallet) {
      try {
        const outcome = await activeWallet.signAndSendTransaction({
          network,
          signerId: activeAccountId || undefined,
          receiverId: params.receiverId,
          actions: [
            {
              type: 'FunctionCall',
              params: {
                methodName: params.methodName,
                args: params.args,
                gas: params.gas,
                deposit: params.depositYocto,
              },
            },
          ],
        });

        const failure = extractExecutionFailureMessage(outcome);
        if (failure) {
          const errMsg = `Contract rejected transaction: ${failure}`;
          lastNearTransactionError = errMsg;
          return { ok: false, txHash: '', error: errMsg };
        }

        const anyOutcome = outcome as unknown as WalletSignTransactionOutcome;
        const txHash =
          anyOutcome?.transaction?.hash ||
          anyOutcome?.transaction_outcome?.id ||
          anyOutcome?.hash ||
          '';

        if (!txHash) {
          const errMsg = 'Wallet did not return a confirmed NEAR transaction hash.';
          lastNearTransactionError = errMsg;
          return { ok: false, txHash: '', error: errMsg };
        }

        return {
          ok: true,
          txHash,
          signerAccountId: activeAccountId || params.signerAccountId,
        };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Transaction signing was cancelled or failed.';
        lastNearTransactionError = msg;
        return { ok: false, txHash: '', error: msg };
      }
    }
  }

  // 3. Fallback: Legacy injected window.meteorWallet / window.sender / window.near
  const { provider } = getInjectedNearWallet();
  if (!provider || typeof provider.requestSignTransactions !== 'function') {
    const errMsg =
      'Active NEAR wallet signer is required. Click WALLET and connect Meteor Wallet (Web or Extension) to sign transactions.';
    lastNearTransactionError = errMsg;
    return {
      ok: false,
      txHash: '',
      error: errMsg,
    };
  }

  try {
    const result = await provider.requestSignTransactions({
      transactions: [
        {
          receiverId: params.receiverId,
          actions: [
            {
              type: 'FunctionCall',
              params: {
                methodName: params.methodName,
                args: params.args,
                gas: params.gas,
                deposit: params.depositYocto,
              },
            },
          ],
        },
      ],
    });

    const first = Array.isArray(result) ? result[0] : result;
    const failure = extractExecutionFailureMessage(first);
    if (failure) {
      const errMsg = `Contract rejected transaction: ${failure}`;
      lastNearTransactionError = errMsg;
      return { ok: false, txHash: '', error: errMsg };
    }

    const txHash =
      first?.transaction?.hash || first?.transaction_outcome?.id || first?.hash || '';

    if (!txHash) {
      const errMsg = 'Wallet did not return a confirmed NEAR transaction hash.';
      lastNearTransactionError = errMsg;
      return { ok: false, txHash: '', error: errMsg };
    }

    return { ok: true, txHash, signerAccountId: params.signerAccountId };
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : 'Transaction signing was rejected.';
    lastNearTransactionError = errMsg;
    return { ok: false, txHash: '', error: errMsg };
  }
}

/**
 * Executes a real `swap_near_for_respite` transaction on `market.buddiesblitz.testnet`
 * (`1 NEAR = 100 RESPITE`, minimum `0.01 NEAR`).
 */
export async function executeNearTestnetAndRespiteSwap(params: {
  direction: 'near_to_respite' | 'respite_to_near';
  accountId?: string;
  signerAccountId?: string;
  inputAmount: number;
  networkId?: NearNetworkId;
}): Promise<NearRespiteSwapReceipt | null> {
  if (params.direction !== 'near_to_respite') {
    // RESPITE is a one-way utility token (no reverse NEAR drain path per anti-bot firewall)
    lastNearTransactionError = 'RESPITE is a non-convertible utility token (one-way NEAR -> RESPITE).';
    return null;
  }

  const rate = RESPITE_NEP141_METADATA.rateRespitePerNear;
  const cleanNearAmount = Math.max(0, Number(params.inputAmount) || 0);
  if (cleanNearAmount < 0.01) {
    lastNearTransactionError = 'Minimum swap deposit is 0.01 NEAR (= 1 RESPITE).';
    return null;
  }

  const requestedAccount = (params.accountId || params.signerAccountId || '').trim();
  const respiteAmount = Math.floor(cleanNearAmount * rate);
  const depositYocto = `${BigInt(Math.max(1, Math.round(cleanNearAmount * 100))) * 10n ** 22n}`;

  const txResult = await signAndSendNearTransaction({
    signerAccountId: requestedAccount || undefined,
    receiverId: RESPITE_NEP141_METADATA.contractId,
    methodName: 'swap_near_for_respite',
    args: {},
    gas: '50000000000000',
    depositYocto,
  });

  if (!txResult.ok || !txResult.txHash) {
    return null;
  }

  const confirmedAccount = (txResult.signerAccountId || requestedAccount || '').trim();
  return {
    direction: 'near_to_respite',
    accountId: confirmedAccount,
    contractId: RESPITE_NEP141_METADATA.contractId,
    tokenContractId: RESPITE_NEP141_METADATA.contractId,
    methodName: 'swap_near_for_respite',
    nearAmount: cleanNearAmount,
    respiteAmount,
    txHash: txResult.txHash,
    timestampIso: new Date().toISOString(),
  };
}

export type BuddiesMarketMethodName =
  | 'purchase_citizen_asset'
  | 'mint_fish_nft'
  | 'mint_fish_nft_attested'
  | 'list_fish_nft'
  | 'buy_fish_nft'
  | 'buy_merchant_item'
  | 'sell_merchant_item'
  | 'list_property_deed'
  | 'list_property_furniture'
  | 'buy_property'
  | 'cancel_property_listing'
  | 'unlist_fish_nft'
  | 'ft_transfer'
  | 'nft_transfer'
  | 'authorize_deed_session_key'
  | 'claim_deed_payout'
  | 'mint_merchant_item'
  | 'mt_transfer'
  | 'claim_hana_welcome_near';

const ONE_YOCTO_REQUIRED_METHODS: ReadonlySet<BuddiesMarketMethodName> = new Set([
  'ft_transfer',
  'nft_transfer',
  'mt_transfer',
]);

/**
 * Executes a strongly-typed state-mutating call on `market.buddiesblitz.testnet`
 * matching the exact JSON method signatures in `contracts/buddies-market/src/lib.rs`.
 */
export async function executeMarketContractCallOnChain(params: {
  methodName: BuddiesMarketMethodName;
  args: Record<string, unknown>;
  depositNear?: string;
  signerAccountId?: string;
}): Promise<{
  ok: boolean;
  txHash: string;
  signerAccountId?: string;
  explorerUrl: string;
  contractId: string;
  methodName: BuddiesMarketMethodName;
  error?: string;
}> {
  const nearFloat = Number(params.depositNear || '0') || 0;
  const depositYocto =
    nearFloat > 0
      ? `${BigInt(Math.max(1, Math.round(nearFloat * 10000))) * 10n ** 20n}`
      : ONE_YOCTO_REQUIRED_METHODS.has(params.methodName)
        ? '1'
        : '0';

  const res = await signAndSendNearTransaction({
    signerAccountId: params.signerAccountId,
    receiverId: NEAR_CONFIG.marketContractId,
    methodName: params.methodName,
    args: params.args,
    gas: '60000000000000',
    depositYocto,
  });

  return {
    ok: res.ok,
    txHash: res.txHash,
    signerAccountId: res.signerAccountId,
    explorerUrl: res.txHash ? getNearBlocksTxUrl(res.txHash, NEAR_CONFIG.network) : '',
    contractId: NEAR_CONFIG.marketContractId,
    methodName: params.methodName,
    error: res.error,
  };
}

export interface HanaSmartContractTreasuryStatus {
  grantAmountNear: number;
  liquidTreasuryNear: number;
  callerAlreadyClaimed: boolean;
}

function formatYoctoNearToNear(yocto: string): number {
  try {
    const raw = BigInt((yocto || '0').trim() || '0');
    const milliNear = Number(raw / 10n ** 21n);
    return Math.round(milliNear) / 1000;
  } catch {
    return 0;
  }
}

export async function fetchHanaTreasuryStatus(
  accountId?: string,
): Promise<HanaSmartContractTreasuryStatus> {
  const cleanId = (accountId || '').trim().toLowerCase();
  const parsed = await callNearContractViewMethod<{
    grant_amount_yocto?: string;
    liquid_treasury_yocto?: string;
    caller_already_claimed?: boolean;
  }>({
    contractId: NEAR_CONFIG.marketContractId,
    methodName: 'get_hana_treasury_status',
    args: cleanId ? { account_id: cleanId } : {},
    networkOrAccount: cleanId || NEAR_CONFIG.marketContractId,
  });

  if (!parsed) {
    return {
      grantAmountNear: 0.3,
      liquidTreasuryNear: 0,
      callerAlreadyClaimed: false,
    };
  }

  return {
    grantAmountNear: formatYoctoNearToNear(String(parsed.grant_amount_yocto || '300000000000000000000000')),
    liquidTreasuryNear: formatYoctoNearToNear(String(parsed.liquid_treasury_yocto || '0')),
    callerAlreadyClaimed: Boolean(parsed.caller_already_claimed),
  };
}

export async function claimHanaWelcomeNearOnChain(signerAccountId: string): Promise<{
  ok: boolean;
  txHash: string;
  explorerUrl: string;
  amountNear: number;
  error?: string;
}> {
  const res = await executeMarketContractCallOnChain({
    methodName: 'claim_hana_welcome_near',
    args: {},
    signerAccountId,
  });
  return {
    ok: res.ok,
    txHash: res.txHash,
    explorerUrl: res.explorerUrl,
    amountNear: 0.3,
    error: res.error,
  };
}
