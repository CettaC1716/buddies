import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAMILY_MEMBER_CONTRACT_PLANS,
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  NEAR_CONFIG,
  RESPITE_NEP141_METADATA,
  executeNearTestnetAndRespiteSwap,
  fetchHanaTreasuryStatus,
  fetchNearAccountView,
  fetchNep141Balance,
  fetchOwnedFishNftsFromChain,
  fetchOwnedNep245CatalogCounts,
  getMyNearWalletLoginUrl,
  getNearBlocksAccountUrl,
  getNearBlocksTxUrl,
  getOrCreateCitizenSessionPublicKey,
  resolveNearRpcUrl,
  resolvePostClaimNearBalance,
  shouldAttemptAttestedHanaClaim,
  verifyNep171GamepassOwnership,
} from './nearClient';
import { handleNearRelayerRequest } from '../../api/near-relayer';
import { buildNpcSystemInstruction, handleNpcAgentRequest } from '../../api/npc-agent';
import {
  MERCHANT_CATALOG_ITEMS,
  createInitialMerchantMarketState,
  createInitialPlacedHouseFurniture,
  formatHouseDeedBadgeLabel,
  formatWalletHistoryActionLabel,
  formatWalletHistoryAmountDisplay,
  generateNpcMerchantReply,
  getHouseStyleDisplaySpec,
  mergeOwnedCatalogWithChainNep245,
  resolveTutorialFurnitureTarget,
} from '../game/buddiesMerchantPricing';
import {
  createInitialNearGamepassSessionState,
  syncNearWalletSessionOwnership,
} from '../game/buddiesBlitzRules';
import {
  FISH_SPECIES_CATALOG,
  createShorelineBiteSchedule,
  createShorelineMinigameState,
  stepShorelineMinigame,
} from '../game/buddiesFishingMarket';
import { buildShorelineProceduralFishGroup } from '../components/ShorelineCatchShowcaseModal';

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
  assert.equal(HOUSE_OWNERSHIP_PRICE_RESPITE, 100);
  assert.equal(RESPITE_NEP141_METADATA.symbol, 'RESPITE');
  assert.equal(RESPITE_NEP141_METADATA.decimals, 0);
  assert.equal(RESPITE_NEP141_METADATA.rateRespitePerNear, 400);
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

test('fetchOwnedFishNftsFromChain parses owned Fish NFTs from chain and excludes House Deeds, and 3D fish meshes build cleanly', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const mockTokens = [
      {
        token_id: 'house-deed-india0x69.buddiesblitz.testnet',
        metadata: {
          title: 'Safezone House Deed',
          extra: JSON.stringify({ kind: 'house_deed' }),
        },
      },
      {
        token_id: 'nep171-fish-golden_harbor_tuna-8821',
        metadata: {
          title: 'Golden Harbor Tuna (14.25 kg - Rare)',
          extra: JSON.stringify({
            kind: 'fish',
            species_id: 'golden_harbor_tuna',
            water_zone: 'east_beach',
            rarity: 'Rare',
            weight_kg_x100: 1425,
          }),
        },
      },
    ];
    const encodedResult = Array.from(Buffer.from(JSON.stringify(mockTokens), 'utf8'));
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          result: { result: encodedResult },
        }),
      }) as Response) as typeof fetch;

    const ownedFish = await fetchOwnedFishNftsFromChain('india0x69.buddiesblitz.testnet');
    assert.equal(ownedFish.length, 1);
    assert.deepEqual(ownedFish[0], {
      tokenId: 'nep171-fish-golden_harbor_tuna-8821',
      speciesId: 'golden_harbor_tuna',
      speciesName: 'Golden Harbor Tuna',
      waterZone: 'east_beach',
      rarity: 'Rare',
      weightKg: 14.25,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Verify 3D procedural fish geometry builds & animates cleanly for every catalog species
  for (const species of FISH_SPECIES_CATALOG) {
    const model = buildShorelineProceduralFishGroup(species.speciesId, species.colorHex);
    assert.ok(model.group.children.length > 0, `Expected 3D meshes for ${species.speciesId}`);
    model.updateSwimAnimation(0.5);
    model.dispose();
  }
});

