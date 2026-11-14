# Buddies Blitz

**Buddies Blitz** is a 60 FPS WebGL 3D social district, economy sandbox, and team arena built with Three.js, React 19, and NEAR Protocol (`market.buddiesblitz.testnet`). It pairs seedless NEAR citizen sub-accounts (`<handle>.buddiesblitz.testnet`) with a non-ponzi three-currency economy, server-attested Fish NFTs, an autonomous on-chain NPC market desk, NEP-245 furnishings, and functional NEP-171 House Ownership Deeds backed by epoch-rotated sub-account treasuries.

- **Live Deployment**: [https://buddies-rouge.vercel.app](https://buddies-rouge.vercel.app)
- **Primary Hackathon Track**: `games` -- Games With Real Economies
- **Secondary Hackathon Track**: `nfts` -- NFTs That Do Something
- **Smart Contract (NEAR Testnet v1.5.0)**: [`market.buddiesblitz.testnet`](https://testnet.nearblocks.io/address/market.buddiesblitz.testnet) (`code_hash`: `6fbD9tVEkmJguNMc6SL7uGwu6hurX8iHtCkhUQ5WwRtg`)
- **Master Account**: [`buddiesblitz.testnet`](https://testnet.nearblocks.io/address/buddiesblitz.testnet) · **NPC Treasury Desk**: [`kai.buddiesblitz.testnet`](https://testnet.nearblocks.io/address/kai.buddiesblitz.testnet)

| Coastal District & Fishing Pier | City Transit & Services Hub |
|---|---|
| ![East Beach boardwalk and Merchant Kai coastal pier](docs/hero-1-beach-pier.jpg) | ![City Transit & Services Kiosk Hub](docs/hero-10-transit-kiosk-hub.jpg) |
| ![Street Tram Station at Central Plaza](docs/hero-2-tram-station.jpg) | ![Hana Property & Housing Exchange desk](docs/hero-4-hana-exchange.jpg) |
| ![Hana AI Dialogue Session](docs/hero-4b-hana-chat.jpg) | ![Kai P2P Fish NFT Marketplace](docs/hero-5-kai-fish-market.jpg) |
| ![Warzone Faction Deployment Selection](docs/hero-11-warzone-team-select.jpg) | ![Private House 3D Interior Studio](docs/hero-3-house-interior.jpg) |

---

## Core Design & NEAR Integration

### 1. Seedless Sub-Accounts & In-Game Transaction Confirmation
Players sign in with Google OAuth (via Privy), register a handle (`<handle>.buddiesblitz.testnet`), or connect **Meteor Wallet** / **MyNearWallet** with NEP-413 verification:
- **Seedless Sub-Account Provisioning**: `/api/near-relayer` creates `<handle>.buddiesblitz.testnet` and installs a browser-scoped Ed25519 `FunctionCall` key (`0.25 NEAR` allowance scoped strictly to `market.buddiesblitz.testnet`).
- **Explicit In-Game Confirmation**: Every contract write from an in-game citizen sub-wallet renders `InGameWalletConfirmModal` showing the human-readable action, target contract, attached NEAR deposit, and gas allocation before signing locally (Reject cancels cleanly without triggering external wallet popups).
- **Chain-Truth Refresh**: Account balances (`ft_balance_of`, NEAR balance) and Deed ledgers are re-queried directly from FastNEAR RPC after every transaction, overriding any cached UI numbers.

### 2. Three-Currency Anti-Bot Economy (`games`)
Traditional Web3 games either disrupt gameplay with constant wallet popups or mint tradeable tokens endlessly from repetitive grinding. Buddies Blitz isolates gameplay rewards from on-chain value:

```text
OFF-CHAIN GAMEPLAY LAYER (Zero Gas, No On-Chain Token Printing from Grinding)
  Warzone Arena + Glasshouse Cafe Jobs + Raw Caught Fish ──> LUL
                                                              │
                                                              ▼ (Exchange: 100 LUL -> 10 CYON base rate)
                                                             CYON ──> Non-NFT Catalog Gear & Tackle (Never NFT Furniture)

ON-CHAIN TREASURY & P2P OWNERSHIP LAYER (market.buddiesblitz.testnet, v1.5.0)
  NEAR Testnet ──> swap_near_for_respite() [One-Way 1 NEAR = 400 RESPITE] ──> RESPITE (NEP-141)
     ├──> purchase_citizen_asset() ──> House Ownership Deed (100 R) / Family AI Contracts (15 / 45 / 180 R)
     ├──> buy_merchant_item() / sell_merchant_item() ──> Pre-Minted NEP-245 NFT Furniture Only
     └──> Player-to-Player & NPC Treasury Settlement
            ├── Minted Fish NFTs (NEP-171): list_fish_nft / buy_fish_nft (Players or kai.buddiesblitz.testnet)
            └── Contract-Escrow Real Estate (NEP-171/NEP-245): list_property_deed / buy_property
```

| Asset | Standard / Layer | Supply Source | Permitted Sink | Security Property |
|---|---|---|---|---|
| `LUL` | Off-chain Postgres + HUD | Warzone drops, Glasshouse Cafe shifts (`+12 LUL`/order), raw fish sales | Converts only to `CYON` via NPC Exchange | Cannot withdraw or swap into `RESPITE` or `NEAR`; ground drops expire in `40s` |
| `CYON` | Off-chain Postgres + HUD | Converted from `LUL` | Standard non-NFT gear and fishing tackle | Strictly isolated from `RESPITE`; furniture is NFT-only and cannot be bought with `CYON` |
| `RESPITE` | On-chain NEP-141 / NEP-145 | One-way `swap_near_for_respite()` (`1 NEAR = 400 RESPITE`, min `0.0025 NEAR`) or P2P NFT sales | House Deeds (`100 R`), Family AI (`15/45/180 R`), NEP-245 Collector Furniture, P2P & Escrow Markets | Zero emission from gameplay grinding; live RPC `ft_balance_of` overrides UI cache |

### 3. Functional Sub-Account Deeds (`nfts`)
Every House Ownership Deed (`house-deed-*`, e.g., `house-deed-0001`) binds an on-chain `NftSubAccountLedger` record (`estate-XXXX.buddiesblitz.testnet`):
- Holds `treasury_respite`, `pending_payout_respite`, `total_earned_respite`, `total_paid_out_respite`, `key_epoch`, `active_session_key`, and an immutable `ownership_history` vector.
- Calling `authorize_deed_session_key` scopes an ephemeral key strictly to `(owner_id, key_epoch)`.
- When the Deed changes hands via `nft_transfer` or contract-escrow `buy_property`, `internal_transfer_nft_ownership` atomically increments `key_epoch`, clears `active_session_key`, transfers accumulated pending royalties intact to the buyer, and logs a `SubAccountTransferRecord`.
- Calling `claim_deed_payout(token_id, expected_key_epoch)` enforces both owner equality and `expected_key_epoch == ledger.key_epoch`, eliminating mid-payout front-running by a former owner.

### 4. Autonomous AI Merchants Bounded by Deterministic Math
Players talk or haggle in natural language (and any spoken language) with **Hana** (Central Plaza) and **Kai** (East Beach) through `/api/npc-agent` (Gemini 2.5 Flash) and `/api/npc-trade` -- either in person or through Kai's in-game phone call after catching a fish:
- **Words vs. Numbers Separation**: The LLM generates conversational text only; every offer, counter-offer (+7% / +5% / +3% steps), 80% opening anchor, 115% ceiling, patience limit, and 24-hour memory/walk-away lockout is enforced deterministically in `src/game/buddiesMerchantPricing.ts` and clamped server-side inside `api/npc-trade.ts`.
- **Live NPC On-Chain Settlement**: For minted Fish NFTs, `kai.buddiesblitz.testnet` holds real on-chain `RESPITE` and signs `buy_fish_nft` with a 250 `RESPITE` per-tx cap, 1,000 `RESPITE`/day cap, 500 reserve floor, -10% daily circuit breaker, and 50% profit lock.
- **Fast-Forward Economy Simulation**: Inside Hana/Kai `EXCHANGE` and `CATALOG` tabs, clicking `FAST-FORWARD SIM` advances simulated market days in real time so judges can observe dynamic pricing pressure, restocking, and liquidity reserve protection.

---

## Security Architecture & Threat Model

| Surface | Threat Addressed | Control Implemented | Verification File |
|---|---|---|---|
| Relayer (`/api/near-relayer`) | Unauthenticated `AddKey(FullAccess)` takeover of existing `.buddiesblitz.testnet` handles | Non-strict session recovery rejects missing emails (`409 HANDLE_TAKEN`), requires valid `bb_lookup_account_by_email` match (`403 EMAIL_NOT_BOUND`), and fails closed (`503`) if identity lookup is unconfigured | [`api/near-relayer.ts`](api/near-relayer.ts), [`src/lib/nearClient.test.ts`](src/lib/nearClient.test.ts) |
| Starter Grant (`claim_hana_welcome_near_attested`) | Multi-wallet farming via fresh Google sessions or replays | Domain-separated Ed25519 attestation (`buddies-hana-claim-v1\|...`) verified on-chain via `env::ed25519_verify`, plus `claimed_hana_email_hashes` map blocking duplicate SHA-256 email claims across handles | [`api/hana-claim-attest.ts`](api/hana-claim-attest.ts), [`contracts/buddies-market/src/lib.rs`](contracts/buddies-market/src/lib.rs) |
| Fish Minting (`/api/fish-attest`) | Arbitrary client-minted trophy weights or API spam | `mint_fish_nft_attested` rejects unattested mints; `/api/fish-attest` enforces per-species weight bounds (`1.05x` max weight), expiring timestamps, and sliding-window rate limiting (`30` req/60s) | [`api/fish-attest.ts`](api/fish-attest.ts), [`src/lib/nearClient.test.ts`](src/lib/nearClient.test.ts) |
| Property Escrow & Payouts | Seller retaining asset after payment or draining royalties post-sale | `list_property_deed` moves deed into contract custody; `buy_property` swaps funds and deed atomically and bumps `key_epoch`, revoking stale claim calls | [`contracts/buddies-market/src/lib.rs`](contracts/buddies-market/src/lib.rs) |
| Database / Keys | Exposure of privileged credentials or open CORS abuse | `api/*.ts` prefers `SUPABASE_SERVICE_ROLE_KEY`, keeps `KAI_TRADE_PRIVATE_KEY` and `FISH_ATTESTER_PRIVATE_KEY` server-only, and enforces origin allowlists | [`.env.example`](.env.example), [`supabase_mvp_schema.sql`](supabase_mvp_schema.sql) |

---

## Reproducible Verification (`Do X -> See Y`)

All checks below can be executed locally without modifying any game state or secrets.

### Build & Automated Test Suite

Requirements: Node.js 18+, npm, and Rust (`stable` + `cargo-near` for WASM recompilation).

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript static check, 175 Node unit tests, and production WebGL build
npm run lint      # tsc --noEmit (0 errors)
npm test          # 175 unit tests via tsx --test (relayer auth, economy invariants, fishing, OAuth guards, arena rules)
npm run build     # Vite 8 production bundle into dist/

# 3. Run Rust smart contract unit tests & compile WASM (near-sdk 5.5.0)
cd contracts/buddies-market
cargo test                                 # 38/38 unit tests (NEP-141, P2P fish market, escrow, epoch rotation, v1.5.0 migration)
cargo near build non-reproducible-wasm     # Builds target/near/buddies_market.wasm (348,564 bytes) + buddies_market_abi.json
```

### Live NEAR Testnet Contract Verification

```bash
# Verify deployed WASM code hash (expected: 6fbD9tVEkmJguNMc6SL7uGwu6hurX8iHtCkhUQ5WwRtg)
curl -s -X POST https://rpc.testnet.fastnear.com -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"view_account","finality":"final","account_id":"market.buddiesblitz.testnet"}}'

# Verify live contract overview (contract_version: "1.5.0", house_price_respite: "100", respite_per_near_rate: 400)
curl -s -X POST https://rpc.testnet.fastnear.com -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"call_function","finality":"final","account_id":"market.buddiesblitz.testnet","method_name":"get_contract_overview","args_base64":"e30="}}'

# Query active P2P fish listings on-chain
curl -s -X POST https://rpc.testnet.fastnear.com -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"call_function","finality":"final","account_id":"market.buddiesblitz.testnet","method_name":"get_fish_listings","args_base64":"e30="}}'
```

| Milestone | Account / TX Identifier | Explorer |
|---|---|---|
| Contract v1.5.0 Deploy | `y86KBd736RCszxeC7hzyPDiq3wy25opjYK6KUm2xyR3` | [NearBlocks](https://testnet.nearblocks.io/txns/y86KBd736RCszxeC7hzyPDiq3wy25opjYK6KUm2xyR3) |
| State Migration (`migrate_v140_to_v150`) | `2zye3Xr1MhCRzohbagLdFbu4JwCRXbaQzVo24fpkVBy7` | [NearBlocks](https://testnet.nearblocks.io/txns/2zye3Xr1MhCRzohbagLdFbu4JwCRXbaQzVo24fpkVBy7) |
| Server-Attested Fish Mint Deploy (`v1.4.0`) | `DEJc6aPBFFyq1Yev397ipgTxDXsAf1tp9TbfUbWfMVJQ` | [NearBlocks](https://testnet.nearblocks.io/txns/DEJc6aPBFFyq1Yev397ipgTxDXsAf1tp9TbfUbWfMVJQ) |
| Escrow Property Market Deploy (`v1.3.0`) | `9MxHwwWgQFXT6CHuooqKok4kCuKvGQnYHFg87betwgHE` | [NearBlocks](https://testnet.nearblocks.io/txns/9MxHwwWgQFXT6CHuooqKok4kCuKvGQnYHFg87betwgHE) |
| Kai On-Chain Treasury Setup (`2,000 R` float) | `66eT12ikrXotwnE1mcXxGgz3CBSNPGUmVNP4G2x3ogu5` | [NearBlocks](https://testnet.nearblocks.io/txns/66eT12ikrXotwnE1mcXxGgz3CBSNPGUmVNP4G2x3ogu5) |
| Genesis Contract Init (`v1.0.0`) | `2ZPfGcyGe6pnivJE6RcM88EnLXQwG8o6Fv7hcQnaKDiL` | [NearBlocks](https://testnet.nearblocks.io/txns/2ZPfGcyGe6pnivJE6RcM88EnLXQwG8o6Fv7hcQnaKDiL) |

> **Historical Rate Note**: Earlier genesis swap and house-purchase receipts on chain occurred under pre-update development parameters; current live parameters are `1 NEAR = 400 RESPITE` and `100 RESPITE` per House Ownership Deed.

### Interactive Feature Walkthroughs (`Do X -> See Y`)

1. **First Home Forced Tutorial (8 Hard-Gated Steps) & Attested Starter Pack**
   - **Do:** Open [https://buddies-rouge.vercel.app](https://buddies-rouge.vercel.app) (or `http://localhost:3000`). Complete the guided First Home flow: connect Google OAuth, Meteor, MyNearWallet, or create a citizen handle (`judge01`), talk to **Hana (`[E]`)** at Central Plaza, and claim the starter pack (`0.30 NEAR + 100 LUL + 20 CYON`, once per wallet and once per Google account; Guest mode cannot claim).
   - **See:** Google sign-ins invoke `/api/hana-claim-attest` + `claim_hana_welcome_near_attested`, recording an immutable email hash on-chain and displaying your transaction proof strip. Balances re-read directly from NEAR RPC after confirmation, unlocking each tutorial gate sequentially (`0.25 NEAR -> 100 RESPITE` swap, House Deed purchase, NFT furniture purchase, home entry, furniture placement).
2. **Swap `NEAR -> RESPITE`, Buy Deed, Furnish Studio, and Inspect Sub-Account Ledger (`nfts`)**
   - **Do:** In **Hana -> `EXCHANGE`**, swap `0.25 NEAR -> 100 RESPITE` and toggle `FAST-FORWARD SIM` to watch simulated market days advance, then purchase **House Ownership (`100 RESPITE`)** in `CATALOG -> HOUSE` and one piece of **NFT Furniture** (`RESPITE` / NEP-245) in `CATALOG -> FURNITURE`. Enter with **`GO TO YOUR HOUSE`** (`CONFIRM MOVE` after placing furniture), then open **`WALLET -> MY ITEMS`**.
   - **See:** Your House Deed card displays the real minted Deed ID (e.g., `house-deed-0001`), linked sub-account (`estate-0001.buddiesblitz.testnet`), active **`EPOCH #N`**, Pending/Earned/Paid Out RESPITE counters, Provenance History, and functional **`FUND +5 R`** / **`CLAIM PAYOUT`** on-chain buttons. Under `CATALOG -> MARKET`, real estate and NFT furniture listings settle atomically via contract escrow (`list_property_deed` -> `buy_property`), and each settlement issues a receipt Letter under `Social Chat -> PRIVATE`.
3. **Shoreline Fishing, Attested NFT Minting & Bounded AI Haggling (`games`)**
   - **Do:** Ride the tram (`[G]`) or take **City Transit Kiosk (`[E]`) -> `KAI FISH MARKET`**, equip the **Fishing Rod** (`BAG`), hold **`F`** near East Beach water, complete the **Line-Tension Gauge** catch, open **`BAG -> FISH`** to mint a Fish NFT (`/api/fish-attest`), and talk or haggle with **Kai (`[E]`)** or answer his phone call in any language.
   - **See:** Minting writes on-chain species, zone, rarity, and weight attributes verified by Ed25519 signature. Haggling runs deterministic step/ceiling logic while allowing `kai.buddiesblitz.testnet` to buy qualifying Fish NFTs with real on-chain `RESPITE`.
4. **Glasshouse Cafe Barista Shift & Separated 4v4 Warzone Arena**
   - **Do:** Enter **Glasshouse Cafe** inside Central Plaza to prepare 3 drink orders (`+12 LUL` each), then return to the **Transit Kiosk (`[E]`) -> `WARZONE ARENA`**, pick **`BLUE TEAM`** or **`RED TEAM`**, stack crates on `2x2x2` team pads, and press **`EXIT WARZONE`** when finished.
   - **See:** Combat weapons, crates, and Family Member AI squad companions operate exclusively inside the Warzone arena, never inside the peaceful city plaza.

---

## Controls

| Key | Action |
|---|---|
| `W A S D` / Arrow Keys | Move character, swim, or drive vehicle |
| `Space` | Jump (Main World & Warzone) |
| `E` | Interact with Hana/Kai, Transit Kiosk, Cafe, or pick up/throw crates in Warzone |
| `G` | Board or exit the Street Tram |
| `F` | Cast / reel Fishing Rod by shoreline or assemble active `2x2x2` pad recipe in Warzone |
| `Q` | Cycle active `2x2x2` crate recipe hologram on base pad |
| `B` | Open Tactical Base Kiosk (`Armory` / `Hangar`) or Plot Claim panel |
| `T` | Open World & Private Whisper Chat (`Messages`, `Letters`, online list) |
| `Esc` | Close active modal or cancel cast |

---

## Repository Layout

```text
api/
  fish-attest.ts                        Serverless Ed25519 catch attestation (mint_fish_nft_attested + rate limit)
  hana-claim-attest.ts                  Serverless Ed25519 starter-claim attestation + email hash deduplication
  near-relayer.ts                       Dual-key citizen sub-account provisioner + email-verified session recovery
  npc-agent.ts                          Gemini 2.5 Flash multilingual NPC dialogue concierge for Hana & Kai
  npc-trade.ts                          Bounded RESPITE negotiation sessions + kai.buddiesblitz.testnet settlement

contracts/buddies-market/
  Cargo.toml                            near-sdk 5.5.0 manifest
  src/lib.rs                            NEP-141/145, NEP-171/177/181, Sub-Account Deeds, Escrow, NEP-245 (v1.5.0)
  target/near/                          Compiled buddies_market.wasm (348,564 B) + buddies_market_abi.json

src/
  App.tsx                               HUD, Wallet MY ITEMS/HISTORY, Sub-Account Deed Ledger UI, Bag, Tutorial state
  components/
    CharacterProfileModal.tsx           Citizen identity & balance modal
    CityTransitKioskModal.tsx           Portal Hub: Travel & Districts, Warzone Faction Select, My House, Shop
    Fish3dPreviewModal.tsx              360-degree Three.js fish inspector
    Furniture3dPreviewModal.tsx         3D interior catalog item inspector
    GlasshouseCafeModal.tsx             Barista job shift mini-game (+12 LUL/order)
    InGameWalletConfirmModal.tsx        On-chain transaction signer confirmation sheet
    MobileResponsiveControls.tsx        Touch joysticks & responsive orientation guard
    NearWalletSelectorModal.tsx         Handle registration + Meteor / MyNearWallet NEP-413 connection
    NpcMerchantAndHouseModal.tsx        Hana/Kai Dialogue, Exchange + FAST-FORWARD SIM, Catalog, Escrow Market, Studio
    ShorelineCatchShowcaseModal.tsx     Tension-gauge catch summary
    SocialChatModal.tsx                 Global chat, whispers, and on-chain ownership/sales Letters
    TacticalKioskModal.tsx              Warzone Armory, Vehicle Hangar, and Residential Plot claim UI
  game/
    BuddiesBlitzArena.tsx               Unified Three.js engine, peaceful city isolation & Warzone loop
    buddiesBlitzRules.ts                Crate stacking recipes, match win conditions, plot & transit rules
    buddiesMerchantPricing.ts           Deterministic NPC negotiation math, dynamic catalog & house rules
    buddiesFishingMarket.ts             Shoreline habitat tables, cast/tension mechanics & P2P market types
    buddiesInteriorAssets.ts            Pavilion architectural studio & OBB furniture placement
    buddiesBlitzWorldBuilder.ts         Coastal city geometry, tram line & Warzone map builder
    buddiesBlitzSquadAi.ts              Octile A* pathfinding & Warzone-only Family Member companion AI
    buddiesAmusementParkBuilder.ts      Harbor amusement district structures and animated rides
    buddiesCafeInteriorBuilder.ts       Glasshouse Cafe interactive interior layout
    audio.ts                            Procedural Web Audio synthesizer
  lib/
    nearClient.ts                       FastNEAR JSON-RPC helpers, Ed25519 key management & contract calls
    supabaseClient.ts                   PostgreSQL persistence, market event feed & realtime multiplayer channel
    privyAuthBridge.tsx                 Headless Google OAuth bridge & injected wallet safety wrappers

supabase_mvp_schema.sql                 Idempotent PostgreSQL tables, RLS policies, views & atomic RPCs
```

---

## Local Setup & Environment Variables

1. Copy [`.env.example`](.env.example) to `.env`.
2. Initialize your Supabase project by running [`supabase_mvp_schema.sql`](supabase_mvp_schema.sql) in the Supabase SQL Editor.
3. Configure public Vite variables (`VITE_NEAR_NETWORK`, `VITE_NEAR_RPC_URL`, `VITE_NEAR_MARKET_CONTRACT_ID`, `VITE_PRIVY_APP_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and server-only API variables (`NEAR_MASTER_PRIVATE_KEY`, `FISH_ATTESTER_PRIVATE_KEY`, `HANA_CLAIM_ATTESTER_PRIVATE_KEY`, `KAI_TRADE_PRIVATE_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`) in Vercel Project Settings or local `.env`.
4. Run `npm run dev` and open `http://localhost:3000`.

---

## Acknowledgments & License

- **License**: Released under the [MIT License](LICENSE).
- **Open-Source Attribution**: Shoreline fishing bite scheduling, line-tension fight mechanics, catch showcase flow, and analytical multi-cascade wave evaluation were adapted from the MIT-licensed project **Tidewater** by Dan Greenheck (DRG Software Solutions LLC, [https://github.com/dgreenheck/tidewater](https://github.com/dgreenheck/tidewater)). Full license text and file-level attribution are documented in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
- **Prior Hackathon Baseline**: `CettaC1716/buddies` is the sole hackathon submission repository, consolidating an earlier Nov 5-8 prototype branch created within the NEAR Hackathon 2026 development window.
