use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    assert_one_yocto, env, near, require, serde_json::json, AccountId, NearToken, PanicOnDefault,
    Promise,
};

/// Fixed on-chain economy constants (`1 NEAR = 400 RESPITE` -> `2.5 * 10^21 yoctoNEAR` per `1 RESPITE`,
/// i.e. `0.25 NEAR = 100 RESPITE`).
/// Note: LUL and CYON are strictly OFF-CHAIN social currencies to isolate the economy from bot farming.
pub const YOCTO_PER_RESPITE: u128 = 2_500_000_000_000_000_000_000;
pub const HOUSE_OWNERSHIP_PRICE_RESPITE: u128 = 100;
pub const FAMILY_PLAN_1_WEEK_PRICE_RESPITE: u128 = 15;
pub const FAMILY_PLAN_1_MONTH_PRICE_RESPITE: u128 = 45;
pub const FAMILY_PLAN_1_YEAR_PRICE_RESPITE: u128 = 180;
pub const MIN_STORAGE_DEPOSIT_YOCTO: u128 = 1_250_000_000_000_000_000_000; // 0.00125 NEAR
pub const HANA_WELCOME_GRANT_YOCTO: u128 = 300_000_000_000_000_000_000_000; // 0.30 NEAR starter grant
pub const TREASURY_STORAGE_SAFETY_BUFFER_YOCTO: u128 = 100_000_000_000_000_000_000_000; // 0.10 NEAR buffer

const RESPITE_SVG_DATA_URI: &str = "data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%230f172a%22/><circle cx=%2232%22 cy=%2232%22 r=%2224%22 fill=%22%23d8b4fe%22 stroke=%22%23b8ff3c%22 stroke-width=%224%22/><text x=%2232%22 y=%2240%22 font-family=%22Arial,sans-serif%22 font-weight=%22900%22 font-size=%2224%22 text-anchor=%22middle%22 fill=%22%230f172a%22>R</text></svg>";

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FungibleTokenMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
    pub decimals: u8,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StorageBalance {
    pub total: U128,
    pub available: U128,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NFTContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub copies: Option<u64>,
    pub extra: Option<String>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NftToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: Option<TokenMetadata>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FishNftToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub species_id: String,
    pub species_name: String,
    pub water_zone: String,
    pub rarity: String,
    pub weight_kg_x100: u32,
    pub caught_by: AccountId,
    pub minted_at_ms: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FishMarketListing {
    pub listing_id: String,
    pub token_id: String,
    pub seller_id: AccountId,
    pub species_id: String,
    pub species_name: String,
    pub water_zone: String,
    pub rarity: String,
    pub weight_kg_x100: u32,
    pub price_respite: U128,
    pub listed_at_ms: u64,
}

/// A property-market listing whose asset is HELD BY THE CONTRACT while
/// listed (true escrow). Deeds move their NFT ownership to the contract
/// account and stash the owner-index record (`house_deeds` is keyed by
/// owner and can hold only one deed per account, so it cannot point at
/// the contract for several escrowed deeds at once) inside the listing;
/// furniture moves its NEP-245 balance to the contract account. Buying
/// settles payment and delivery in this single call — no two-step trust.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PropertyListing {
    pub listing_id: String,
    pub seller_id: AccountId,
    /// "deed" (NEP-171 house deed) or "furniture" (NEP-245 catalog item).
    pub asset_kind: String,
    pub token_id: String,
    /// Copies escrowed: always 1 for deeds, the listed amount for furniture.
    pub amount: U128,
    pub price_respite: U128,
    pub listed_at_ms: u64,
    /// The escrowed deed's owner-index record (deed listings only).
    pub deed: Option<OnChainHouseDeed>,
}