test('Shoreline fishing enforces realistic calm-float + nibble wait and multi-second surge reeling fight to shore', () => {
  // 1. Pre-bite pacing is never instant: >= 2.8s calm float + 2..4 spaced nibbles (>= 1.2s each)
  for (const rVal of [0.0, 0.45, 0.99]) {
    const sched = createShorelineBiteSchedule({
      waterZone: 'east_beach',
      castPower: 0.75,
      rng: () => rVal,
    });
    assert.ok(sched.initialWaitSec >= 2.8 && sched.initialWaitSec <= 5.4);
    assert.ok(sched.nibbleIntervalSec >= 1.2 && sched.nibbleIntervalSec <= 1.7);
    assert.ok(sched.nibblesTotal >= 2 && sched.nibblesTotal <= 4);
    const totalPreBiteSec = Number(
      (sched.initialWaitSec + sched.nibblesTotal * sched.nibbleIntervalSec).toFixed(2),
    );
    assert.ok(
      totalPreBiteSec >= 5.2,
      `Expected >= 5.2s pre-bite wait, got ${totalPreBiteSec.toFixed(2)}s`,
    );
  }

  // 2. Fight minigame never catches in < 4s, snaps if blindly reeling through heavy surges, and lands when reeled to <= 1.6m
  const strongSpecies =
    FISH_SPECIES_CATALOG.find((s) => s.fightStrength >= 0.8) ?? FISH_SPECIES_CATALOG[0];
  let blindState = createShorelineMinigameState(strongSpecies, 0.8);
  let blindElapsedSec = 0;
  while (blindState.status === 'active' && blindElapsedSec < 25) {
    blindState = stepShorelineMinigame(blindState, 0.05, true, () => 0.8);
    blindElapsedSec += 0.05;
    if (blindElapsedSec < 4.0) {
      assert.notEqual(blindState.status, 'caught', 'Fish must not be caught in under 4 seconds');
    }
  }
  assert.equal(
    blindState.status,
    'snapped',
    'Blindly reeling a strong fish through surges should overload and snap the line',
  );

  // Smart angler eases off when surging/high tension and reels when safe -> lands at shore (distanceM <= 1.6) after real fight
  let smartState = createShorelineMinigameState(strongSpecies, 0.7);
  let smartElapsedSec = 0;
  while (smartState.status === 'active' && smartElapsedSec < 30) {
    const shouldReel = !smartState.isSurging && smartState.tension < 0.82;
    smartState = stepShorelineMinigame(smartState, 0.05, shouldReel, () => 0.5);
    smartElapsedSec += 0.05;
  }
  assert.equal(smartState.status, 'caught');
  assert.ok(smartState.distanceM <= 1.6);
  assert.ok(
    smartElapsedSec >= 5.0,
    `Expected realistic >= 5.0s fight duration, got ${smartElapsedSec.toFixed(2)}s`,
  );
});

test('resolvePostClaimNearBalance & shouldAttemptAttestedHanaClaim protect new players from post-claim balance lag and double prompts', () => {
  // 1. Pre-receipt RPC read (~0.0794 NEAR right after Claim): projects 0.38 NEAR so Swap unlocks at once
  const laggingReceipt = resolvePostClaimNearBalance({
    previousNearBalance: 0.08,
    observedNearBalance: 0.0794,
    grantAmountNear: 0.3,
  });
  assert.equal(laggingReceipt.nextNearBalance, 0.38);
  assert.equal(laggingReceipt.receiptConfirmedOnChain, false);
  assert.equal(laggingReceipt.pendingFloorNear, 0.23);

  // 2. Stale 0 balance in React state + pre-receipt RPC 0.0794 NEAR -> projects 0.3794 NEAR
  const coldStateLagging = resolvePostClaimNearBalance({
    previousNearBalance: 0,
    observedNearBalance: 0.0794,
    grantAmountNear: 0.3,
  });
  assert.equal(coldStateLagging.nextNearBalance, 0.3794);
  assert.equal(coldStateLagging.receiptConfirmedOnChain, false);

  // 3. Receipt already landed on-chain (~0.3794 NEAR): locks onto exact chain value
  const settledReceipt = resolvePostClaimNearBalance({
    previousNearBalance: 0.08,
    observedNearBalance: 0.3794,
    grantAmountNear: 0.3,
  });
  assert.equal(settledReceipt.nextNearBalance, 0.3794);
  assert.equal(settledReceipt.receiptConfirmedOnChain, true);

  // 4. Transient RPC failure (null): still unlocks Swap optimistically
  const rpcMiss = resolvePostClaimNearBalance({
    previousNearBalance: 0.08,
    observedNearBalance: null,
    grantAmountNear: 0.3,
  });
  assert.equal(rpcMiss.nextNearBalance, 0.38);
  assert.equal(rpcMiss.receiptConfirmedOnChain, false);

  // 5. Attested claim gated behind VITE_ENABLE_ATTESTED_HANA_CLAIM === 'true'
  assert.equal(shouldAttemptAttestedHanaClaim('player@gmail.com', undefined), false);
  assert.equal(shouldAttemptAttestedHanaClaim('player@gmail.com', 'false'), false);
  assert.equal(shouldAttemptAttestedHanaClaim('', 'true'), false);
  assert.equal(shouldAttemptAttestedHanaClaim('player@gmail.com', 'true'), true);
});

