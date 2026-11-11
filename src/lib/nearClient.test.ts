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
import { buildNpcSystemInstruction, handleNpcAgentRequest } from '../../api/npc-agent';
import {
  MERCHANT_CATALOG_ITEMS,
  createInitialMerchantMarketState,
  createInitialPlacedHouseFurniture,
  generateNpcMerchantReply,
} from '../game/buddiesMerchantPricing';
import {
  createInitialNearGamepassSessionState,
  syncNearWalletSessionOwnership,
} from '../game/buddiesBlitzRules';

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

test('strictUniqueHandle blocks hijacking taken <handle>.buddiesblitz.testnet & syncNearWalletSessionOwnership never grants dummy House ownership', async () => {
  const validSessionKey = await getOrCreateCitizenSessionPublicKey();
  const originalFetch = globalThis.fetch;
  const savedMasterSecret = process.env.NEAR_MASTER_PRIVATE_KEY;
  process.env.NEAR_MASTER_PRIVATE_KEY = '';

  try {
    // Mock RPC where `taken.buddiesblitz.testnet` already exists AND does NOT have caller's sessionPublicKey
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const reqType = body?.params?.request_type;
      if (reqType === 'view_account') {
        return {
          ok: true,
          json: async () => ({ result: { amount: '100000000000000000000000' } }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ error: { message: 'Access key does not exist' } }),
      } as Response;
    }) as typeof fetch;

    const takenRes = await handleNearRelayerRequest({
      action: 'create_subaccount',
      handle: 'taken',
      sessionPublicKey: validSessionKey,
      strictUniqueHandle: true,
    });
    assert.equal(takenRes.status, 409);
    assert.equal(takenRes.payload.code, 'HANDLE_TAKEN');

    // Fresh citizen wallet without a verified House Deed must NEVER receive ownsHouse=true
    const initialRegistry = createInitialNearGamepassSessionState();
    const syncedFresh = syncNearWalletSessionOwnership(
      initialRegistry,
      'citizen01.buddiesblitz.testnet',
      false,
    );
    assert.equal(syncedFresh.walletConnected, true);
    assert.equal(syncedFresh.accountId, 'citizen01.buddiesblitz.testnet');
    assert.equal(syncedFresh.hasGamepassNft, false);
    assert.equal(syncedFresh.claimedPlotIndex, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedMasterSecret === undefined) {
      delete process.env.NEAR_MASTER_PRIVATE_KEY;
    } else {
      process.env.NEAR_MASTER_PRIVATE_KEY = savedMasterSecret;
    }
  }
});

