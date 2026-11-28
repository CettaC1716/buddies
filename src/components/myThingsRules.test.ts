import test from 'node:test';
import assert from 'node:assert/strict';
import { FASHION_APPAREL_CATALOG_ITEMS } from '../game/buddiesFashionKioskRules';
import { URBAN_SCOOTER_CATALOG_ITEMS } from '../game/buddiesUrbanScooterRules';
import {
  DEFAULT_COLLECTIBLE_BADGE_IDS,
  MY_THINGS_SECTIONS,
  WALLET_TABS,
  buildProfileAssetTiles,
  countCollectibleBadges,
  partitionMyThingsInventory,
  sanitizeOwnedItemLabel,
  shouldShowProfileAssetTiles,
} from './myThingsRules';

test('My Things defines the four required ownership sections in order', () => {
  assert.deepEqual(
    MY_THINGS_SECTIONS.map((s) => s.label),
    ['Items', 'Vehicles', 'Properties', 'Collectibles'],
  );
  assert.deepEqual(
    MY_THINGS_SECTIONS.map((s) => s.id),
    ['items', 'vehicles', 'properties', 'collectibles'],
  );
});

test('Wallet tabs contain wallet, exchange, and history (no assets tab)', () => {
  assert.deepEqual([...WALLET_TABS], ['wallet', 'exchange', 'history']);
});

test('sanitizeOwnedItemLabel strips NFT and NEP token jargon cleanly', () => {
  assert.equal(
    sanitizeOwnedItemLabel('Cyber Neon Shinjuku Theme NFT'),
    'Cyber Neon Shinjuku Theme',
  );
  assert.equal(
    sanitizeOwnedItemLabel('Poseidon Golden Kraken Rod NFT'),
    'Poseidon Golden Kraken Rod',
  );
  assert.equal(
    sanitizeOwnedItemLabel('Shogun Katana Credenza (NEP-245)'),
    'Shogun Katana Credenza',
  );
  assert.equal(sanitizeOwnedItemLabel('Chabudai Low Tea Table'), 'Chabudai Low Tea Table');
});

test('partitionMyThingsInventory groups existing inventory into Items, Vehicles, Properties, and Collectibles', () => {
  const sampleApparelId = FASHION_APPAREL_CATALOG_ITEMS[0].id;
  const sampleScooterId = URBAN_SCOOTER_CATALOG_ITEMS[0].id;
  const result = partitionMyThingsInventory({
    ownedMerchantItemIds: [
      'tatami_tea_table',
      'tatami_tea_table',
      'theme_cyber_neon',
      'nft_golden_poseidon_rod',
    ],
    ownedApparelIds: [sampleApparelId],
    ownedScooterIds: [sampleScooterId],
    hasHouseOwnership: true,
    caughtFishCount: 3,
    listedFishCount: 1,
    recruitedCompanionsCount: 2,
    characterGender: 'female',
  });

  // Items: 1 starter Fishing Rod + 1 fishing gear + 1 clothing item
  assert.equal(result.ownedFishingGear.length, 1);
  assert.equal(result.ownedFishingGear[0]?.id, 'nft_golden_poseidon_rod');
  assert.equal(result.ownedClothing.length, 1);
  assert.equal(result.sectionCounts.items, 3);

  // Vehicles: 1 owned scooter
  assert.equal(result.ownedVehicles.length, 1);
  assert.equal(result.ownedVehicles[0]?.id, sampleScooterId);
  assert.equal(result.sectionCounts.vehicles, 1);

  // Properties: 1 house + 2 tatami_tea_table + 1 theme_cyber_neon = 4
  assert.equal(result.ownedPropertyItems.length, 2);
  assert.equal(result.sectionCounts.properties, 4);

  // Collectibles: 3 caught fish + 1 listed fish + 2 companions = 6
  assert.equal(result.sectionCounts.collectibles, 6);
  assert.equal(result.totalCount, 14);
});

test('buildProfileAssetTiles derives the 6 profile tiles from My Things ownership data', () => {
  const sampleApparelId = FASHION_APPAREL_CATALOG_ITEMS[0].id;
  const sampleScooterId = URBAN_SCOOTER_CATALOG_ITEMS[0].id;

  const tiles = buildProfileAssetTiles({
    ownedMerchantItemIds: [
      'tatami_tea_table',
      'tatami_tea_table',
      'sakura_bonsai_pot',
      'theme_cyber_neon',
      'nft_golden_poseidon_rod',
    ],
    ownedApparelIds: [sampleApparelId],
    ownedScooterIds: [sampleScooterId],
    hasHouseOwnership: true,
    caughtFishCount: 4,
    listedFishCount: 2,
    characterGender: 'male',
  });

  assert.deepEqual(
    tiles.map((t) => ({ id: t.id, label: t.label, count: t.count })),
    [
      { id: 'homes', label: 'Homes', count: 1 },
      { id: 'clothes', label: 'Clothes', count: 1 },
      { id: 'vehicles', label: 'Vehicles', count: 1 },
      { id: 'furniture', label: 'Furniture', count: 3 },
      { id: 'fish', label: 'Fish', count: 6 },
      { id: 'badges', label: 'Badges', count: DEFAULT_COLLECTIBLE_BADGE_IDS.length },
    ],
  );
});

test('countCollectibleBadges counts default collectible badges plus unique event-earned badges', () => {
  assert.equal(countCollectibleBadges(), DEFAULT_COLLECTIBLE_BADGE_IDS.length);
  assert.equal(
    countCollectibleBadges(['smile', 'summer_fest_2026', 'summer_fest_2026', '   ']),
    DEFAULT_COLLECTIBLE_BADGE_IDS.length + 1,
  );
});

test('shouldShowProfileAssetTiles respects the Show my things on my profile privacy toggle', () => {
  assert.equal(
    shouldShowProfileAssetTiles({ isSelfProfile: true, showThingsOnProfile: true }),
    true,
  );
  assert.equal(
    shouldShowProfileAssetTiles({ isSelfProfile: true, showThingsOnProfile: false }),
    false,
  );
  assert.equal(
    shouldShowProfileAssetTiles({ isSelfProfile: false, showThingsOnProfile: true }),
    false,
  );
});