test('NEAR balance and Hana treasury view helpers forward optimistic finality and report RPC verification status', async () => {
  const originalFetch = globalThis.fetch;
  const recordedFinalities: Array<{ requestType: string; methodName?: string; finality: string }> = [];

  try {
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const params = body?.params ?? {};
      recordedFinalities.push({
        requestType: String(params.request_type || ''),
        methodName: params.method_name,
        finality: String(params.finality || ''),
      });

      if (params.request_type === 'view_account') {
        return {
          ok: true,
          json: async () => ({
            result: { amount: '380000000000000000000000', locked: '0', storage_usage: 500, block_height: 100, block_hash: 'H' },
          }),
        } as Response;
      }

      if (params.method_name === 'ft_balance_of') {
        return {
          ok: true,
          json: async () => ({
            result: { result: Array.from(new TextEncoder().encode(JSON.stringify('100'))) },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          result: {
            result: Array.from(
              new TextEncoder().encode(
                JSON.stringify({
                  grant_amount_yocto: '300000000000000000000000',
                  liquid_treasury_yocto: '5000000000000000000000000',
                  caller_already_claimed: true,
                }),
              ),
            ),
          },
        }),
      } as Response;
    }) as typeof fetch;

    const acct = await fetchNearAccountView('raka.buddiesblitz.testnet', 'optimistic');
    const resp = await fetchNep141Balance('market.buddiesblitz.testnet', 'raka.buddiesblitz.testnet', 'optimistic');
    const hana = await fetchHanaTreasuryStatus('raka.buddiesblitz.testnet', 'optimistic');

    assert.equal(acct?.amount, '380000000000000000000000');
    assert.equal(resp, '100');
    assert.equal(hana.callerAlreadyClaimed, true);
    assert.equal(hana.verified, true);
    assert.deepEqual(recordedFinalities, [
      { requestType: 'view_account', methodName: undefined, finality: 'optimistic' },
      { requestType: 'call_function', methodName: 'ft_balance_of', finality: 'optimistic' },
      { requestType: 'call_function', methodName: 'get_hana_treasury_status', finality: 'optimistic' },
    ]);

    // RPC error returns verified: false so UI never falsely clears claimed state
    globalThis.fetch = (async () => ({ ok: false, status: 503 }) as Response) as typeof fetch;
    const failedHana = await fetchHanaTreasuryStatus('raka.buddiesblitz.testnet', 'optimistic');
    assert.equal(failedHana.verified, false);
    assert.equal(failedHana.callerAlreadyClaimed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolveTutorialFurnitureTarget computes live minimum price and exact NEAR top-up so buy_furniture never traps players', () => {
  // Reproduces live production state: Chabudai Low Tea Table stock=4, demand=1 -> 11 RESPITE
  const state = createInitialMerchantMarketState();
  state.stockByItemId = {
    ...state.stockByItemId,
    tatami_tea_table: 4,
    sakura_bonsai_pot: 5,
  };
  state.demandByItemId = {
    ...state.demandByItemId,
    tatami_tea_table: 1,
    sakura_bonsai_pot: 2,
  };

  // Case (a): Player has 8 RESPITE -> short 3 RESPITE -> 0.01 NEAR (+4 RESPITE -> 12 RESPITE)
  const at8 = resolveTutorialFurnitureTarget(state, 8, RESPITE_NEP141_METADATA.rateRespitePerNear);
  assert.ok(at8);
  assert.equal(at8.item.id, 'tatami_tea_table');
  assert.equal(at8.buyPriceRespite, 11);
  assert.equal(at8.recommendedTopUpNear, 0.01);
  assert.equal(at8.recommendedTopUpRespite, 4);

  // Case (b): Player has 0 RESPITE -> short 11 RESPITE -> 0.03 NEAR (+12 RESPITE)
  const at0 = resolveTutorialFurnitureTarget(state, 0, RESPITE_NEP141_METADATA.rateRespitePerNear);
  assert.ok(at0);
  assert.equal(at0.recommendedTopUpNear, 0.03);
  assert.equal(at0.recommendedTopUpRespite, 12);

  // Case (c): Player already has >= 11 RESPITE -> top-up 0
  const at11 = resolveTutorialFurnitureTarget(state, 11, RESPITE_NEP141_METADATA.rateRespitePerNear);
  assert.ok(at11);
  assert.equal(at11.recommendedTopUpNear, 0);
  assert.equal(at11.recommendedTopUpRespite, 0);

  // Case (d): Cheapest item out of stock -> picks next cheapest in-stock furniture cleanly
  const outOfStock = createInitialMerchantMarketState();
  outOfStock.stockByItemId = {
    ...outOfStock.stockByItemId,
    tatami_tea_table: 0,
  };
  const nextCheapest = resolveTutorialFurnitureTarget(
    outOfStock,
    8,
    RESPITE_NEP141_METADATA.rateRespitePerNear,
  );
  assert.ok(nextCheapest);
  assert.notEqual(nextCheapest.item.id, 'tatami_tea_table');
  assert.ok(nextCheapest.stock > 0);
  assert.ok(nextCheapest.buyPriceRespite >= 10);
});

test('wallet MY ITEMS house formatting reflects chosen style and real deed token ID', () => {
  assert.equal(formatHouseDeedBadgeLabel('house-deed-0007'), 'DEED #007');
  assert.equal(formatHouseDeedBadgeLabel('house-deed-0001'), 'DEED #001');
  assert.equal(formatHouseDeedBadgeLabel(null), 'HOUSE DEED');

  const plaza = getHouseStyleDisplaySpec('plaza_manor');
  assert.equal(plaza.title, 'CLASSIC PLAZA MANOR');
  assert.equal(plaza.imageSrc, '/assets/kiosk/plaza_manor_exterior.jpg');

  const pavilion = getHouseStyleDisplaySpec('japanese_pavilion');
  assert.equal(pavilion.title, 'JAPANESE PAVILION HOUSE');
  assert.equal(pavilion.imageSrc, '/assets/kiosk/house_exterior.jpg');
});

test('wallet HISTORY formatting normalizes EXCHANGE label and real item/starter amounts', () => {
  assert.equal(formatWalletHistoryActionLabel('EXCHANGE_LUL_CYON'), 'EXCHANGE');
  assert.equal(formatWalletHistoryActionLabel('exchange'), 'EXCHANGE');
  assert.equal(formatWalletHistoryActionLabel('BUY_ITEM'), 'BUY ITEM');

  assert.deepEqual(
    formatWalletHistoryAmountDisplay({
      action_type: 'buy_item',
      item_id: 'tatami_tea_table',
      currency: 'RESPITE',
      amount: 1,
      unit_price: 11,
    }),
    { amountText: '11 RESPITE', badgeCurrency: 'RESPITE' }
  );

  assert.deepEqual(
    formatWalletHistoryAmountDisplay({
      action_type: 'buy_item',
      item_id: 'nep171_house_ownership_deed',
      currency: 'RESPITE',
      amount: 1,
      unit_price: 100,
    }),
    { amountText: '100 RESPITE', badgeCurrency: 'RESPITE' }
  );

  assert.deepEqual(
    formatWalletHistoryAmountDisplay({
      action_type: 'claim_starter_near',
      item_id: 'hana_welcome_near_0_30',
      currency: 'RESPITE',
      amount: 1,
      unit_price: 0,
    }),
    { amountText: '0.30 NEAR', badgeCurrency: 'NEAR' }
  );

  assert.deepEqual(
    formatWalletHistoryAmountDisplay({
      action_type: 'claim_starter_near',
      item_id: 'hana_welcome_near_0_30',
      currency: 'NEAR',
      amount: 0.3,
      unit_price: 1,
    }),
    { amountText: '0.30 NEAR', badgeCurrency: 'NEAR' }
  );

  assert.deepEqual(
    formatWalletHistoryAmountDisplay({
      action_type: 'sell_fish',
      item_id: 'fish_1',
      currency: 'LUL',
      amount: 25,
      unit_price: 25,
    }),
    { amountText: '25 LUL', badgeCurrency: 'LUL' }
  );

  assert.deepEqual(
    formatWalletHistoryAmountDisplay({
      action_type: 'exchange_lul_cyon',
      item_id: 'near_to_respite_0_03',
      currency: 'RESPITE',
      amount: 12,
      unit_price: 0.03,
    }),
    { amountText: '12 RESPITE', badgeCurrency: 'RESPITE' }
  );
});

test('mergeOwnedCatalogWithChainNep245 reconciles NEP-245 furniture while keeping non-NEP-245 items', () => {
  const merged = mergeOwnedCatalogWithChainNep245(
    ['nep171:house:ownership', 'fishing_rod_carbon_pro', 'sakura_bonsai_pot'],
    {
      'nep245:furniture:tatami_tea_table': 1,
      'nep245:theme:cyber_neon': 2,
    }
  );

  assert.equal(merged.includes('nep171:house:ownership'), true);
  assert.equal(merged.includes('fishing_rod_carbon_pro'), true);
  assert.equal(merged.includes('tatami_tea_table'), true);
  assert.equal(merged.includes('sakura_bonsai_pot'), false);
  assert.equal(merged.filter((id) => id === 'theme_cyber_neon').length, 2);

  // Null RPC response preserves existing local ownership list without dropping anything
  assert.deepEqual(
    mergeOwnedCatalogWithChainNep245(['sakura_bonsai_pot', 'fishing_rod_carbon_pro'], null),
    ['sakura_bonsai_pot', 'fishing_rod_carbon_pro']
  );
});

test('fetchOwnedNep245CatalogCounts queries mt_batch_balance_of and maps token counts', async () => {
  const originalFetch = globalThis.fetch;
  let capturedMethod = '';
  let capturedFinality = '';
  let capturedTokenIds: string[] = [];

  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    const parsed = JSON.parse(String(init?.body ?? '{}'));
    capturedMethod = parsed.params?.method_name ?? '';
    capturedFinality = parsed.params?.finality ?? '';
    const decodedArgs = JSON.parse(
      Buffer.from(String(parsed.params?.args_base64 ?? ''), 'base64').toString('utf8')
    );
    capturedTokenIds = decodedArgs.token_ids ?? [];
    const counts = capturedTokenIds.map((id) =>
      id === 'nep245:furniture:tatami_tea_table' ? '1' : '0'
    );
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        result: {
          result: Array.from(Buffer.from(JSON.stringify(counts), 'utf8')),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const counts = await fetchOwnedNep245CatalogCounts(
      '0xzet5.buddiesblitz.testnet',
      ['nep245:furniture:tatami_tea_table', 'nep245:furniture:sakura_bonsai_pot'],
      'optimistic'
    );
    assert.equal(capturedMethod, 'mt_batch_balance_of');
    assert.equal(capturedFinality, 'optimistic');
    assert.deepEqual(capturedTokenIds, [
      'nep245:furniture:tatami_tea_table',
      'nep245:furniture:sakura_bonsai_pot',
    ]);
    assert.deepEqual(counts, {
      'nep245:furniture:tatami_tea_table': 1,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
