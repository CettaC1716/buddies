use near_sdk::store::{LookupMap, UnorderedMap};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault};

/// NEP-171 Fish NFT Metadata & On-Chain State (`market.buddiesblitz.testnet`)
/// Note: LUL and CYON are strictly OFF-CHAIN social currencies to prevent bot farming.
/// Only RESPITE, Rare Fish NFTs, and Citizen Deeds (House / Family Member) live on-chain.
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct FishNftToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub species_id: String,
    pub species_name: String,
    pub water_zone: String,
    pub rarity: String,
    pub weight_kg_x100: u32,
    pub caught_by: AccountId,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct FishMarketListing {
    pub listing_id: String,
    pub token_id: String,
    pub seller_id: AccountId,
    pub species_id: String,
    pub species_name: String,
    pub rarity: String,
    pub weight_kg_x100: u32,
    pub price_respite: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct BuddiesMarketContract {
    pub master_account: AccountId,
    pub respite_balances: LookupMap<AccountId, u64>,
    pub fish_nfts: LookupMap<String, FishNftToken>,
    pub market_listings: UnorderedMap<String, FishMarketListing>,
    pub house_owners: LookupMap<AccountId, bool>,
}

#[near]
impl BuddiesMarketContract {
    #[init]
    pub fn init(master_account: AccountId) -> Self {
        Self {
            master_account,
            respite_balances: LookupMap::new(b"r"),
            fish_nfts: LookupMap::new(b"n"),
            market_listings: UnorderedMap::new(b"m"),
            house_owners: LookupMap::new(b"h"),
        }
    }

    /// 1. Swap NEAR Testnet -> RESPITE (1 NEAR = 100 RESPITE)
    #[payable]
    pub fn swap_near_for_respite(&mut self) -> u64 {
        let caller = env::predecessor_account_id();
        let attached: NearToken = env::attached_deposit();
        let yocto = attached.as_yoctonear();
        require!(yocto >= 10_000_000_000_000_000_000_000, "Minimum swap is 0.01 NEAR");

        // 1 NEAR (10^24 yocto) = 100 RESPITE -> 10^22 yocto per 1 RESPITE
        let added_respite = (yocto / 10_000_000_000_000_000_000_000) as u64;
        let current = *self.respite_balances.get(&caller).unwrap_or(&0);
        let updated = current + added_respite;
        self.respite_balances.insert(caller.clone(), updated);

        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep141\",\"version\":\"1.0.0\",\"event\":\"ft_mint\",\"data\":[{{\"owner_id\":\"{}\",\"amount\":\"{}\"}}]}} ",
            caller, added_respite
        ));
        updated
    }

    /// 2. Mint a caught fish into an On-Chain NEP-171 Fish NFT
    pub fn mint_fish_nft(
        &mut self,
        token_id: String,
        species_id: String,
        species_name: String,
        water_zone: String,
        rarity: String,
        weight_kg_x100: u32,
    ) -> FishNftToken {
        let caller = env::predecessor_account_id();
        require!(!self.fish_nfts.contains_key(&token_id), "Fish NFT already minted");

        let nft = FishNftToken {
            token_id: token_id.clone(),
            owner_id: caller.clone(),
            species_id,
            species_name,
            water_zone,
            rarity,
            weight_kg_x100,
            caught_by: caller.clone(),
        };
        self.fish_nfts.insert(token_id.clone(), nft.clone());

        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.0.0\",\"event\":\"nft_mint\",\"data\":[{{\"owner_id\":\"{}\",\"token_ids\":[\"{}\"]}}]}}",
            caller, token_id
        ));
        nft
    }

    /// 3. List a minted Fish NFT on the P2P Marketplace for RESPITE
    pub fn list_fish_nft(
        &mut self,
        listing_id: String,
        token_id: String,
        price_respite: u64,
    ) -> FishMarketListing {
        let caller = env::predecessor_account_id();
        require!(price_respite >= 1, "Minimum listing price is 1 RESPITE");
        let nft = self
            .fish_nfts
            .get(&token_id)
            .expect("Fish NFT not found")
            .clone();
        require!(nft.owner_id == caller, "Only the NFT owner can list this fish");

        let listing = FishMarketListing {
            listing_id: listing_id.clone(),
            token_id,
            seller_id: caller,
            species_id: nft.species_id,
            species_name: nft.species_name,
            rarity: nft.rarity,
            weight_kg_x100: nft.weight_kg_x100,
            price_respite,
        };
        self.market_listings.insert(listing_id, listing.clone());
        listing
    }

    /// 4. Buy a listed Fish NFT from another player using RESPITE (or unlist your own)
    pub fn buy_fish_nft(&mut self, listing_id: String) -> FishNftToken {
        let buyer = env::predecessor_account_id();
        let listing = self
            .market_listings
            .remove(&listing_id)
            .expect("Listing not found");

        if listing.seller_id != buyer {
            let buyer_respite = *self.respite_balances.get(&buyer).unwrap_or(&0);
            require!(
                buyer_respite >= listing.price_respite,
                "Insufficient RESPITE balance"
            );
            let seller_respite = *self.respite_balances.get(&listing.seller_id).unwrap_or(&0);

            self.respite_balances
                .insert(buyer.clone(), buyer_respite - listing.price_respite);
            self.respite_balances
                .insert(listing.seller_id.clone(), seller_respite + listing.price_respite);
        }

        let mut nft = self
            .fish_nfts
            .get(&listing.token_id)
            .expect("Fish NFT not found")
            .clone();
        nft.owner_id = buyer.clone();
        self.fish_nfts.insert(listing.token_id.clone(), nft.clone());

        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.0.0\",\"event\":\"nft_transfer\",\"data\":[{{\"authorized_id\":\"market.buddiesblitz.testnet\",\"old_owner_id\":\"{}\",\"new_owner_id\":\"{}\",\"token_ids\":[\"{}\"]}}]}}",
            listing.seller_id, buyer, listing.token_id
        ));
        nft
    }

    /// 5. Purchase Private House Ownership or Family Member Contract using RESPITE
    pub fn purchase_citizen_asset(&mut self, asset_id: String, price_respite: u64) -> bool {
        let caller = env::predecessor_account_id();
        let current = *self.respite_balances.get(&caller).unwrap_or(&0);
        require!(current >= price_respite, "Insufficient RESPITE balance");
        self.respite_balances.insert(caller.clone(), current - price_respite);
        if asset_id == "house_ownership" {
            self.house_owners.insert(caller, true);
        }
        true
    }

    /// View: Get player's on-chain RESPITE balance and House Ownership status
    pub fn get_citizen_account(&self, account_id: AccountId) -> (u64, bool) {
        let respite = *self.respite_balances.get(&account_id).unwrap_or(&0);
        let owns_house = *self.house_owners.get(&account_id).unwrap_or(&false);
        (respite, owns_house)
    }

    /// View: Get all active P2P Fish NFT listings on the Marketplace
    pub fn get_fish_listings(&self) -> Vec<FishMarketListing> {
        self.market_listings.values().cloned().collect()
    }
}