/// Track `nfts` (`NFTs That Do Something`): Each Deed/Estate NFT maps to its own sub-account ledger,
/// holds `RESPITE` revenue, tracks payout history, and rotates `key_epoch` + `active_session_key`
/// atomically on transfer so the previous owner immediately loses sub-account authorization.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SubAccountTransferRecord {
    pub from_owner: AccountId,
    pub to_owner: AccountId,
    pub transferred_treasury_respite: U128,
    pub new_key_epoch: u64,
    pub timestamp_ms: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NftSubAccountLedger {
    pub token_id: String,
    pub owner_id: AccountId,
    pub sub_account_id: String,
    pub treasury_respite: U128,
    pub pending_payout_respite: U128,
    pub total_earned_respite: U128,
    pub total_paid_out_respite: U128,
    pub key_epoch: u64,
    pub active_session_key: String,
    pub ownership_history: Vec<SubAccountTransferRecord>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OnChainHouseDeed {
    pub owner_id: AccountId,
    pub deed_token_id: String,
    pub sub_account_id: String,
    pub purchased_at_ms: u64,
    pub price_paid_respite: U128,
    pub key_epoch: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OnChainFamilyMemberContract {
    pub contract_id: String,
    pub owner_id: AccountId,
    pub member_number: u32,
    pub plan_id: String,
    pub active_order: String,
    pub hired_at_ms: u64,
    pub expires_at_ms: u64,
    pub price_paid_respite: U128,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CitizenEstateSummary {
    pub account_id: AccountId,
    pub respite_balance: U128,
    pub owns_house: bool,
    pub house_deed: Option<OnChainHouseDeed>,
    pub family_contracts: Vec<OnChainFamilyMemberContract>,
    pub fish_nft_count: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContractOverview {
    pub contract_version: String,
    pub master_account: AccountId,
    pub respite_per_near_rate: u64,
    pub house_price_respite: U128,
    pub total_respite_supply: U128,
    pub total_houses_minted: u64,
    pub total_family_contracts: u64,
    pub total_fish_nfts_minted: u64,
    pub active_fish_listings: u64,
    pub active_property_listings: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HanaTreasuryStatus {
    pub grant_amount_yocto: U128,
    pub liquid_treasury_yocto: U128,
    pub caller_already_claimed: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct BuddiesMarketContract {
    pub master_account: AccountId,
    pub total_respite_supply: u128,
    pub respite_balances: LookupMap<AccountId, u128>,
    pub storage_deposits: LookupMap<AccountId, u128>,
    pub nft_tokens_by_id: IterableMap<String, NftToken>,
    pub fish_nfts: LookupMap<String, FishNftToken>,
    pub market_listings: IterableMap<String, FishMarketListing>,
    pub active_listing_by_token: LookupMap<String, String>,
    pub nft_subaccount_ledgers: LookupMap<String, NftSubAccountLedger>,
    pub house_deeds: LookupMap<AccountId, OnChainHouseDeed>,
    pub family_contracts_by_owner: LookupMap<AccountId, Vec<OnChainFamilyMemberContract>>,
    pub mt_balances: LookupMap<String, u128>,
    pub total_houses_minted: u64,
    pub total_family_contracts: u64,
    pub total_fish_nfts_minted: u64,
    pub property_listings: IterableMap<String, PropertyListing>,
    pub total_property_listings: u64,
}

/// The v1.2.0 state layout, kept only so `migrate` can read it. Field
/// order and types must match the deployed v1.2.0 struct exactly.
#[near(serializers = [borsh])]
pub struct OldBuddiesMarketContract {
    pub master_account: AccountId,
    pub total_respite_supply: u128,
    pub respite_balances: LookupMap<AccountId, u128>,
    pub storage_deposits: LookupMap<AccountId, u128>,
    pub nft_tokens_by_id: IterableMap<String, NftToken>,
    pub fish_nfts: LookupMap<String, FishNftToken>,
    pub market_listings: IterableMap<String, FishMarketListing>,
    pub active_listing_by_token: LookupMap<String, String>,
    pub nft_subaccount_ledgers: LookupMap<String, NftSubAccountLedger>,
    pub house_deeds: LookupMap<AccountId, OnChainHouseDeed>,
    pub family_contracts_by_owner: LookupMap<AccountId, Vec<OnChainFamilyMemberContract>>,
    pub mt_balances: LookupMap<String, u128>,
    pub total_houses_minted: u64,
    pub total_family_contracts: u64,
    pub total_fish_nfts_minted: u64,
}

#[near]
impl BuddiesMarketContract {
    #[init]
    pub fn init(master_account: AccountId) -> Self {
        let mut respite_balances = LookupMap::new(b"r");
        let initial_treasury: u128 = 50_000;
        respite_balances.insert(master_account.clone(), initial_treasury);

        let mut storage_deposits = LookupMap::new(b"s");
        storage_deposits.insert(master_account.clone(), MIN_STORAGE_DEPOSIT_YOCTO);

        Self {
            master_account,
            total_respite_supply: initial_treasury,
            respite_balances,
            storage_deposits,
            nft_tokens_by_id: IterableMap::new(b"t"),
            fish_nfts: LookupMap::new(b"f"),
            market_listings: IterableMap::new(b"m"),
            active_listing_by_token: LookupMap::new(b"l"),
            nft_subaccount_ledgers: LookupMap::new(b"d"),
            house_deeds: LookupMap::new(b"h"),
            family_contracts_by_owner: LookupMap::new(b"c"),
            mt_balances: LookupMap::new(b"b"),
            total_houses_minted: 0,
            total_family_contracts: 0,
            total_fish_nfts_minted: 0,
            property_listings: IterableMap::new(b"p"),
            total_property_listings: 0,
        }
    }

    /// One-time state migration v1.2.0 -> v1.3.0: carries every existing
    /// field across untouched and starts the property-escrow state empty.
    /// Deploy the new code WITHOUT an init call, then call this once.
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        // Only the contract account itself may run the migration.
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Migration can only be called by the contract account"
        );
        let old: OldBuddiesMarketContract =
            env::state_read().expect("Cannot read the old contract state");
        Self {
            master_account: old.master_account,
            total_respite_supply: old.total_respite_supply,
            respite_balances: old.respite_balances,
            storage_deposits: old.storage_deposits,
            nft_tokens_by_id: old.nft_tokens_by_id,
            fish_nfts: old.fish_nfts,
            market_listings: old.market_listings,
            active_listing_by_token: old.active_listing_by_token,
            nft_subaccount_ledgers: old.nft_subaccount_ledgers,
            house_deeds: old.house_deeds,
            family_contracts_by_owner: old.family_contracts_by_owner,
            mt_balances: old.mt_balances,
            total_houses_minted: old.total_houses_minted,
            total_family_contracts: old.total_family_contracts,
            total_fish_nfts_minted: old.total_fish_nfts_minted,
            property_listings: IterableMap::new(b"p"),
            total_property_listings: 0,
        }
    }

    // =========================================================================
    // 1. NEP-141 FUNGIBLE TOKEN (`RESPITE`) & NEP-145 STORAGE MANAGEMENT
    // =========================================================================

    pub fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: "ft-1.0.0".to_string(),
            name: "Buddies Blitz Respite".to_string(),
            symbol: "RESPITE".to_string(),
            icon: Some(RESPITE_SVG_DATA_URI.to_string()),
            reference: None,
            reference_hash: None,
            decimals: 0,
        }
    }

    pub fn ft_total_supply(&self) -> U128 {
        U128(self.total_respite_supply)
    }

    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        U128(*self.respite_balances.get(&account_id).unwrap_or(&0))
    }

    #[payable]
    pub fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        let deposit = env::attached_deposit().as_yoctonear();
        let target = account_id.unwrap_or_else(env::predecessor_account_id);
        let existing = *self.storage_deposits.get(&target).unwrap_or(&0);

        if existing > 0 && registration_only.unwrap_or(false) {
            if deposit > 0 {
                let _ = Promise::new(env::predecessor_account_id())
                    .transfer(NearToken::from_yoctonear(deposit));
            }
            return StorageBalance {
                total: U128(existing),
                available: U128(0),
            };
        }

        require!(
            existing.saturating_add(deposit) >= MIN_STORAGE_DEPOSIT_YOCTO,
            "Minimum storage deposit is 0.00125 NEAR"
        );

        let accepted = if registration_only.unwrap_or(false) {
            let needed = MIN_STORAGE_DEPOSIT_YOCTO.saturating_sub(existing);
            let refund = deposit.saturating_sub(needed);
            if refund > 0 {
                let _ = Promise::new(env::predecessor_account_id())
                    .transfer(NearToken::from_yoctonear(refund));
            }
            MIN_STORAGE_DEPOSIT_YOCTO
        } else {
            existing.checked_add(deposit).expect("Storage deposit overflow")
        };

        self.storage_deposits.insert(target, accepted);
        StorageBalance {
            total: U128(accepted),
            available: U128(accepted.saturating_sub(MIN_STORAGE_DEPOSIT_YOCTO)),
        }
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.storage_deposits.get(&account_id).map(|bal| StorageBalance {
            total: U128(*bal),
            available: U128(bal.saturating_sub(MIN_STORAGE_DEPOSIT_YOCTO)),
        })
    }

    /// Standard NEP-141 `ft_transfer` enforcing `1 yoctoNEAR` security attachment.
    #[payable]
    pub fn ft_transfer(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        let sender_id = env::predecessor_account_id();
        require!(sender_id != receiver_id, "Sender and receiver must differ");
        require!(amount.0 > 0, "Transfer amount must be positive");

        self.internal_transfer_respite(&sender_id, &receiver_id, amount.0, memo);
    }

    /// Swap native NEAR -> RESPITE (`1 NEAR = 400 RESPITE`), refunding any fractional yoctoNEAR dust.
    #[payable]
    pub fn swap_near_for_respite(&mut self) -> U128 {
        let caller = env::predecessor_account_id();
        let attached: NearToken = env::attached_deposit();
        let yocto = attached.as_yoctonear();
        require!(yocto >= YOCTO_PER_RESPITE, "Minimum swap is 0.0025 NEAR (1 RESPITE)");

        let added_respite = yocto / YOCTO_PER_RESPITE;
        let dust_yocto = yocto % YOCTO_PER_RESPITE;

        let current = *self.respite_balances.get(&caller).unwrap_or(&0);
        let updated = current
            .checked_add(added_respite)
            .expect("RESPITE balance overflow");
        self.total_respite_supply = self
            .total_respite_supply
            .checked_add(added_respite)
            .expect("RESPITE supply overflow");

        self.respite_balances.insert(caller.clone(), updated);
        if !self.storage_deposits.contains_key(&caller) {
            self.storage_deposits
                .insert(caller.clone(), MIN_STORAGE_DEPOSIT_YOCTO);
        }

        if dust_yocto > 0 {
            let _ = Promise::new(caller.clone()).transfer(NearToken::from_yoctonear(dust_yocto));
        }

        Self::emit_nep_event(
            "nep141",
            "ft_mint",
            json!([{
                "owner_id": caller,
                "amount": added_respite.to_string(),
                "memo": "swap_near_for_respite"
            }]),
        );

        U128(updated)
    }

    /// Master treasury admin withdrawal so swapped NEAR liquidity is never permanently locked.
    pub fn withdraw_treasury_near(
        &mut self,
        amount_yocto: U128,
        receiver_id: Option<AccountId>,
    ) -> Promise {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.master_account,
            "Only master_account can withdraw treasury NEAR"
        );
        require!(amount_yocto.0 > 0, "Withdrawal amount must be positive");
        let target = receiver_id.unwrap_or(caller);
        Promise::new(target).transfer(NearToken::from_yoctonear(amount_yocto.0))
    }

    // =========================================================================
    // 2. NEP-171 / NEP-177 / NEP-181 NFTs & SUB-ACCOUNT DEED LEDGER (`nfts`)
    // =========================================================================

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: "nft-1.0.0".to_string(),
            name: "Buddies Blitz Citizen & Fish NFTs".to_string(),
            symbol: "BBFISH".to_string(),
            icon: Some(RESPITE_SVG_DATA_URI.to_string()),
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    pub fn nft_token(&self, token_id: String) -> Option<NftToken> {
        self.nft_tokens_by_id.get(&token_id).cloned()
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.nft_tokens_by_id.len() as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<NftToken> {
        let start = from_index.map(|v| v.0 as usize).unwrap_or(0);
        let max = limit.unwrap_or(50).min(100) as usize;
        self.nft_tokens_by_id
            .values()
            .skip(start)
            .take(max)
            .cloned()
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        let count = self
            .nft_tokens_by_id
            .values()
            .filter(|tok| tok.owner_id == account_id)
            .count();
        U128(count as u128)
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<NftToken> {
        let start = from_index.map(|v| v.0 as usize).unwrap_or(0);
        let max = limit.unwrap_or(50).min(100) as usize;
        self.nft_tokens_by_id
            .values()
            .filter(|tok| tok.owner_id == account_id)
            .skip(start)
            .take(max)
            .cloned()
            .collect()
    }

    /// Standard NEP-171 `nft_transfer` (`1 yoctoNEAR` required).
    /// When transferring an Estate / House Deed NFT, control of its tied sub-account ledger,
    /// accumulated treasury, and pending payouts moves atomically while rotating `key_epoch`
    /// so the previous owner's FunctionCall session key is immediately invalidated.
    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        #[allow(unused_variables)] approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        let sender = env::predecessor_account_id();
        require!(sender != receiver_id, "Cannot transfer NFT to self");
        require!(
            !self.active_listing_by_token.contains_key(&token_id),
            "Unlist NFT from marketplace before direct transfer"
        );

        let token = self
            .nft_tokens_by_id
            .get(&token_id)
            .expect("NFT token not found")
            .clone();
        require!(token.owner_id == sender, "Only the current NFT owner can transfer");

        self.internal_transfer_nft_ownership(&token_id, &sender, &receiver_id, memo);
    }

    /// Bind or rotate a FunctionCall session public key for an NFT's sub-account (`10-nfts.md`).
    pub fn authorize_deed_session_key(&mut self, token_id: String, session_public_key: String) -> u64 {
        let caller = env::predecessor_account_id();
        require!(!session_public_key.trim().is_empty(), "Session key required");
        let mut ledger = self
            .nft_subaccount_ledgers
            .get(&token_id)
            .expect("Sub-account ledger not found for token")
            .clone();
        require!(ledger.owner_id == caller, "Only current NFT holder controls its sub-account");
        ledger.active_session_key = session_public_key;
        let epoch = ledger.key_epoch;
        self.nft_subaccount_ledgers.insert(token_id, ledger);
        epoch
    }

    /// Deposit revenue/royalties into an NFT's tied sub-account treasury (`10-nfts.md`).
    pub fn fund_deed_royalty(&mut self, token_id: String, amount: U128) -> NftSubAccountLedger {
        let caller = env::predecessor_account_id();
        require!(amount.0 > 0, "Royalty amount must be positive");
        let caller_bal = *self.respite_balances.get(&caller).unwrap_or(&0);
        require!(caller_bal >= amount.0, "Insufficient RESPITE to fund deed treasury");

        let mut ledger = self
            .nft_subaccount_ledgers
            .get(&token_id)
            .expect("Sub-account ledger not found for token")
            .clone();

        self.respite_balances
            .insert(caller, caller_bal.checked_sub(amount.0).unwrap());

        ledger.treasury_respite = U128(
            ledger
                .treasury_respite
                .0
                .checked_add(amount.0)
                .expect("Treasury overflow"),
        );
        ledger.pending_payout_respite = U128(
            ledger
                .pending_payout_respite
                .0
                .checked_add(amount.0)
                .expect("Pending payout overflow"),
        );
        ledger.total_earned_respite = U128(
            ledger
                .total_earned_respite
                .0
                .checked_add(amount.0)
                .expect("Total earned overflow"),
        );

        self.nft_subaccount_ledgers.insert(token_id, ledger.clone());
        ledger
    }

    /// Claim pending payouts from an NFT's sub-account (`10-nfts.md`).
    /// Enforces BOTH current `owner_id` AND `expected_key_epoch` so a seller attempting to claim
    /// mid-transfer or with a stale key is strictly rejected.
    pub fn claim_deed_payout(&mut self, token_id: String, expected_key_epoch: u64) -> U128 {
        let caller = env::predecessor_account_id();
        let mut ledger = self
            .nft_subaccount_ledgers
            .get(&token_id)
            .expect("Sub-account ledger not found for token")
            .clone();

        require!(
            ledger.owner_id == caller,
            "Access denied: NFT ownership has moved to another account"
        );
        require!(
            ledger.key_epoch == expected_key_epoch,
            "Stale key_epoch: previous owner session access was revoked on transfer"
        );
        require!(ledger.pending_payout_respite.0 > 0, "No pending payout to claim");

        let payout = ledger.pending_payout_respite.0;
        ledger.pending_payout_respite = U128(0);
        ledger.treasury_respite = U128(ledger.treasury_respite.0.saturating_sub(payout));
        ledger.total_paid_out_respite = U128(
            ledger
                .total_paid_out_respite
                .0
                .checked_add(payout)
                .expect("Paid out overflow"),
        );

        let holder_bal = *self.respite_balances.get(&caller).unwrap_or(&0);
        self.respite_balances.insert(
            caller.clone(),
            holder_bal.checked_add(payout).expect("Holder balance overflow"),
        );

        self.nft_subaccount_ledgers.insert(token_id, ledger);
        U128(payout)
    }

    pub fn get_nft_ledger_history(&self, token_id: String) -> Option<NftSubAccountLedger> {
        self.nft_subaccount_ledgers.get(&token_id).cloned()
    }

    // =========================================================================
    // 3. FISH NFT MINTING & ANTI-DOUBLE-LISTING P2P MARKETPLACE
    // =========================================================================

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
        let clean_id = token_id.trim().to_string();
        require!(!clean_id.is_empty() && clean_id.len() <= 96, "Invalid token_id");
        require!(!self.nft_tokens_by_id.contains_key(&clean_id), "Fish NFT already minted");
        require!(
            weight_kg_x100 > 0 && weight_kg_x100 <= 50_000,
            "Fish weight out of valid bounds"
        );
        require!(
            matches!(
                rarity.as_str(),
                "Common" | "Uncommon" | "Rare" | "Epic" | "Mythic" | "Legendary"
            ),
            "Unsupported fish rarity tier"
        );

        let now_ms = env::block_timestamp_ms();
        let nft = FishNftToken {
            token_id: clean_id.clone(),
            owner_id: caller.clone(),
            species_id: species_id.clone(),
            species_name: species_name.clone(),
            water_zone: water_zone.clone(),
            rarity: rarity.clone(),
            weight_kg_x100,
            caught_by: caller.clone(),
            minted_at_ms: now_ms,
        };

        let weight_str = format!("{}.{:#02}", weight_kg_x100 / 100, weight_kg_x100 % 100);
        let nep171_token = NftToken {
            token_id: clean_id.clone(),
            owner_id: caller.clone(),
            metadata: Some(TokenMetadata {
                title: Some(format!("{} ({} kg - {})", species_name, weight_str, rarity)),
                description: Some(format!(
                    "Caught at {} in Buddies Blitz Safezone City. Tradable on Merchant Kai P2P Marketplace.",
                    water_zone
                )),
                media: None,
                copies: Some(1),
                extra: Some(
                    json!({
                        "kind": "fish",
                        "species_id": species_id,
                        "water_zone": water_zone,
                        "rarity": rarity,
                        "weight_kg_x100": weight_kg_x100
                    })
                    .to_string(),
                ),
            }),
        };

        self.fish_nfts.insert(clean_id.clone(), nft.clone());
        self.nft_tokens_by_id.insert(clean_id.clone(), nep171_token);
        self.total_fish_nfts_minted = self.total_fish_nfts_minted.saturating_add(1);

        Self::emit_nep_event(
            "nep171",
            "nft_mint",
            json!([{
                "owner_id": caller,
                "token_ids": [clean_id]
            }]),
        );
        nft
    }

    pub fn list_fish_nft(
        &mut self,
        listing_id: String,
        token_id: String,
        price_respite: U128,
    ) -> FishMarketListing {
        let caller = env::predecessor_account_id();
        require!(!listing_id.trim().is_empty(), "Invalid listing_id");
        require!(price_respite.0 >= 1, "Minimum listing price is 1 RESPITE");
        require!(
            !self.market_listings.contains_key(&listing_id),
            "Listing ID already exists"
        );
        require!(
            !self.active_listing_by_token.contains_key(&token_id),
            "Fish NFT already has an active marketplace listing"
        );

        let nft = self
            .fish_nfts
            .get(&token_id)
            .expect("Fish NFT not found")
            .clone();
        require!(nft.owner_id == caller, "Only the NFT owner can list this fish");

        let listing = FishMarketListing {
            listing_id: listing_id.clone(),
            token_id: token_id.clone(),
            seller_id: caller,
            species_id: nft.species_id,
            species_name: nft.species_name,
            water_zone: nft.water_zone,
            rarity: nft.rarity,
            weight_kg_x100: nft.weight_kg_x100,
            price_respite,
            listed_at_ms: env::block_timestamp_ms(),
        };

        self.active_listing_by_token
            .insert(token_id, listing_id.clone());
        self.market_listings.insert(listing_id, listing.clone());
        listing
    }

    pub fn unlist_fish_nft(&mut self, listing_id: String) -> bool {
        let caller = env::predecessor_account_id();
        let listing = self
            .market_listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();
        require!(
            listing.seller_id == caller,
            "Only the seller can cancel this listing"
        );

        self.market_listings.remove(&listing_id);
        self.active_listing_by_token.remove(&listing.token_id);
        true
    }

    pub fn buy_fish_nft(&mut self, listing_id: String) -> FishNftToken {
        let buyer = env::predecessor_account_id();
        let listing = self
            .market_listings
            .remove(&listing_id)
            .expect("Listing not found");
        self.active_listing_by_token.remove(&listing.token_id);

        let current_nft = self
            .fish_nfts
            .get(&listing.token_id)
            .expect("Fish NFT not found")
            .clone();
        require!(
            current_nft.owner_id == listing.seller_id,
            "Listing invalidated: seller no longer owns NFT"
        );

        if listing.seller_id != buyer {
            self.internal_transfer_respite(
                &buyer,
                &listing.seller_id,
                listing.price_respite.0,
                Some(format!("buy_fish_nft:{}", listing.token_id)),
            );
            self.internal_transfer_nft_ownership(
                &listing.token_id,
                &listing.seller_id,
                &buyer,
                Some(format!("market_listing:{}", listing_id)),
            );
        }

        self.fish_nfts
            .get(&listing.token_id)
            .expect("Fish NFT missing after transfer")
            .clone()
    }

    // =========================================================================
    // 4. FIXED-PRICE CITIZEN ASSETS (HOUSE DEED & FAMILY MEMBER AI CONTRACTS)
    // =========================================================================

    pub fn purchase_citizen_asset(
        &mut self,
        asset_id: String,
        plan_id: Option<String>,
        order_id: Option<String>,
    ) -> CitizenEstateSummary {
        let caller = env::predecessor_account_id();
        let now_ms = env::block_timestamp_ms();

        match asset_id.as_str() {
            "house_ownership" => {
                require!(
                    !self.house_deeds.contains_key(&caller),
                    "Citizen already owns a Private House Deed"
                );
                self.internal_transfer_respite(
                    &caller,
                    &self.master_account.clone(),
                    HOUSE_OWNERSHIP_PRICE_RESPITE,
                    Some("purchase:house_ownership".to_string()),
                );

                self.total_houses_minted = self.total_houses_minted.saturating_add(1);
                let deed_token_id = format!("house-deed-{:04}", self.total_houses_minted);
                let sub_account_id = format!(
                    "estate-{:04}.{}",
                    self.total_houses_minted, self.master_account
                );

                let deed = OnChainHouseDeed {
                    owner_id: caller.clone(),
                    deed_token_id: deed_token_id.clone(),
                    sub_account_id: sub_account_id.clone(),
                    purchased_at_ms: now_ms,
                    price_paid_respite: U128(HOUSE_OWNERSHIP_PRICE_RESPITE),
                    key_epoch: 1,
                };
                self.house_deeds.insert(caller.clone(), deed);

                let nep171_deed = NftToken {
                    token_id: deed_token_id.clone(),
                    owner_id: caller.clone(),
                    metadata: Some(TokenMetadata {
                        title: Some(format!(
                            "Safezone Citizen House Deed #{}",
                            self.total_houses_minted
                        )),
                        description: Some(format!(
                            "Controls sub-account {} and unlocks 3D cutaway house interior & NEP-245 furnishings.",
                            sub_account_id
                        )),
                        media: None,
                        copies: Some(1),
                        extra: Some(
                            json!({
                                "kind": "house_deed",
                                "sub_account_id": sub_account_id,
                                "key_epoch": 1
                            })
                            .to_string(),
                        ),
                    }),
                };
                self.nft_tokens_by_id
                    .insert(deed_token_id.clone(), nep171_deed);

                let ledger = NftSubAccountLedger {
                    token_id: deed_token_id.clone(),
                    owner_id: caller.clone(),
                    sub_account_id,
                    treasury_respite: U128(0),
                    pending_payout_respite: U128(0),
                    total_earned_respite: U128(0),
                    total_paid_out_respite: U128(0),
                    key_epoch: 1,
                    active_session_key: String::new(),
                    ownership_history: Vec::new(),
                };
                self.nft_subaccount_ledgers
                    .insert(deed_token_id.clone(), ledger);

                Self::emit_nep_event(
                    "nep171",
                    "nft_mint",
                    json!([{
                        "owner_id": caller,
                        "token_ids": [deed_token_id]
                    }]),
                );
            }
            "family_member" => {
                let resolved_plan = plan_id.unwrap_or_else(|| "1_month".to_string());
                let (price, duration_days): (u128, u64) = match resolved_plan.as_str() {
                    "1_week" => (FAMILY_PLAN_1_WEEK_PRICE_RESPITE, 7),
                    "1_month" => (FAMILY_PLAN_1_MONTH_PRICE_RESPITE, 30),
                    "1_year" => (FAMILY_PLAN_1_YEAR_PRICE_RESPITE, 365),
                    _ => env::panic_str("Unsupported family contract plan_id"),
                };

                let mut existing = self
                    .family_contracts_by_owner
                    .get(&caller)
                    .cloned()
                    .unwrap_or_default();
                require!(
                    existing.len() < 3,
                    "Maximum 3 active Family Member AI contracts per citizen"
                );

                self.internal_transfer_respite(
                    &caller,
                    &self.master_account.clone(),
                    price,
                    Some(format!("purchase:family_member:{}", resolved_plan)),
                );

                self.total_family_contracts = self.total_family_contracts.saturating_add(1);
                let member_number = (existing.len() as u32) + 1;
                let contract_id = format!(
                    "family-{}-{}.{}",
                    member_number, self.total_family_contracts, self.master_account
                );
                let duration_ms = duration_days * 86_400_000;

                existing.push(OnChainFamilyMemberContract {
                    contract_id,
                    owner_id: caller.clone(),
                    member_number,
                    plan_id: resolved_plan,
                    active_order: order_id.unwrap_or_else(|| "collect_boxes".to_string()),
                    hired_at_ms: now_ms,
                    expires_at_ms: now_ms.saturating_add(duration_ms),
                    price_paid_respite: U128(price),
                });
                self.family_contracts_by_owner.insert(caller.clone(), existing);
            }
            _ => env::panic_str("Unknown citizen asset_id"),
        }

        self.get_player_estate(caller)
    }

    // =========================================================================
    // 5. NEP-245 MULTI-TOKEN STANDARD FOR MERCHANT ITEMS (`09-games.md`)
    // =========================================================================

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        let key = Self::mt_key(&account_id, &token_id);
        U128(*self.mt_balances.get(&key).unwrap_or(&0))
    }

    pub fn mt_batch_balance_of(
        &self,
        account_id: AccountId,
        token_ids: Vec<String>,
    ) -> Vec<U128> {
        token_ids
            .into_iter()
            .map(|tid| self.mt_balance_of(account_id.clone(), tid))
            .collect()
    }

    pub fn mint_merchant_item(
        &mut self,
        receiver_id: Option<AccountId>,
        token_id: String,
        amount: U128,
    ) -> U128 {
        // Merchant items are pre-minted catalog stock: ONLY the merchant
        // (master_account) may mint. Players receive items by buying them
        // from that stock (`buy_merchant_item`) or by player-to-player
        // transfer — never by minting.
        require!(
            env::predecessor_account_id() == self.master_account,
            "Only the merchant (master_account) can mint merchant items"
        );
        let target = receiver_id.unwrap_or_else(env::predecessor_account_id);
        let clean_token = token_id.trim().to_string();
        require!(!clean_token.is_empty(), "Invalid NEP-245 token_id");
        require!(amount.0 > 0, "Amount must be positive");

        let key = Self::mt_key(&target, &clean_token);
        let next = self
            .mt_balances
            .get(&key)
            .unwrap_or(&0)
            .checked_add(amount.0)
            .expect("NEP-245 balance overflow");
        self.mt_balances.insert(key, next);

        Self::emit_nep_event(
            "nep245",
            "mt_mint",
            json!([{
                "owner_id": target,
                "token_ids": [clean_token],
                "amounts": [amount.0.to_string()]
            }]),
        );
        U128(next)
    }

    /// Catalog base prices (RESPITE) for merchant NEP-245 items, mirroring
    /// the client catalog. Returns `None` for token ids that are not
    /// merchant catalog items.
    fn merchant_item_base_price_respite(token_id: &str) -> Option<u128> {
        match token_id {
            "nep245:theme:japanese_zen" => Some(10),
            "nep245:theme:cyber_neon" => Some(15),
            "nep245:theme:royal_gold" => Some(25),
            "nep245:furniture:golden_katana_rack" => Some(12),
            "nep245:furniture:holo_command_globe" => Some(18),
            "nep245:furniture:tatami_tea_table" => Some(8),
            "nep245:furniture:sakura_bonsai_pot" => Some(10),
            "nep245:furniture:shoji_floor_lamp" => Some(12),
            "nep245:furniture:tactical_sofa_lounge" => Some(18),
            "nep245:furniture:arcade_blitz_cab" => Some(20),
            "nep245:fishing:golden_poseidon_rod" => Some(15),
            "nep245:fishing:sonar_fishfinder_pro" => Some(12),
            _ => None,
        }
    }

    /// Buy a merchant NEP-245 item from the merchant's pre-minted stock.
    /// Atomically moves `price_respite` RESPITE from the buyer to the
    /// merchant (master_account) and `amount` of the item from the
    /// merchant's stock to the buyer, who then holds it in their bag.
    ///
    /// The price is quoted by the client (dynamic stock/demand pricing,
    /// 0.55x-2.15x of base with an investor discount down to ~0.47x), so the
    /// contract enforces only a floor of 45% of the catalog base price: any
    /// quote a legitimate client can produce passes, while a forged client
    /// cannot name a near-zero price for real stock.
    pub fn buy_merchant_item(
        &mut self,
        token_id: String,
        amount: U128,
        price_respite: U128,
    ) -> U128 {
        let buyer = env::predecessor_account_id();
        let clean_token = token_id.trim().to_string();
        require!(amount.0 > 0, "Amount must be positive");
        require!(
            buyer != self.master_account,
            "The merchant cannot buy from its own stock"
        );
        let base = Self::merchant_item_base_price_respite(&clean_token)
            .expect("Unknown merchant item token_id");
        let floor_total = base * 45 / 100 * amount.0;
        require!(
            price_respite.0 >= floor_total,
            "Price below the catalog floor for this merchant item"
        );

        let stock_key = Self::mt_key(&self.master_account, &clean_token);
        let stock = *self.mt_balances.get(&stock_key).unwrap_or(&0);
        require!(
            stock >= amount.0,
            "Merchant stock is insufficient for this purchase"
        );

        // Charge the buyer (panics on insufficient RESPITE), then move the
        // item out of the merchant's stock into the buyer's bag.
        let merchant = self.master_account.clone();
        self.internal_transfer_respite(
            &buyer,
            &merchant,
            price_respite.0,
            Some("buy_merchant_item".to_string()),
        );
        self.mt_balances.insert(stock_key, stock - amount.0);
        let buyer_key = Self::mt_key(&buyer, &clean_token);
        let buyer_bal = *self.mt_balances.get(&buyer_key).unwrap_or(&0);
        let next = buyer_bal
            .checked_add(amount.0)
            .expect("NEP-245 balance overflow");
        self.mt_balances.insert(buyer_key, next);

        Self::emit_nep_event(
            "nep245",
            "mt_transfer",
            json!([{
                "old_owner_id": merchant,
                "new_owner_id": buyer,
                "token_ids": [clean_token],
                "amounts": [amount.0.to_string()],
                "memo": "buy_merchant_item"
            }]),
        );
        U128(next)
    }

    /// Sell a merchant NEP-245 item back to the merchant. Atomically moves
    /// `amount` of the item from the seller back into the merchant's stock
    /// and `price_respite` RESPITE from the merchant (master_account) to
    /// the seller: the buyback is a real on-chain payment, never a cache
    /// credit.
    ///
    /// The client quotes the buyback at a fixed 65% of the catalog base
    /// price, so the contract enforces that same figure as a ceiling: any
    /// quote a legitimate client can produce passes, while a forged client
    /// cannot drain the merchant by naming an inflated buyback price.
    pub fn sell_merchant_item(
        &mut self,
        token_id: String,
        amount: U128,
        price_respite: U128,
    ) -> U128 {
        let seller = env::predecessor_account_id();
        let clean_token = token_id.trim().to_string();
        require!(amount.0 > 0, "Amount must be positive");
        require!(
            seller != self.master_account,
            "The merchant cannot sell items to itself"
        );
        let base = Self::merchant_item_base_price_respite(&clean_token)
            .expect("Unknown merchant item token_id");
        let ceiling_total = base * 65 / 100 * amount.0;
        require!(price_respite.0 > 0, "Price must be positive");
        require!(
            price_respite.0 <= ceiling_total,
            "Price above the merchant buyback ceiling for this item"
        );

        let seller_key = Self::mt_key(&seller, &clean_token);
        let seller_bal = *self.mt_balances.get(&seller_key).unwrap_or(&0);
        require!(
            seller_bal >= amount.0,
            "Seller does not hold enough of this item"
        );

        // Pay the seller from the merchant's RESPITE (panics on
        // insufficient merchant balance), then restock the item.
        let merchant = self.master_account.clone();
        self.internal_transfer_respite(
            &merchant,
            &seller,
            price_respite.0,
            Some("sell_merchant_item".to_string()),
        );
        let remaining = seller_bal - amount.0;
        self.mt_balances.insert(seller_key, remaining);
        let stock_key = Self::mt_key(&merchant, &clean_token);
        let stock = *self.mt_balances.get(&stock_key).unwrap_or(&0);
        let next_stock = stock
            .checked_add(amount.0)
            .expect("NEP-245 balance overflow");
        self.mt_balances.insert(stock_key, next_stock);

        Self::emit_nep_event(
            "nep245",
            "mt_transfer",
            json!([{
                "old_owner_id": seller,
                "new_owner_id": merchant,
                "token_ids": [clean_token],
                "amounts": [amount.0.to_string()],
                "memo": "sell_merchant_item"
            }]),
        );
        U128(remaining)
    }

    #[payable]
    pub fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
        #[allow(unused_variables)] approval: Option<(AccountId, u64)>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        let sender = env::predecessor_account_id();
        require!(sender != receiver_id, "Cannot transfer NEP-245 item to self");
        require!(amount.0 > 0, "Transfer amount must be positive");

        let sender_key = Self::mt_key(&sender, &token_id);
        let sender_bal = *self.mt_balances.get(&sender_key).unwrap_or(&0);
        require!(sender_bal >= amount.0, "Insufficient NEP-245 item balance");

        let receiver_key = Self::mt_key(&receiver_id, &token_id);
        let receiver_bal = *self.mt_balances.get(&receiver_key).unwrap_or(&0);

        self.mt_balances
            .insert(sender_key, sender_bal.checked_sub(amount.0).unwrap());
        self.mt_balances.insert(
            receiver_key,
            receiver_bal
                .checked_add(amount.0)
                .expect("NEP-245 receiver overflow"),
        );

        Self::emit_nep_event(
            "nep245",
            "mt_transfer",
            json!([{
                "old_owner_id": sender,
                "new_owner_id": receiver_id,
                "token_ids": [token_id],
                "amounts": [amount.0.to_string()],
                "memo": memo
            }]),
        );
    }

    // =========================================================================
    // 5b. PROPERTY MARKET ESCROW (deeds & furniture, atomic settlement)
    // =========================================================================

    /// Rotates a deed's sub-account ledger to a new owner (epoch + 1,
    /// session key cleared, history appended) and returns the new epoch.
    /// Mirrors the ledger half of `internal_transfer_nft_ownership`; the
    /// caller handles the NFT owner and the owner-keyed `house_deeds`
    /// record, which escrow cannot route through the generic helper (it
    /// would collide several escrowed deeds under the contract account).
    fn internal_rotate_deed_ledger(
        &mut self,
        token_id: &str,
        old_owner: &AccountId,
        new_owner: &AccountId,
    ) -> u64 {
        let mut ledger = self
            .nft_subaccount_ledgers
            .get(token_id)
            .expect("Sub-account ledger not found for token")
            .clone();
        let next_epoch = ledger.key_epoch.saturating_add(1);
        let carried_treasury = ledger.treasury_respite;
        ledger.ownership_history.push(SubAccountTransferRecord {
            from_owner: old_owner.clone(),
            to_owner: new_owner.clone(),
            transferred_treasury_respite: carried_treasury,
            new_key_epoch: next_epoch,
            timestamp_ms: env::block_timestamp_ms(),
        });
        ledger.owner_id = new_owner.clone();
        ledger.key_epoch = next_epoch;
        ledger.active_session_key.clear();
        self.nft_subaccount_ledgers
            .insert(token_id.to_string(), ledger);
        next_epoch
    }

    /// Points an NFT (deed) at a new owner and emits the NEP-171 event.
    fn internal_set_nft_owner(
        &mut self,
        token_id: &str,
        old_owner: &AccountId,
        new_owner: &AccountId,
        memo: &str,
    ) {
        let mut token = self
            .nft_tokens_by_id
            .get(token_id)
            .expect("NFT token not found")
            .clone();
        token.owner_id = new_owner.clone();
        self.nft_tokens_by_id.insert(token_id.to_string(), token);
        Self::emit_nep_event(
            "nep171",
            "nft_transfer",
            json!([{
                "old_owner_id": old_owner,
                "new_owner_id": new_owner,
                "token_ids": [token_id],
                "memo": memo
            }]),
        );
    }

    /// Moves an NEP-245 balance between two accounts (escrow legs).
    fn internal_move_mt(
        &mut self,
        from: &AccountId,
        to: &AccountId,
        token_id: &str,
        amount: u128,
        memo: &str,
    ) {
        let from_key = Self::mt_key(from, token_id);
        let from_bal = *self.mt_balances.get(&from_key).unwrap_or(&0);
        require!(from_bal >= amount, "Insufficient NEP-245 item balance");
        let to_key = Self::mt_key(to, token_id);
        let to_bal = *self.mt_balances.get(&to_key).unwrap_or(&0);
        self.mt_balances
            .insert(from_key, from_bal.checked_sub(amount).unwrap());
        self.mt_balances.insert(
            to_key,
            to_bal.checked_add(amount).expect("NEP-245 receiver overflow"),
        );
        Self::emit_nep_event(
            "nep245",
            "mt_transfer",
            json!([{
                "old_owner_id": from,
                "new_owner_id": to,
                "token_ids": [token_id],
                "amounts": [amount.to_string()],
                "memo": memo
            }]),
        );
    }

    /// Lists a house deed for sale, escrowing the deed NFT with the
    /// contract until it sells or the listing is cancelled.
    pub fn list_property_deed(
        &mut self,
        token_id: String,
        price_respite: U128,
    ) -> PropertyListing {
        let seller = env::predecessor_account_id();
        require!(price_respite.0 >= 1, "Minimum listing price is 1 RESPITE");
        let token = self
            .nft_tokens_by_id
            .get(&token_id)
            .expect("NFT token not found")
            .clone();
        require!(token.owner_id == seller, "Only the deed owner can list it");
        require!(
            self.nft_subaccount_ledgers.contains_key(&token_id),
            "Token is not a house deed"
        );
        // The owner-keyed deed record moves into the listing itself; the
        // contract account can escrow many deeds without index collisions.
        let mut deed = self
            .house_deeds
            .remove(&seller)
            .expect("House deed record not found for seller");
        if deed.deed_token_id != token_id {
            self.house_deeds.insert(seller.clone(), deed);
            env::panic_str("House deed record does not match the listed token");
        }
        let contract_account = env::current_account_id();
        let epoch =
            self.internal_rotate_deed_ledger(&token_id, &seller, &contract_account);
        deed.key_epoch = epoch;
        self.internal_set_nft_owner(
            &token_id,
            &seller,
            &contract_account,
            "list_property_deed",
        );
        self.total_property_listings = self.total_property_listings.saturating_add(1);
        let listing = PropertyListing {
            listing_id: format!("property-{}", self.total_property_listings),
            seller_id: seller,
            asset_kind: "deed".to_string(),
            token_id,
            amount: U128(1),
            price_respite,
            listed_at_ms: env::block_timestamp_ms(),
            deed: Some(deed),
        };
        self.property_listings
            .insert(listing.listing_id.clone(), listing.clone());
        listing
    }

    /// Lists furniture copies for sale, escrowing the NEP-245 balance
    /// with the contract until they sell or the listing is cancelled.
    pub fn list_property_furniture(
        &mut self,
        token_id: String,
        amount: U128,
        price_respite: U128,
    ) -> PropertyListing {
        let seller = env::predecessor_account_id();
        require!(price_respite.0 >= 1, "Minimum listing price is 1 RESPITE");
        require!(amount.0 >= 1, "Listing amount must be positive");
        require!(
            token_id.starts_with("nep245:"),
            "Furniture listings use NEP-245 catalog token ids"
        );
        let contract_account = env::current_account_id();
        self.internal_move_mt(
            &seller,
            &contract_account,
            &token_id,
            amount.0,
            "list_property_furniture",
        );
        self.total_property_listings = self.total_property_listings.saturating_add(1);
        let listing = PropertyListing {
            listing_id: format!("property-{}", self.total_property_listings),
            seller_id: seller,
            asset_kind: "furniture".to_string(),
            token_id,
            amount,
            price_respite,
            listed_at_ms: env::block_timestamp_ms(),
            deed: None,
        };
        self.property_listings
            .insert(listing.listing_id.clone(), listing.clone());
        listing
    }

    /// Buys an escrowed property listing: the buyer's RESPITE moves to
    /// the seller and the escrowed asset moves to the buyer in this one
    /// call. Any failed check reverts the whole transaction, so neither
    /// side can end up paid-but-undelivered or delivered-but-unpaid.
    pub fn buy_property(&mut self, listing_id: String) -> PropertyListing {
        let buyer = env::predecessor_account_id();
        let listing = self
            .property_listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();
        require!(buyer != listing.seller_id, "Seller cannot buy their own listing");
        if listing.asset_kind == "deed" {
            require!(listing.deed.is_some(), "Listing is missing its escrowed deed");
            if let Some(existing) = self.house_deeds.get(&buyer) {
                require!(
                    existing.deed_token_id == listing.token_id,
                    "Buyer already holds another house deed"
                );
            }
        }
        let contract_account = env::current_account_id();
        self.internal_transfer_respite(
            &buyer,
            &listing.seller_id,
            listing.price_respite.0,
            Some(format!("buy_property:{}", listing_id)),
        );
        if listing.asset_kind == "deed" {
            let epoch = self.internal_rotate_deed_ledger(
                &listing.token_id,
                &contract_account,
                &buyer,
            );
            self.internal_set_nft_owner(
                &listing.token_id,
                &contract_account,
                &buyer,
                "buy_property",
            );
            let mut deed = listing.deed.clone().expect("Escrowed deed checked above");
            deed.owner_id = buyer.clone();
            deed.key_epoch = epoch;
            self.house_deeds.insert(buyer, deed);
        } else {
            self.internal_move_mt(
                &contract_account,
                &buyer,
                &listing.token_id,
                listing.amount.0,
                "buy_property",
            );
        }
        self.property_listings.remove(&listing_id);
        listing
    }

    /// Cancels a listing and returns the escrowed asset to the seller.
    pub fn cancel_property_listing(&mut self, listing_id: String) -> PropertyListing {
        let caller = env::predecessor_account_id();
        let listing = self
            .property_listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();
        require!(
            listing.seller_id == caller,
            "Only the seller can cancel this listing"
        );
        let contract_account = env::current_account_id();
        if listing.asset_kind == "deed" {
            require!(listing.deed.is_some(), "Listing is missing its escrowed deed");
            if let Some(existing) = self.house_deeds.get(&caller) {
                require!(
                    existing.deed_token_id == listing.token_id,
                    "Seller already holds another house deed"
                );
            }
            let epoch = self.internal_rotate_deed_ledger(
                &listing.token_id,
                &contract_account,
                &caller,
            );
            self.internal_set_nft_owner(
                &listing.token_id,
                &contract_account,
                &caller,
                "cancel_property_listing",
            );
            let mut deed = listing.deed.clone().expect("Escrowed deed checked above");
            deed.owner_id = caller.clone();
            deed.key_epoch = epoch;
            self.house_deeds.insert(caller, deed);
        } else {
            self.internal_move_mt(
                &contract_account,
                &caller,
                &listing.token_id,
                listing.amount.0,
                "cancel_property_listing",
            );
        }
        self.property_listings.remove(&listing_id);
        listing
    }

    // =========================================================================
    // 6. VIEW METHODS FOR FRONTEND & INDEXERS
    // =========================================================================

    pub fn get_contract_overview(&self) -> ContractOverview {
        ContractOverview {
            contract_version: "1.3.0".to_string(),
            master_account: self.master_account.clone(),
            respite_per_near_rate: (1_000_000_000_000_000_000_000_000 / YOCTO_PER_RESPITE) as u64,
            house_price_respite: U128(HOUSE_OWNERSHIP_PRICE_RESPITE),
            total_respite_supply: U128(self.total_respite_supply),
            total_houses_minted: self.total_houses_minted,
            total_family_contracts: self.total_family_contracts,
            total_fish_nfts_minted: self.total_fish_nfts_minted,
            active_fish_listings: self.market_listings.len() as u64,
            active_property_listings: self.property_listings.len() as u64,
        }
    }

    pub fn get_citizen_account(&self, account_id: AccountId) -> (U128, bool) {
        let respite = *self.respite_balances.get(&account_id).unwrap_or(&0);
        let owns_house = self.house_deeds.contains_key(&account_id);
        (U128(respite), owns_house)
    }

    pub fn get_player_estate(&self, account_id: AccountId) -> CitizenEstateSummary {
        let respite = *self.respite_balances.get(&account_id).unwrap_or(&0);
        let house_deed = self.house_deeds.get(&account_id).cloned();
        let family_contracts = self
            .family_contracts_by_owner
            .get(&account_id)
            .cloned()
            .unwrap_or_default();
        let fish_nft_count = self
            .nft_tokens_by_id
            .values()
            .filter(|t| t.owner_id == account_id && self.fish_nfts.contains_key(&t.token_id))
            .count() as u32;

        CitizenEstateSummary {
            account_id,
            respite_balance: U128(respite),
            owns_house: house_deed.is_some(),
            house_deed,
            family_contracts,
            fish_nft_count,
        }
    }

    pub fn get_fish_listings(&self) -> Vec<FishMarketListing> {
        self.market_listings.values().cloned().collect()
    }

    pub fn get_property_listings(&self) -> Vec<PropertyListing> {
        self.property_listings.values().cloned().collect()
    }

    pub fn get_property_listing(&self, listing_id: String) -> Option<PropertyListing> {
        self.property_listings.get(&listing_id).cloned()
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    fn mt_key(account_id: &AccountId, token_id: &str) -> String {
        format!("{}::{}", account_id, token_id)
    }

    fn internal_transfer_respite(
        &mut self,
        sender_id: &AccountId,
        receiver_id: &AccountId,
        amount: u128,
        memo: Option<String>,
    ) {
        let sender_bal = *self.respite_balances.get(sender_id).unwrap_or(&0);
        require!(sender_bal >= amount, "Insufficient RESPITE balance");

        let receiver_bal = *self.respite_balances.get(receiver_id).unwrap_or(&0);
        let next_sender = sender_bal.checked_sub(amount).unwrap();
        let next_receiver = receiver_bal
            .checked_add(amount)
            .expect("Receiver RESPITE balance overflow");

        self.respite_balances.insert(sender_id.clone(), next_sender);
        self.respite_balances
            .insert(receiver_id.clone(), next_receiver);

        Self::emit_nep_event(
            "nep141",
            "ft_transfer",
            json!([{
                "old_owner_id": sender_id,
                "new_owner_id": receiver_id,
                "amount": amount.to_string(),
                "memo": memo
            }]),
        );
    }

    fn internal_transfer_nft_ownership(
        &mut self,
        token_id: &str,
        old_owner: &AccountId,
        new_owner: &AccountId,
        memo: Option<String>,
    ) {
        let mut nep_token = self
            .nft_tokens_by_id
            .get(token_id)
            .expect("NFT token missing")
            .clone();
        nep_token.owner_id = new_owner.clone();
        self.nft_tokens_by_id
            .insert(token_id.to_string(), nep_token);

        if let Some(fish) = self.fish_nfts.get(token_id).cloned() {
            let mut updated_fish = fish;
            updated_fish.owner_id = new_owner.clone();
            self.fish_nfts.insert(token_id.to_string(), updated_fish);
        }

        // If this NFT controls a Sub-Account Ledger (House Deed / Estate), atomically rotate
        // key_epoch, clear the seller's FunctionCall session key, and move house deed ownership.
        if let Some(mut ledger) = self.nft_subaccount_ledgers.get(token_id).cloned() {
            let next_epoch = ledger.key_epoch.saturating_add(1);
            let carried_treasury = ledger.treasury_respite;
            ledger.ownership_history.push(SubAccountTransferRecord {
                from_owner: old_owner.clone(),
                to_owner: new_owner.clone(),
                transferred_treasury_respite: carried_treasury,
                new_key_epoch: next_epoch,
                timestamp_ms: env::block_timestamp_ms(),
            });
            ledger.owner_id = new_owner.clone();
            ledger.key_epoch = next_epoch;
            ledger.active_session_key.clear();
            self.nft_subaccount_ledgers
                .insert(token_id.to_string(), ledger);

            if let Some(mut deed) = self.house_deeds.remove(old_owner) {
                if deed.deed_token_id == token_id {
                    deed.owner_id = new_owner.clone();
                    deed.key_epoch = next_epoch;
                    self.house_deeds.insert(new_owner.clone(), deed);
                } else {
                    self.house_deeds.insert(old_owner.clone(), deed);
                }
            }
        }

        Self::emit_nep_event(
            "nep171",
            "nft_transfer",
            json!([{
                "old_owner_id": old_owner,
                "new_owner_id": new_owner,
                "token_ids": [token_id],
                "memo": memo
            }]),
        );
    }

    // =========================================================================
    // 6. HANA SMART CONTRACT TREASURY (`claim_hana_welcome_near`)
    // =========================================================================

    fn hana_welcome_storage_key(account_id: &AccountId) -> Vec<u8> {
        let mut key = b"hw:".to_vec();
        key.extend_from_slice(account_id.as_bytes());
        key
    }

    fn compute_liquid_treasury_yocto(&self) -> u128 {
        let required_storage_yocto = (env::storage_usage() as u128)
            .saturating_mul(env::storage_byte_cost().as_yoctonear())
            .saturating_add(TREASURY_STORAGE_SAFETY_BUFFER_YOCTO);
        env::account_balance()
            .as_yoctonear()
            .saturating_sub(required_storage_yocto)
    }

    pub fn has_claimed_hana_welcome(&self, account_id: AccountId) -> bool {
        env::storage_has_key(&Self::hana_welcome_storage_key(&account_id))
    }

    pub fn get_hana_treasury_status(&self, account_id: Option<AccountId>) -> HanaTreasuryStatus {
        let claimed = account_id
            .as_ref()
            .map(|id| env::storage_has_key(&Self::hana_welcome_storage_key(id)))
            .unwrap_or(false);
        HanaTreasuryStatus {
            grant_amount_yocto: U128(HANA_WELCOME_GRANT_YOCTO),
            liquid_treasury_yocto: U128(self.compute_liquid_treasury_yocto()),
            caller_already_claimed: claimed,
        }
    }

    /// Allows Master/Developer treasury to top up Hana's on-chain NEAR starter grant pool.
    #[payable]
    pub fn fund_hana_welcome_treasury(&mut self) -> U128 {
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit > 0, "Attach NEAR to fund Hana's welcome treasury");
        let funder = env::predecessor_account_id();
        let liquid = self.compute_liquid_treasury_yocto();
        Self::emit_nep_event(
            "buddies_hana_treasury",
            "treasury_funded",
            json!([{
                "funder_id": funder,
                "deposit_yocto": deposit.to_string(),
                "liquid_treasury_yocto": liquid.to_string()
            }]),
        );
        U128(liquid)
    }

    /// One-time onboarding grant distributed directly from Hana's smart contract treasury
    /// (`0.30 NEAR`) after a new citizen finishes Hana's Central Plaza Cafe tutorial chat.
    pub fn claim_hana_welcome_near(&mut self) -> Promise {
        let caller = env::predecessor_account_id();
        let key = Self::hana_welcome_storage_key(&caller);
        require!(
            !env::storage_has_key(&key),
            "Citizen has already claimed Hana's welcome NEAR grant"
        );

        // Record claim before checking storage usage so its trie cost is accounted for
        env::storage_write(&key, &[1u8]);
        if !self.storage_deposits.contains_key(&caller) {
            self.storage_deposits
                .insert(caller.clone(), MIN_STORAGE_DEPOSIT_YOCTO);
        }

        let liquid = self.compute_liquid_treasury_yocto();
        require!(
            liquid >= HANA_WELCOME_GRANT_YOCTO,
            "Hana smart contract treasury has insufficient liquid NEAR"
        );

        Self::emit_nep_event(
            "buddies_hana_treasury",
            "welcome_near_claimed",
            json!([{
                "citizen_id": caller,
                "amount_yocto": HANA_WELCOME_GRANT_YOCTO.to_string(),
                "amount_near": "0.30"
            }]),
        );

        Promise::new(caller).transfer(NearToken::from_yoctonear(HANA_WELCOME_GRANT_YOCTO))
    }

    fn emit_nep_event(standard: &str, event: &str, data: near_sdk::serde_json::Value) {
        let payload = json!({
            "standard": standard,
            "version": "1.0.0",
            "event": event,
            "data": data
        });
        env::log_str(&format!("EVENT_JSON:{}", payload));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn acct(name: &str) -> AccountId {
        name.parse().unwrap()
    }

    fn set_ctx(predecessor: &str, deposit_yocto: u128) {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(acct(predecessor))
            .attached_deposit(NearToken::from_yoctonear(deposit_yocto))
            .block_timestamp(1_762_800_000_000_000_000);
        testing_env!(builder.build());
    }

    #[test]
    fn test_swap_and_nep141_ft_transfer_with_one_yocto() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        // Alice swaps 1 NEAR -> 400 RESPITE
        set_ctx("alice.buddiesblitz.testnet", 1_000_000_000_000_000_000_000_000);
        let bal = contract.swap_near_for_respite();
        assert_eq!(bal.0, 400);
        assert_eq!(
            contract.ft_balance_of(acct("alice.buddiesblitz.testnet")).0,
            400
        );

        // Alice transfers 35 RESPITE to Bob with 1 yoctoNEAR attached
        set_ctx("alice.buddiesblitz.testnet", 1);
        contract.ft_transfer(
            acct("bob.buddiesblitz.testnet"),
            U128(35),
            Some("squad split".to_string()),
        );
        assert_eq!(
            contract.ft_balance_of(acct("alice.buddiesblitz.testnet")).0,
            365
        );
        assert_eq!(
            contract.ft_balance_of(acct("bob.buddiesblitz.testnet")).0,
            35
        );
    }

    #[test]
    #[should_panic(expected = "Fish NFT already has an active marketplace listing")]
    fn test_prevents_double_listing_fish_nft_exploit() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        set_ctx("angler.testnet", 0);
        contract.mint_fish_nft(
            "fish-arowana-01".to_string(),
            "celestial_arowana".to_string(),
            "Celestial Arowana".to_string(),
            "Central Oasis Lake".to_string(),
            "Mythic".to_string(),
            1845,
        );

        contract.list_fish_nft(
            "listing-1".to_string(),
            "fish-arowana-01".to_string(),
            U128(40),
        );
        // Second listing on same token must panic
        contract.list_fish_nft(
            "listing-2".to_string(),
            "fish-arowana-01".to_string(),
            U128(40),
        );
    }

    #[test]
    fn test_p2p_fish_marketplace_atomic_buy() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        set_ctx("seller.testnet", 0);
        contract.mint_fish_nft(
            "fish-hammerhead-77".to_string(),
            "golden_hammerhead".to_string(),
            "Golden Hammerhead".to_string(),
            "East Beach Shoreline".to_string(),
            "Rare".to_string(),
            920,
        );
        contract.list_fish_nft(
            "list-77".to_string(),
            "fish-hammerhead-77".to_string(),
            U128(30),
        );

        set_ctx("buyer.testnet", 500_000_000_000_000_000_000_000); // 0.5 NEAR = 200 RESPITE
        contract.swap_near_for_respite();

        set_ctx("buyer.testnet", 0);
        let bought = contract.buy_fish_nft("list-77".to_string());
        assert_eq!(bought.owner_id, acct("buyer.testnet"));
        assert_eq!(contract.ft_balance_of(acct("buyer.testnet")).0, 170);
        assert_eq!(contract.ft_balance_of(acct("seller.testnet")).0, 30);
        assert_eq!(contract.get_fish_listings().len(), 0);
    }

    #[test]
    fn test_estate_nft_transfer_mid_payout_revokes_seller_access() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        // Seller swaps 1 NEAR -> 400 RESPITE and buys House Deed (fixed 100 RESPITE)
        set_ctx("seller.testnet", 1_000_000_000_000_000_000_000_000);
        contract.swap_near_for_respite();

        set_ctx("seller.testnet", 0);
        let estate = contract.purchase_citizen_asset("house_ownership".to_string(), None, None);
        assert!(estate.owns_house);
        assert_eq!(estate.respite_balance.0, 300);
        let deed_id = estate.house_deed.unwrap().deed_token_id;

        // Seller binds session key at epoch 1
        let seller_epoch = contract.authorize_deed_session_key(
            deed_id.clone(),
            "ed25519:SellerSessionKey111".to_string(),
        );
        assert_eq!(seller_epoch, 1);

        // Master treasury funds 40 RESPITE royalty into the NFT's sub-account (unclaimed payout!)
        set_ctx("buddiesblitz.testnet", 0);
        let funded = contract.fund_deed_royalty(deed_id.clone(), U128(40));
        assert_eq!(funded.pending_payout_respite.0, 40);

        // Seller transfers the Deed NFT to Buyer IN THE MIDDLE OF THE UNCLAIMED PAYOUT
        set_ctx("seller.testnet", 1);
        contract.nft_transfer(
            acct("buyer.testnet"),
            deed_id.clone(),
            None,
            Some("sale mid-payout".to_string()),
        );

        // Verify ownership, house deed, key_epoch=2, and cleared session key
        let history = contract.get_nft_ledger_history(deed_id.clone()).unwrap();
        assert_eq!(history.owner_id, acct("buyer.testnet"));
        assert_eq!(history.key_epoch, 2);
        assert_eq!(history.active_session_key, "");
        assert_eq!(history.ownership_history.len(), 1);
        assert!(!contract.get_player_estate(acct("seller.testnet")).owns_house);
        assert!(contract.get_player_estate(acct("buyer.testnet")).owns_house);

        // Buyer claims the 40 RESPITE pending payout using new epoch 2
        set_ctx("buyer.testnet", 0);
        let claimed = contract.claim_deed_payout(deed_id, 2);
        assert_eq!(claimed.0, 40);
        assert_eq!(contract.ft_balance_of(acct("buyer.testnet")).0, 40);
    }

    #[test]
    #[should_panic(expected = "Access denied: NFT ownership has moved to another account")]
    fn test_seller_cannot_claim_payout_after_deed_transfer() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        set_ctx("seller.testnet", 1_000_000_000_000_000_000_000_000);
        contract.swap_near_for_respite();
        set_ctx("seller.testnet", 0);
        let deed_id = contract
            .purchase_citizen_asset("house_ownership".to_string(), None, None)
            .house_deed
            .unwrap()
            .deed_token_id;

        set_ctx("buddiesblitz.testnet", 0);
        contract.fund_deed_royalty(deed_id.clone(), U128(20));

        set_ctx("seller.testnet", 1);
        contract.nft_transfer(acct("buyer.testnet"), deed_id.clone(), None, None);

        // Seller tries to steal the 20 RESPITE payout after selling the NFT -> MUST PANIC
        set_ctx("seller.testnet", 0);
        contract.claim_deed_payout(deed_id, 1);
    }

    #[test]
    fn test_nep245_multi_token_mint_and_transfer() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        // Only the merchant (master) mints; here it stocks Alice directly
        contract.mint_merchant_item(
            Some(acct("alice.testnet")),
            "furniture:sakura_bonsai_pot".to_string(),
            U128(3),
        );
        assert_eq!(
            contract
                .mt_balance_of(
                    acct("alice.testnet"),
                    "furniture:sakura_bonsai_pot".to_string()
                )
                .0,
            3
        );

        set_ctx("alice.testnet", 1);
        contract.mt_transfer(
            acct("bob.testnet"),
            "furniture:sakura_bonsai_pot".to_string(),
            U128(1),
            None,
            None,
        );
        let batch = contract.mt_batch_balance_of(
            acct("alice.testnet"),
            vec![
                "furniture:sakura_bonsai_pot".to_string(),
                "furniture:unknown".to_string(),
            ],
        );
        assert_eq!(batch, vec![U128(2), U128(0)]);
    }

    #[test]
    #[should_panic(expected = "Only the merchant (master_account) can mint merchant items")]
    fn test_mint_merchant_item_rejects_non_master() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        set_ctx("alice.testnet", 0);
        contract.mint_merchant_item(
            None,
            "nep245:furniture:golden_katana_rack".to_string(),
            U128(1),
        );
    }

    #[test]
    fn test_buy_merchant_item_moves_stock_and_respite() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        // Merchant pre-mints its catalog stock (katana rack, base 12 RESPITE)
        contract.mint_merchant_item(
            None,
            "nep245:furniture:golden_katana_rack".to_string(),
            U128(3),
        );
        assert_eq!(
            contract
                .mt_balance_of(
                    acct("buddiesblitz.testnet"),
                    "nep245:furniture:golden_katana_rack".to_string()
                )
                .0,
            3
        );

        // Alice swaps 0.1 NEAR -> 40 RESPITE at the 400-per-NEAR rate
        set_ctx("alice.testnet", 100_000_000_000_000_000_000_000);
        let bal = contract.swap_near_for_respite();
        assert_eq!(bal.0, 40);

        set_ctx("alice.testnet", 0);
        let owned = contract.buy_merchant_item(
            "nep245:furniture:golden_katana_rack".to_string(),
            U128(1),
            U128(12),
        );
        assert_eq!(owned.0, 1);
        assert_eq!(
            contract
                .mt_balance_of(
                    acct("alice.testnet"),
                    "nep245:furniture:golden_katana_rack".to_string()
                )
                .0,
            1
        );
        assert_eq!(
            contract
                .mt_balance_of(
                    acct("buddiesblitz.testnet"),
                    "nep245:furniture:golden_katana_rack".to_string()
                )
                .0,
            2
        );
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 28);
        assert_eq!(contract.ft_balance_of(acct("buddiesblitz.testnet")).0, 50_012);
    }

    #[test]
    #[test]
    fn test_sell_merchant_item_roundtrip_restock_and_payment() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        // Merchant stocks 10 tatami tea tables (base 8, buyback ceiling 5)
        contract.mint_merchant_item(
            None,
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(10),
        );

        // Alice swaps 0.1 NEAR -> 40 RESPITE, buys one table at 8
        set_ctx("alice.testnet", 100_000_000_000_000_000_000_000);
        let bal = contract.swap_near_for_respite();
        assert_eq!(bal.0, 40);
        set_ctx("alice.testnet", 0);
        contract.buy_merchant_item(
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
            U128(8),
        );
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 32);

        // She sells it back at the fixed buyback rate (65% of base 8 = 5)
        let remaining = contract.sell_merchant_item(
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
            U128(5),
        );
        assert_eq!(remaining.0, 0);
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 37);
        assert_eq!(
            contract
                .mt_balance_of(
                    acct("alice.testnet"),
                    "nep245:furniture:tatami_tea_table".to_string()
                )
                .0,
            0
        );
        // The item restocked with the merchant, who kept the 8 - 5 spread
        assert_eq!(
            contract
                .mt_balance_of(
                    acct("buddiesblitz.testnet"),
                    "nep245:furniture:tatami_tea_table".to_string()
                )
                .0,
            10
        );
        assert_eq!(contract.ft_balance_of(acct("buddiesblitz.testnet")).0, 50_003);
    }

    #[test]
    #[should_panic(expected = "Price above the merchant buyback ceiling for this item")]
    fn test_sell_merchant_item_rejects_above_ceiling() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        contract.mint_merchant_item(
            None,
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
        );
        set_ctx("alice.testnet", 100_000_000_000_000_000_000_000);
        contract.swap_near_for_respite();
        set_ctx("alice.testnet", 0);
        contract.buy_merchant_item(
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
            U128(8),
        );
        // Ceiling for tatami is floor(8 * 65 / 100) = 5; 6 must revert
        contract.sell_merchant_item(
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
            U128(6),
        );
    }

    #[test]
    #[should_panic(expected = "Seller does not hold enough of this item")]
    fn test_sell_merchant_item_rejects_unheld_item() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        set_ctx("alice.testnet", 0);
        contract.sell_merchant_item(
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
            U128(5),
        );
    }

    #[test]
    #[should_panic(expected = "Unknown merchant item token_id")]
    fn test_sell_merchant_item_rejects_unknown_token() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        set_ctx("alice.testnet", 0);
        contract.sell_merchant_item(
            "nep245:furniture:does_not_exist".to_string(),
            U128(1),
            U128(1),
        );
    }

    #[test]
    #[should_panic(expected = "The merchant cannot sell items to itself")]
    fn test_sell_merchant_item_merchant_cannot_sell() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        contract.mint_merchant_item(
            None,
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
        );
        contract.sell_merchant_item(
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
            U128(5),
        );
    }

    fn test_buy_merchant_item_converted_furniture() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        // Tatami tea table: catalog base 8 RESPITE (floor 3), stock 2
        contract.mint_merchant_item(
            None,
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(2),
        );

        // Alice swaps 0.1 NEAR -> 40 RESPITE and buys one table at base price
        set_ctx("alice.testnet", 100_000_000_000_000_000_000_000);
        contract.swap_near_for_respite();
        set_ctx("alice.testnet", 0);
        let owned = contract.buy_merchant_item(
            "nep245:furniture:tatami_tea_table".to_string(),
            U128(1),
            U128(8),
        );
        assert_eq!(owned.0, 1);
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 32);
        assert_eq!(
            contract
                .mt_balance_of(
                    acct("buddiesblitz.testnet"),
                    "nep245:furniture:tatami_tea_table".to_string()
                )
                .0,
            1
        );
    }

    #[test]
    #[should_panic(expected = "Price below the catalog floor for this merchant item")]
    fn test_buy_merchant_item_rejects_below_floor_price() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        contract.mint_merchant_item(
            None,
            "nep245:furniture:golden_katana_rack".to_string(),
            U128(1),
        );

        set_ctx("alice.testnet", 100_000_000_000_000_000_000_000);
        contract.swap_near_for_respite();
        set_ctx("alice.testnet", 0);
        // Floor for a 12-RESPITE item is 5; naming 4 fails despite stock+funds
        contract.buy_merchant_item(
            "nep245:furniture:golden_katana_rack".to_string(),
            U128(1),
            U128(4),
        );
    }

    #[test]
    #[should_panic(expected = "Merchant stock is insufficient for this purchase")]
    fn test_buy_merchant_item_rejects_empty_stock() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        set_ctx("alice.testnet", 100_000_000_000_000_000_000_000);
        contract.swap_near_for_respite();
        set_ctx("alice.testnet", 0);
        contract.buy_merchant_item(
            "nep245:theme:japanese_zen".to_string(),
            U128(1),
            U128(10),
        );
    }

    #[test]
    #[should_panic(expected = "Unknown merchant item token_id")]
    fn test_buy_merchant_item_rejects_unknown_token() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        set_ctx("alice.testnet", 0);
        contract.buy_merchant_item(
            "nep245:furniture:does_not_exist".to_string(),
            U128(1),
            U128(10),
        );
    }

    #[test]
    fn test_hana_welcome_near_claim_once_per_citizen() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(acct("xyz.buddiesblitz.testnet"))
            .account_balance(NearToken::from_near(10))
            .attached_deposit(NearToken::from_yoctonear(0))
            .block_timestamp(1_762_800_000_000_000_000);
        testing_env!(builder.build());

        assert!(!contract.has_claimed_hana_welcome(acct("xyz.buddiesblitz.testnet")));
        let _ = contract.claim_hana_welcome_near();
        assert!(contract.has_claimed_hana_welcome(acct("xyz.buddiesblitz.testnet")));
        let status = contract.get_hana_treasury_status(Some(acct("xyz.buddiesblitz.testnet")));
        assert!(status.caller_already_claimed);
        assert_eq!(status.grant_amount_yocto.0, HANA_WELCOME_GRANT_YOCTO);
    }

    #[test]
    #[should_panic(expected = "Citizen has already claimed Hana's welcome NEAR grant")]
    fn test_hana_welcome_near_prevents_double_claim() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(acct("xyz.buddiesblitz.testnet"))
            .account_balance(NearToken::from_near(10))
            .attached_deposit(NearToken::from_yoctonear(0))
            .block_timestamp(1_762_800_000_000_000_000);
        testing_env!(builder.build());

        let _ = contract.claim_hana_welcome_near();
        let _ = contract.claim_hana_welcome_near();
    }

    // ---------------------------------------------------------------------
    // Property escrow (v1.3.0)
    // ---------------------------------------------------------------------

    fn give_respite(contract: &mut BuddiesMarketContract, who: &str, near: u128) {
        set_ctx(who, near * 1_000_000_000_000_000_000_000_000);
        contract.swap_near_for_respite();
    }

    fn buy_house(contract: &mut BuddiesMarketContract, who: &str) -> String {
        set_ctx(who, 0);
        let summary = contract.purchase_citizen_asset(
            "house_ownership".to_string(),
            None,
            None,
        );
        summary.house_deed.expect("house deed issued").deed_token_id
    }

    #[test]
    fn test_property_escrow_deed_roundtrip() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        let contract_acct = env::current_account_id();

        give_respite(&mut contract, "alice.testnet", 2); // 800 RESPITE
        let deed_id = buy_house(&mut contract, "alice.testnet"); // -100 -> 700
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 700);

        // Alice lists the deed at 300: the NFT escrows with the contract
        // and her owner-index entry moves into the listing.
        set_ctx("alice.testnet", 0);
        let listing = contract.list_property_deed(deed_id.clone(), U128(300));
        assert_eq!(listing.listing_id, "property-1");
        assert_eq!(
            contract.nft_token(deed_id.clone()).expect("token").owner_id,
            contract_acct
        );
        assert!(contract.get_player_estate(acct("alice.testnet")).house_deed.is_none());
        assert_eq!(contract.get_property_listings().len(), 1);

        // Bob buys: payment and delivery land in the same call.
        give_respite(&mut contract, "bob.testnet", 1); // 400 RESPITE
        set_ctx("bob.testnet", 0);
        contract.buy_property("property-1".to_string());
        assert_eq!(contract.ft_balance_of(acct("bob.testnet")).0, 100);
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 1000);
        assert_eq!(
            contract.nft_token(deed_id.clone()).expect("token").owner_id,
            acct("bob.testnet")
        );
        let bob_estate = contract.get_player_estate(acct("bob.testnet"));
        assert_eq!(
            bob_estate.house_deed.expect("deed record").deed_token_id,
            deed_id
        );
        assert_eq!(contract.get_property_listings().len(), 0);
        assert_eq!(contract.get_contract_overview().active_property_listings, 0);
    }

    #[test]
    fn test_property_escrow_deed_cancel_restores_seller() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        give_respite(&mut contract, "alice.testnet", 2);
        let deed_id = buy_house(&mut contract, "alice.testnet");
        set_ctx("alice.testnet", 0);
        contract.list_property_deed(deed_id.clone(), U128(300));
        let cancelled = contract.cancel_property_listing("property-1".to_string());
        assert_eq!(cancelled.token_id, deed_id);
        assert_eq!(
            contract.nft_token(deed_id.clone()).expect("token").owner_id,
            acct("alice.testnet")
        );
        let estate = contract.get_player_estate(acct("alice.testnet"));
        assert_eq!(
            estate.house_deed.expect("deed restored").deed_token_id,
            deed_id
        );
        assert_eq!(contract.get_property_listings().len(), 0);
    }

    #[test]
    fn test_property_escrow_two_deeds_no_index_collision() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));

        give_respite(&mut contract, "alice.testnet", 2);
        let deed_a = buy_house(&mut contract, "alice.testnet");
        give_respite(&mut contract, "carol.testnet", 2);
        let deed_b = buy_house(&mut contract, "carol.testnet");

        // Both deeds escrowed at once under the same contract account.
        set_ctx("alice.testnet", 0);
        contract.list_property_deed(deed_a.clone(), U128(300));
        set_ctx("carol.testnet", 0);
        contract.list_property_deed(deed_b.clone(), U128(500));
        assert_eq!(contract.get_property_listings().len(), 2);

        // Buying the FIRST one must not disturb the second's escrow.
        give_respite(&mut contract, "bob.testnet", 2);
        set_ctx("bob.testnet", 0);
        contract.buy_property("property-1".to_string());
        assert_eq!(
            contract
                .get_player_estate(acct("bob.testnet"))
                .house_deed
                .expect("deed")
                .deed_token_id,
            deed_a
        );
        let remaining = contract.get_property_listings();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].token_id, deed_b);

        // And cancelling the second restores Carol exactly.
        set_ctx("carol.testnet", 0);
        contract.cancel_property_listing("property-2".to_string());
        assert_eq!(
            contract
                .get_player_estate(acct("carol.testnet"))
                .house_deed
                .expect("deed")
                .deed_token_id,
            deed_b
        );
    }

    #[test]
    fn test_property_escrow_furniture_roundtrip() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        let contract_acct = env::current_account_id();
        let tatami = "nep245:furniture:tatami_tea_table".to_string();

        // Master stocks 10 tatami; Alice buys 2 at the base price of 8.
        set_ctx("buddiesblitz.testnet", 0);
        contract.mint_merchant_item(None, tatami.clone(), U128(10));
        set_ctx("buddiesblitz.testnet", 1);
        contract.mt_transfer(acct("alice.testnet"), tatami.clone(), U128(10), None, None);
        // Give Alice the 2 she will list by direct transfer instead:
        // (merchant stock path is covered by the merchant tests; here the
        // escrow only cares about balances.)
        assert_eq!(contract.mt_balance_of(acct("alice.testnet"), tatami.clone()).0, 10);

        set_ctx("alice.testnet", 0);
        let listing = contract.list_property_furniture(tatami.clone(), U128(2), U128(25));
        assert_eq!(contract.mt_balance_of(acct("alice.testnet"), tatami.clone()).0, 8);
        assert_eq!(contract.mt_balance_of(contract_acct.clone(), tatami.clone()).0, 2);

        give_respite(&mut contract, "bob.testnet", 1);
        set_ctx("bob.testnet", 0);
        contract.buy_property(listing.listing_id.clone());
        assert_eq!(contract.mt_balance_of(acct("bob.testnet"), tatami.clone()).0, 2);
        assert_eq!(contract.mt_balance_of(contract_acct, tatami.clone()).0, 0);
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 25);
        assert_eq!(contract.ft_balance_of(acct("bob.testnet")).0, 375);
    }

    #[test]
    #[should_panic(expected = "Seller cannot buy their own listing")]
    fn test_property_escrow_seller_cannot_buy_own() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        give_respite(&mut contract, "alice.testnet", 2);
        let deed_id = buy_house(&mut contract, "alice.testnet");
        set_ctx("alice.testnet", 0);
        contract.list_property_deed(deed_id, U128(300));
        contract.buy_property("property-1".to_string());
    }

    #[test]
    #[should_panic(expected = "Insufficient RESPITE balance")]
    fn test_property_escrow_buy_requires_balance() {
        set_ctx("buddiesblitz.testnet", 0);
        let mut contract = BuddiesMarketContract::init(acct("buddiesblitz.testnet"));
        give_respite(&mut contract, "alice.testnet", 2);
        let deed_id = buy_house(&mut contract, "alice.testnet");
        set_ctx("alice.testnet", 0);
        contract.list_property_deed(deed_id, U128(300));
        set_ctx("bob.testnet", 0);
        contract.buy_property("property-1".to_string());
    }

    #[test]
    fn test_migrate_from_v120_preserves_state() {
        // The migration guard requires caller == contract account.
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(acct("buddiesblitz.testnet"))
            .predecessor_account_id(acct("buddiesblitz.testnet"))
            .attached_deposit(NearToken::from_yoctonear(0))
            .block_timestamp(1_762_800_000_000_000_000);
        testing_env!(builder.build());
        // Build a v1.2.0-shaped state by hand: master treasury + one
        // account balance + one minted house counter.
        let mut respite_balances = LookupMap::new(b"r");
        respite_balances.insert(acct("buddiesblitz.testnet"), 50_000u128);
        respite_balances.insert(acct("alice.testnet"), 777u128);
        let old = OldBuddiesMarketContract {
            master_account: acct("buddiesblitz.testnet"),
            total_respite_supply: 50_777,
            respite_balances,
            storage_deposits: LookupMap::new(b"s"),
            nft_tokens_by_id: IterableMap::new(b"t"),
            fish_nfts: LookupMap::new(b"f"),
            market_listings: IterableMap::new(b"m"),
            active_listing_by_token: LookupMap::new(b"l"),
            nft_subaccount_ledgers: LookupMap::new(b"d"),
            house_deeds: LookupMap::new(b"h"),
            family_contracts_by_owner: LookupMap::new(b"c"),
            mt_balances: LookupMap::new(b"b"),
            total_houses_minted: 4,
            total_family_contracts: 1,
            total_fish_nfts_minted: 14,
        };
        env::state_write(&old);
        // SDK store collections flush their caches on Drop; the old state
        // must be dropped before migrating or its entries stay unwritten.
        drop(old);
        let contract = BuddiesMarketContract::migrate();
        let overview = contract.get_contract_overview();
        assert_eq!(overview.contract_version, "1.3.0");
        assert_eq!(overview.total_respite_supply.0, 50_777);
        assert_eq!(overview.total_houses_minted, 4);
        assert_eq!(overview.active_property_listings, 0);
        assert_eq!(contract.ft_balance_of(acct("alice.testnet")).0, 777);
        assert_eq!(contract.get_property_listings().len(), 0);
    }

}
