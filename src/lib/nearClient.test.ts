import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  NEAR_CONFIG,
  RESPITE_NEP141_METADATA,
  executeNearTestnetAndRespiteSwap,
  getMyNearWalletLoginUrl,
  getNearBlocksAccountUrl,
  getNearBlocksTxUrl,
  getOrCreateCitizenSessionPublicKey,
  resolveNearRpcUrl,
  verifyNep171GamepassOwnership,
} from './nearClient';
import { handleNearRelayerRequest } from '../../api/near-relayer';
import {
  MERCHANT_CATALOG_ITEMS,
  createInitialMerchantMarketState,
  createInitialPlacedHouseFurniture,
  generateNpcMerchantReply,
} from '../game/buddiesMerchantPricing';

test('resolveNearRpcUrl routes .testnet and .near accounts to matching NEAR JSON-RPC endpoints', () => {
  assert.deepEqual(resolveNearRpcUrl('testnet'), {
    network: 'testnet',
    rpcUrl: 'https://rpc.testnet.fastnear.com',
  });
  assert.deepEqual(resolveNearRpcUrl('judge01.buddiesblitz.testnet'), {
    network: 'testnet',
    rpcUrl: 'https://rpc.testnet.fastnear.com',
  });
  assert.deepEqual(resolveNearRpcUrl('mainnet'), {
    network: 'mainnet',
    rpcUrl: 'https://rpc.mainnet.fastnear.com',
  });
  assert.deepEqual(resolveNearRpcUrl('commander.near'), {
    network: 'mainnet',
    rpcUrl: 'https://rpc.mainnet.fastnear.com',
  });
});

test('getMyNearWalletLoginUrl points to Testnet MyNearWallet with market.buddiesblitz.testnet contract_id', () => {
  const testnetUrl = getMyNearWalletLoginUrl('testnet');
  assert.equal(
    testnetUrl,
    `https://testnet.mynearwallet.com/login/?contract_id=${encodeURIComponent(NEAR_CONFIG.marketContractId)}`,
  );

  const mainnetUrl = getMyNearWalletLoginUrl('mainnet');
  assert.equal(
    mainnetUrl,
    `https://app.mynearwallet.com/login/?contract_id=${encodeURIComponent(NEAR_CONFIG.marketContractId)}`,
  );
});

test('getNearBlocksAccountUrl and getNearBlocksTxUrl generate valid explorer links for Testnet and Mainnet', () => {
  assert.equal(
    getNearBlocksAccountUrl('market.buddiesblitz.testnet'),
    'https://testnet.nearblocks.io/address/market.buddiesblitz.testnet',
  );
  assert.equal(
    getNearBlocksAccountUrl('alice.near'),
    'https://nearblocks.io/address/alice.near',
  );
  assert.equal(
    getNearBlocksTxUrl('88SbE7m1VQKh8GXqYwy9uvxkAFkaLFZ6vtAd5wsowLB4', 'testnet'),
    'https://testnet.nearblocks.io/txns/88SbE7m1VQKh8GXqYwy9uvxkAFkaLFZ6vtAd5wsowLB4',
  );
  assert.equal(
    getNearBlocksTxUrl('88SbE7m1VQKh8GXqYwy9uvxkAFkaLFZ6vtAd5wsowLB4', 'mainnet'),
    'https://nearblocks.io/txns/88SbE7m1VQKh8GXqYwy9uvxkAFkaLFZ6vtAd5wsowLB4',
  );
});

test('on-chain economic constants match contracts/buddies-market/src/lib.rs 1:1', () => {
  assert.equal(HOUSE_OWNERSHIP_PRICE_RESPITE, 25);
  assert.equal(RESPITE_NEP141_METADATA.symbol, 'RESPITE');
  assert.equal(RESPITE_NEP141_METADATA.decimals, 0);
  assert.equal(RESPITE_NEP141_METADATA.rateRespitePerNear, 100);
  assert.deepEqual(
    FAMILY_MEMBER_CONTRACT_PLANS.map((p) => ({ id: p.id, price: p.priceRespite })),
    [
      { id: '1_week', price: 15 },
      { id: '1_month', price: 45 },
      { id: '1_year', price: 180 },
    ],
  );
});

test('executeNearTestnetAndRespiteSwap enforces one-way NEAR -> RESPITE anti-bot treasury firewall', async () => {
  const blockedReverseSwap = await executeNearTestnetAndRespiteSwap({
    direction: 'respite_to_near',
    accountId: 'judge01.buddiesblitz.testnet',
    inputAmount: 100,
  });
  assert.equal(blockedReverseSwap, null);
});

test('getOrCreateCitizenSessionPublicKey generates a valid Base58 Ed25519 FunctionCall public key', async () => {
  const pubKey = await getOrCreateCitizenSessionPublicKey();
  assert.ok(pubKey.startsWith('ed25519:'), `Expected ed25519: prefix, got ${pubKey}`);
  assert.ok(pubKey.length > 35, `Expected 32-byte Base58 key length > 35, got ${pubKey.length}`);
  assert.match(pubKey, /^ed25519:[1-9A-HJ-NP-Za-km-z]+$/);
});