test('Hana and Kai live chat concierge answers Fish NFT sales records, locations, and game mechanics in simple English without jargon or emojis', () => {
  const state = createInitialMerchantMarketState();
  const balances = {
    lul: 180,
    cyon: 45,
    respite: 30,
    nearBalance: 0.36,
    walletConnected: true,
    playerAccount: 'india0x69.buddiesblitz.testnet',
    ownsHouse: false,
    hanaWelcomeNearClaimed: false,
  };

  // 1. Most expensive Fish NFT sold (with live completed sale record)
  const topSaleReply = generateNpcMerchantReply(
    'ikan nft paling mahal terjual apa?',
    'lobby_cafe',
    state,
    balances,
    {
      fishSalesStats: {
        topSale: {
          speciesName: 'Astral Dragon Arowana',
          weightKg: 14.5,
          priceRespite: 95,
          buyerAccount: 'ace.buddiesblitz.testnet',
          sellerAccount: 'kai_fan.buddiesblitz.testnet',
        },
        recentSale: null,
        totalSalesCount: 3,
      },
      fishMarketListings: [],
    },
  );
  assert.match(topSaleReply, /Astral Dragon Arowana/);
  assert.match(topSaleReply, /14\.50 kg/);
  assert.match(topSaleReply, /95 RESPITE/);

  // 2. Most expensive Fish NFT sold when 0 completed sales exist -> reports highest active listing
  const activeListingReply = generateNpcMerchantReply(
    'what is the most expensive fish nft sold?',
    'lobby_cafe',
    state,
    balances,
    {
      fishSalesStats: { topSale: null, recentSale: null, totalSalesCount: 0 },
      fishMarketListings: [
        {
          speciesName: 'Golden Harbor Tuna',
          rarity: 'Rare',
          weightKg: 11.2,
          sellerNearAccount: 'angler.buddiesblitz.testnet',
          priceRespite: 42,
        },
      ],
    },
  );
  assert.match(activeListingReply, /No Fish NFT has been sold yet/i);
  assert.match(activeListingReply, /Golden Harbor Tuna/);
  assert.match(activeListingReply, /42 RESPITE/);

  // 3. Location / navigation questions (English & Indonesian)
  const whereFishingReply = generateNpcMerchantReply(
    'dimana tempat mancing dan kai?',
    'lobby_cafe',
    state,
    balances,
  );
  assert.match(whereFishingReply, /Beachfront Harbor|NW Fishing Lake/i);

  const whereWarzoneReply = generateNpcMerchantReply(
    'where is the warzone arena?',
    'lobby_cafe',
    state,
    balances,
  );
  assert.match(whereWarzoneReply, /Transit Kiosk/i);
  assert.match(whereWarzoneReply, /Warzone/i);

  // 4. Zero developer jargon & zero emojis in concierge replies
  for (const reply of [topSaleReply, activeListingReply, whereFishingReply, whereWarzoneReply]) {
    assert.doesNotMatch(reply, /NEP-171|NEP-245|NEP-141|sub-wallet|Ed25519/i);
    assert.doesNotMatch(reply, /[\u{1F300}-\u{1FAFF}]/u);
  }
});

test('api/npc-agent enforces multilingual in-game guardrails, injects live Fish NFT records, and sanitizes Gemini output', async () => {
  const sysPrompt = buildNpcSystemInstruction('lobby_cafe', {
    citizenDisplayName: 'Raka',
    playerNearAccount: 'india0x69.buddiesblitz.testnet',
    walletConnected: true,
    lulBalance: 240,
    cyonBalance: 50,
    respiteBalance: 15,
    nearBalance: 0.36,
    fishSalesStats: {
      topSale: {
        speciesName: 'Ancient Coelacanth',
        weightKg: 29.4,
        priceRespite: 140,
        buyerAccount: 'collector.buddiesblitz.testnet',
        sellerAccount: 'kai_pro.buddiesblitz.testnet',
      },
      recentSale: null,
      totalSalesCount: 4,
    },
  });

  assert.match(sysPrompt, /IN-GAME TOPICS ONLY/);
  assert.match(sysPrompt, /MATCH PLAYER LANGUAGE/);
  assert.match(sysPrompt, /Ancient Coelacanth \(29\.40 kg\) for 140 RESPITE/);

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '🎣 Rekor tertinggi saat ini adalah **Ancient Coelacanth** seharga 140 RESPITE di sub-wallet NEP-171!',
                  },
                ],
              },
            },
          ],
        }),
      }) as Response) as typeof fetch;

    const res = await handleNpcAgentRequest(
      {
        userMessage: 'ikan apa yang paling mahal laku?',
        merchantLocation: 'lobby_cafe',
        history: [{ role: 'player', text: 'halo hana' }],
      },
      'test-gemini-key',
    );
    assert.equal(res.status, 200);
    assert.equal(res.payload.ok, true);
    assert.ok(res.payload.reply);
    assert.doesNotMatch(res.payload.reply, /\*\*/);
    assert.doesNotMatch(res.payload.reply, /NEP-171/i);
    assert.doesNotMatch(res.payload.reply, /sub-wallet/i);
    assert.doesNotMatch(res.payload.reply, /🎣/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
