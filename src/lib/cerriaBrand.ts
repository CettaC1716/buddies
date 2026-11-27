/**
 * Cerria — Single Source of Truth for Brand Copy, Visual Style Constants,
 * Shared Time Units, and Load-Bearing Machine Invariants.
 *
 * Player-facing copy is kept simple, everyday English with no crypto jargon
 * and no emojis. Load-bearing identifiers ("nama penopang") are documented
 * and exported verbatim so tests can guard them against accidental renames.
 */

export const CERRIA_APP_NAME = 'Cerria' as const;
export const CERRIA_CITY_NAME = 'Cerria' as const;

export const CERRIA_OFFICIAL_TICKER =
  'EXPLORE THE CITY • MEET THE COMMUNITY • VISIT HOMES • OPEN A SHOP' as const;

export const CERRIA_OFFICIAL_DESCRIPTION =
  "Cerria is a cel-shaded 3D social city on NEAR Protocol. Explore the city, meet the community, visit friends' homes, go fishing at the shore, and open your own shop." as const;

/** Canonical cel/toon black ink outline color used across the 3D city. */
export const CERRIA_OUTLINE_HEX = '#12121e' as const;
export const CERRIA_OUTLINE_COLOR = 0x12121e as const;

/** Canonical milliseconds in one 24-hour day (single definition shared by game engines). */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Load-bearing CustomEvent names (DO NOT CHANGE). */
export const OPEN_LOT_RENTAL_EVENT = 'open-lot-rental' as const;

/**
 * Load-bearing machine identifiers read by smart contracts, Supabase tables,
 * localStorage persistence, asset loaders, or cross-module CustomEvents.
 * Never rename or alter these values during UI rebrands or code cleanup.
 */
export const CERRIA_LOAD_BEARING_INVARIANTS = {
  customEvents: {
    shopLotPlacementSync: 'shop-lot-placement-state-sync',
    openLotRental: OPEN_LOT_RENTAL_EVENT,
  },
  storageKeys: {
    lotRentals: 'bb_lot_rentals_v1',
    ownedScooters: 'bb_owned_scooters_v1',
    walletPinHash: 'bb_wallet_pin_hash_v1',
    hanaTourWelcomed: 'bb_hana_tour_welcomed_v1',
  },
  supabaseTables: {
    houseInteriors: 'bb_house_interiors',
    houseInteriorsFurnitureColumn: 'placed_furniture',
    profiles: 'bb_profiles',
    profileContacts: 'bb_profile_contacts',
  },
  nearAccounts: {
    marketContract: 'market.buddiesblitz.testnet',
    masterAccount: 'buddiesblitz-master.testnet',
  },
  shopFormIds: [
    'glass_corner_3story',
    'canopy_storefront_2story',
    'brick_rooftop_deck',
  ] as const,
  shopCatalogItemIds: [
    'shop_glass_corner_3story',
    'shop_canopy_storefront_2story',
    'shop_brick_rooftop_deck',
  ] as const,
  houseStyleId: 'glass_modern' as const,
} as const;