test('handleNearRelayerRequest validates handle & FunctionCall session key and provisions <handle>.buddiesblitz.testnet', async () => {
  const validSessionKey = await getOrCreateCitizenSessionPublicKey();

  // 1. Rejects short/invalid handle
  const badHandle = await handleNearRelayerRequest({
    action: 'create_subaccount',
    handle: 'x',
    sessionPublicKey: validSessionKey,
  });
  assert.equal(badHandle.status, 400);
  assert.equal(badHandle.payload.ok, false);

  // 2. Rejects missing/malformed ed25519: session key
  const badKey = await handleNearRelayerRequest({
    action: 'create_subaccount',
    handle: 'judge01',
    sessionPublicKey: 'not-an-ed25519-key',
  });
  assert.equal(badKey.status, 400);
  assert.equal(badKey.payload.ok, false);

  // 3. Provisions <handle>.buddiesblitz.testnet cleanly (mocking RPC view_account as non-existent)
  const originalFetch = globalThis.fetch;
  const savedMasterSecret = process.env.NEAR_MASTER_PRIVATE_KEY;
  process.env.NEAR_MASTER_PRIVATE_KEY = '';
  globalThis.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({ error: { message: 'Account judge01.buddiesblitz.testnet does not exist' } }),
    }) as Response) as typeof fetch;

  try {
    const provisioned = await handleNearRelayerRequest({
      action: 'create_subaccount',
      handle: 'Judge01',
      sessionPublicKey: validSessionKey,
    });
    assert.equal(provisioned.status, 200);
    assert.equal(provisioned.payload.ok, true);
    assert.equal(provisioned.payload.subAccountId, 'judge01.buddiesblitz.testnet');
    assert.equal(provisioned.payload.sessionPublicKey, validSessionKey);
    assert.equal(provisioned.payload.marketContractId, 'market.buddiesblitz.testnet');
  } finally {
    globalThis.fetch = originalFetch;
    if (savedMasterSecret === undefined) {
      delete process.env.NEAR_MASTER_PRIVATE_KEY;
    } else {
      process.env.NEAR_MASTER_PRIVATE_KEY = savedMasterSecret;
    }
  }
});

test('3-currency anti-bot P2P economy and empty-start Modern Japanese Wooden Pavilion invariants hold', () => {
  // 1. Newly purchased Private House starts 100% empty (zero pre-placed furniture)
  assert.deepEqual(createInitialPlacedHouseFurniture(), []);

  // 2. Catalog items strictly separate CYON (regular non-NFT) vs RESPITE (exclusive NFT), never direct LUL
  for (const item of MERCHANT_CATALOG_ITEMS) {
    assert.ok(item.currency === 'CYON' || item.currency === 'RESPITE');
    if (item.isNft) {
      assert.equal(item.currency, 'RESPITE', `NFT item ${item.id} must be priced in RESPITE`);
    } else {
      assert.equal(item.currency, 'CYON', `Regular item ${item.id} must be priced in CYON`);
    }
  }

  // 3. NPC dialogue accurately teaches Fish/Warzone -> LUL -> swap to CYON and P2P RESPITE
  const state = createInitialMerchantMarketState();
  const currencyReply = generateNpcMerchantReply('lul cyon respite currency', 'beach_house', state, {
    lul: 120,
    cyon: 60,
    respite: 25,
    walletConnected: true,
  });
  assert.match(currencyReply, /LUL/i);
  assert.match(currencyReply, /CYON/i);
  assert.match(currencyReply, /RESPITE/i);
  assert.match(currencyReply, /Kai/i);
});

test('verifyNep171GamepassOwnership strictly distinguishes House Deeds from Fish NFTs on market.buddiesblitz.testnet', async () => {
  const originalFetch = globalThis.fetch;

  try {
    // Case A: Citizen owns only a minted Fish NFT -> must NOT unlock House Ownership
    const fishOnlyTokens = [
      {
        token_id: 'nep171-fish-golden_harbor_tuna-1001',
        metadata: {
          title: 'Golden Harbor Tuna (9.45 kg)',
          description: 'Caught at East Beach',
          extra: JSON.stringify({ kind: 'fish_nft', rarity: 'Rare' }),
        },
      },
    ];
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          result: {
            result: Array.from(new TextEncoder().encode(JSON.stringify(fishOnlyTokens))),
          },
        }),
      }) as Response) as typeof fetch;

    const fishCheck = await verifyNep171GamepassOwnership('angler.testnet');
    assert.equal(fishCheck.verified, false);
    assert.equal(fishCheck.token, null);

    // Case B: Citizen owns a House Deed NFT -> unlocks House Ownership
    const houseAndFishTokens = [
      ...fishOnlyTokens,
      {
        token_id: 'house-deed-0001',
        metadata: {
          title: 'Modern Japanese Wooden Pavilion Deed #1',
          description: 'Private House Sub-Account Deed',
          extra: JSON.stringify({ kind: 'house_deed', sub_account_id: 'estate-0001.buddiesblitz.testnet' }),
        },
      },
    ];
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          result: {
            result: Array.from(new TextEncoder().encode(JSON.stringify(houseAndFishTokens))),
          },
        }),
      }) as Response) as typeof fetch;

    const deedCheck = await verifyNep171GamepassOwnership('buddiesblitz.testnet');
    assert.equal(deedCheck.verified, true);
    assert.equal(deedCheck.token?.tokenId, 'house-deed-0001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
