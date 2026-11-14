-- Buddies Blitz Database Schema (Supabase PostgreSQL — Hardened Idempotent Production & Hackathon Schema)
-- Economy Invariant: LUL & CYON are strictly off-chain social currencies.
-- RESPITE, Fish NFTs (NEP-171), Citizen Deeds, and Multi-Tokens (NEP-245) live on NEAR (`market.buddiesblitz.testnet`).

-- 1. Player Profiles (Off-Chain Social Balances & Non-Authoritative UI Read-Cache)
-- Note: `market.buddiesblitz.testnet` (`ft_balance_of` / `get_player_estate`) is the sole authoritative
-- Source of Truth for `RESPITE` and NFT ownership; `respite_balance` below is strictly a UI read-cache
-- for public profile inspection and is always overwritten by live NEAR RPC balances on wallet session load.
CREATE TABLE IF NOT EXISTS public.bb_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  near_account_id text UNIQUE NOT NULL CHECK (char_length(near_account_id) BETWEEN 2 AND 64),
  auth_mode text NOT NULL DEFAULT 'wallet_selector' CHECK (auth_mode IN ('social_invisible', 'wallet_selector', 'near_wallet', 'guest')),
  display_name text NOT NULL DEFAULT 'COMMANDER' CHECK (char_length(display_name) BETWEEN 1 AND 48),
  email text,
  lul_balance numeric NOT NULL DEFAULT 0 CHECK (lul_balance >= 0 AND lul_balance <= 1000000),
  cyon_balance numeric NOT NULL DEFAULT 0 CHECK (cyon_balance >= 0 AND cyon_balance <= 1000000),
  respite_balance numeric NOT NULL DEFAULT 0 CHECK (respite_balance >= 0 AND respite_balance <= 100000),
  warzone_gold numeric NOT NULL DEFAULT 0 CHECK (warzone_gold >= 0 AND warzone_gold <= 1000000),
  owned_token_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  unlocked_skins jsonb NOT NULL DEFAULT '["default"]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Align existing bb_profiles defaults & auth_mode constraint idempotently
ALTER TABLE public.bb_profiles
  ALTER COLUMN lul_balance SET DEFAULT 0,
  ALTER COLUMN cyon_balance SET DEFAULT 0,
  ALTER COLUMN respite_balance SET DEFAULT 0,
  ALTER COLUMN warzone_gold SET DEFAULT 0,
  ALTER COLUMN owned_token_ids SET DEFAULT '[]'::jsonb;

ALTER TABLE public.bb_profiles DROP CONSTRAINT IF EXISTS bb_profiles_auth_mode_check;
ALTER TABLE public.bb_profiles ADD CONSTRAINT bb_profiles_auth_mode_check
  CHECK (auth_mode IN ('social_invisible', 'wallet_selector', 'near_wallet', 'guest'));

-- Public safe projection excluding PII (`email`)
CREATE OR REPLACE VIEW public.bb_public_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  near_account_id,
  auth_mode,
  display_name,
  lul_balance,
  cyon_balance,
  respite_balance,
  warzone_gold,
  owned_token_ids,
  unlocked_skins,
  updated_at
FROM public.bb_profiles;

GRANT SELECT ON public.bb_public_profiles TO anon, authenticated;

-- 2. Social & Spatial Radius Chat Messages
CREATE TABLE IF NOT EXISTS public.bb_social_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL CHECK (char_length(sender_name) BETWEEN 1 AND 48),
  sender_near_account text,
  recipient_name text,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 280),
  bubble_color text NOT NULL DEFAULT '#38bdf8' CHECK (char_length(bubble_color) <= 16),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Autonomous Agent NPC Merchants (`09-games` Dynamic Stock/Demand Pricing)
CREATE TABLE IF NOT EXISTS public.bb_npc_merchants (
  merchant_id text PRIMARY KEY CHECK (merchant_id IN ('lobby_cafe', 'beach_house')),
  npc_name text NOT NULL,
  near_wallet_address text NOT NULL,
  cyon_treasury numeric NOT NULL DEFAULT 0 CHECK (cyon_treasury >= 0 AND cyon_treasury <= 5000000),
  respite_treasury numeric NOT NULL DEFAULT 0 CHECK (respite_treasury >= 0 AND respite_treasury <= 500000),
  is_bankrupt boolean NOT NULL DEFAULT false,
  stock_by_item jsonb NOT NULL DEFAULT '{}'::jsonb,
  recent_demand_by_item jsonb NOT NULL DEFAULT '{}'::jsonb,
  investors jsonb NOT NULL DEFAULT '[]'::jsonb,
  simulated_day integer NOT NULL DEFAULT 1 CHECK (simulated_day >= 1 AND simulated_day <= 100000),
  last_headline text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Private Citizen House Interior Studio State
CREATE TABLE IF NOT EXISTS public.bb_house_interiors (
  owner_near_account text PRIMARY KEY CHECK (char_length(owner_near_account) BETWEEN 2 AND 64),
  active_theme_id text NOT NULL DEFAULT 'theme_japanese_zen',
  daylight_hour numeric NOT NULL DEFAULT 14 CHECK (daylight_hour >= 0 AND daylight_hour <= 24),
  placed_furniture jsonb NOT NULL DEFAULT '[]'::jsonb,
  mood_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Normalized P2P Fish NFT Marketplace Order Book
CREATE TABLE IF NOT EXISTS public.bb_fish_listings (
  listing_id text PRIMARY KEY CHECK (char_length(listing_id) BETWEEN 2 AND 96),
  token_id text UNIQUE NOT NULL CHECK (char_length(token_id) BETWEEN 2 AND 96),
  seller_near_account text NOT NULL CHECK (char_length(seller_near_account) BETWEEN 2 AND 64),
  seller_display_name text NOT NULL DEFAULT 'Citizen Angler',
  species_id text NOT NULL,
  species_name text NOT NULL,
  water_zone text NOT NULL DEFAULT 'East Beach Shoreline',
  rarity text NOT NULL CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Mythic', 'Legendary')),
  weight_kg numeric NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  length_cm numeric NOT NULL DEFAULT 30,
  price_respite numeric NOT NULL CHECK (price_respite >= 1 AND price_respite <= 100000),
  tx_hash text,
  listed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_fish_listings_listed_at
  ON public.bb_fish_listings (listed_at DESC);

-- 6. Market Transactions, Sub-Account Deed Ledgers & Claimable Base Plots
CREATE TABLE IF NOT EXISTS public.bb_market_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text,
  actor_near_account text NOT NULL CHECK (char_length(actor_near_account) BETWEEN 2 AND 64),
  action_type text NOT NULL,
  item_id text,
  nep245_token_id text,
  currency text NOT NULL CHECK (currency IN ('LUL', 'CYON', 'RESPITE', 'GOLD', 'NEAR')),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0 AND amount <= 1000000),
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  reasoning_summary text NOT NULL DEFAULT '' CHECK (char_length(reasoning_summary) <= 280),
  near_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bb_gamepass_nfts (
  token_id text PRIMARY KEY,
  owner_near_account text NOT NULL,
  sub_account_id text NOT NULL,
  treasury_respite numeric NOT NULL DEFAULT 0 CHECK (treasury_respite >= 0 AND treasury_respite <= 100000),
  total_earned_respite numeric NOT NULL DEFAULT 0,
  total_paid_out_respite numeric NOT NULL DEFAULT 0,
  pending_payout_respite numeric NOT NULL DEFAULT 0,
  active_access_key text NOT NULL DEFAULT '',
  ownership_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  network text NOT NULL DEFAULT 'testnet',
  tx_hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bb_base_plots (
  plot_key text PRIMARY KEY,
  team text NOT NULL CHECK (team IN ('blue', 'red')),
  plot_index integer NOT NULL,
  is_model_estate boolean NOT NULL DEFAULT false,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_by_near_account text,
  claimed_by_token_id text,
  base_level integer NOT NULL DEFAULT 1 CHECK (base_level BETWEEN 1 AND 3),
  skin_theme_id text NOT NULL DEFAULT 'default',
  garden_preset_id text NOT NULL DEFAULT 'zen_garden',
  access_mode text NOT NULL DEFAULT 'PUBLIC' CHECK (access_mode IN ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE')),
  allowed_friends jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_harvesters jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.bb_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_npc_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_house_interiors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_fish_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_market_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_gamepass_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_base_plots ENABLE ROW LEVEL SECURITY;

-- Idempotent Policies supporting Privy/NEAR Citizen sessions (`anon` + RPCs) and Supabase Auth (`authenticated`)
DROP POLICY IF EXISTS "bb_profiles_select" ON public.bb_profiles;
CREATE POLICY "bb_profiles_select" ON public.bb_profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_profiles_insert" ON public.bb_profiles;
CREATE POLICY "bb_profiles_insert" ON public.bb_profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(near_account_id) BETWEEN 2 AND 64 AND lul_balance >= 0 AND cyon_balance >= 0);

DROP POLICY IF EXISTS "bb_profiles_update" ON public.bb_profiles;
CREATE POLICY "bb_profiles_update" ON public.bb_profiles
  FOR UPDATE TO anon, authenticated
  USING (
    auth.role() = 'anon'
    OR email IS NULL
    OR (auth.jwt() ->> 'email') = email
  )
  WITH CHECK (lul_balance <= 1000000 AND cyon_balance <= 1000000 AND respite_balance <= 100000);

DROP POLICY IF EXISTS "bb_social_messages_select" ON public.bb_social_messages;
CREATE POLICY "bb_social_messages_select" ON public.bb_social_messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_social_messages_insert" ON public.bb_social_messages;
CREATE POLICY "bb_social_messages_insert" ON public.bb_social_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(trim(message)) BETWEEN 1 AND 280);

DROP POLICY IF EXISTS "bb_npc_merchants_select" ON public.bb_npc_merchants;
CREATE POLICY "bb_npc_merchants_select" ON public.bb_npc_merchants
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_npc_merchants_upsert" ON public.bb_npc_merchants;
CREATE POLICY "bb_npc_merchants_upsert" ON public.bb_npc_merchants
  FOR ALL TO anon, authenticated
  USING (merchant_id IN ('lobby_cafe', 'beach_house'))
  WITH CHECK (merchant_id IN ('lobby_cafe', 'beach_house'));

DROP POLICY IF EXISTS "bb_house_interiors_select" ON public.bb_house_interiors;
CREATE POLICY "bb_house_interiors_select" ON public.bb_house_interiors
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_house_interiors_upsert" ON public.bb_house_interiors;
CREATE POLICY "bb_house_interiors_upsert" ON public.bb_house_interiors
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(owner_near_account) BETWEEN 2 AND 64);

DROP POLICY IF EXISTS "bb_house_interiors_update" ON public.bb_house_interiors;
CREATE POLICY "bb_house_interiors_update" ON public.bb_house_interiors
  FOR UPDATE TO anon, authenticated
  USING (char_length(owner_near_account) BETWEEN 2 AND 64)
  WITH CHECK (daylight_hour >= 0 AND daylight_hour <= 24);

DROP POLICY IF EXISTS "bb_fish_listings_select" ON public.bb_fish_listings;
CREATE POLICY "bb_fish_listings_select" ON public.bb_fish_listings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_fish_listings_write" ON public.bb_fish_listings;
CREATE POLICY "bb_fish_listings_write" ON public.bb_fish_listings
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (price_respite >= 1 AND price_respite <= 100000);

DROP POLICY IF EXISTS "bb_market_transactions_select" ON public.bb_market_transactions;
CREATE POLICY "bb_market_transactions_select" ON public.bb_market_transactions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_market_transactions_insert" ON public.bb_market_transactions;
CREATE POLICY "bb_market_transactions_insert" ON public.bb_market_transactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    currency IN ('LUL', 'CYON', 'GOLD')
    OR (currency IN ('RESPITE', 'NEAR') AND near_tx_hash IS NOT NULL AND char_length(near_tx_hash) > 0)
  );

DROP POLICY IF EXISTS "bb_gamepass_nfts_select" ON public.bb_gamepass_nfts;
CREATE POLICY "bb_gamepass_nfts_select" ON public.bb_gamepass_nfts
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_gamepass_nfts_upsert" ON public.bb_gamepass_nfts;
CREATE POLICY "bb_gamepass_nfts_upsert" ON public.bb_gamepass_nfts
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (treasury_respite >= 0 AND treasury_respite <= 100000);

DROP POLICY IF EXISTS "bb_base_plots_select" ON public.bb_base_plots;
CREATE POLICY "bb_base_plots_select" ON public.bb_base_plots
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_base_plots_upsert" ON public.bb_base_plots;
CREATE POLICY "bb_base_plots_upsert" ON public.bb_base_plots
  FOR ALL TO anon, authenticated
  USING (plot_key <> 'blue_0')
  WITH CHECK (plot_key <> 'blue_0' AND is_model_estate = false);

-- Remove legacy off-chain RESPITE credit RPC: `market.buddiesblitz.testnet` (`ft_balance_of`)
-- is the sole authoritative Source of Truth for `RESPITE`; Supabase only mirrors read-cache snapshots.
DROP FUNCTION IF EXISTS public.bb_credit_respite_recipient(text, numeric);

-- Enable Supabase Realtime idempotently across live game tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bb_profiles',
    'bb_base_plots',
    'bb_npc_merchants',
    'bb_market_transactions',
    'bb_house_interiors',
    'bb_social_messages',
    'bb_fish_listings'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- SECURITY HARDENING (applied to live project 2026-11-11)
-- 1) Player emails are extracted from bb_profiles into the locked table
--    bb_profile_contacts (RLS on, all privileges revoked for anon/authenticated),
--    so the public REST API can never read them. A trigger keeps bb_profiles.email
--    permanently NULL and captures new emails into the locked table.
-- 2) Lookup by email stays possible only through the SECURITY DEFINER RPC
--    bb_lookup_account_by_email(p_email), which returns just the NEAR account id
--    for an exact email match.
-- 3) The former *_mvp_access ALL policies are replaced by per-command policies
--    (SELECT/INSERT/UPDATE only). No role can DELETE profiles, merchants,
--    interiors, gamepass NFTs, or base plots through the API anymore.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bb_profile_contacts (
  near_account_id text PRIMARY KEY,
  email text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bb_profile_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bb_profile_contacts FROM anon, authenticated;
INSERT INTO public.bb_profile_contacts (near_account_id, email)
SELECT near_account_id, lower(email) FROM public.bb_profiles WHERE email IS NOT NULL
ON CONFLICT (near_account_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
CREATE OR REPLACE FUNCTION public.bb_profiles_extract_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL AND length(trim(NEW.email)) > 3 THEN
    INSERT INTO public.bb_profile_contacts (near_account_id, email, updated_at)
    VALUES (NEW.near_account_id, lower(trim(NEW.email)), now())
    ON CONFLICT (near_account_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
    NEW.email := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bb_profiles_extract_email ON public.bb_profiles;
CREATE TRIGGER trg_bb_profiles_extract_email
BEFORE INSERT OR UPDATE ON public.bb_profiles
FOR EACH ROW EXECUTE FUNCTION public.bb_profiles_extract_email();
UPDATE public.bb_profiles SET email = NULL WHERE email IS NOT NULL;
CREATE OR REPLACE FUNCTION public.bb_lookup_account_by_email(p_email text) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT near_account_id FROM public.bb_profile_contacts
  WHERE email = lower(trim(p_email)) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.bb_lookup_account_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bb_lookup_account_by_email(text) TO anon, authenticated;
DROP POLICY IF EXISTS "bb_profiles_mvp_access" ON public.bb_profiles;
CREATE POLICY "bb_profiles_select" ON public.bb_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bb_profiles_insert" ON public.bb_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bb_profiles_update" ON public.bb_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bb_npc_merchants_mvp_access" ON public.bb_npc_merchants;
CREATE POLICY "bb_npc_merchants_select" ON public.bb_npc_merchants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bb_npc_merchants_insert" ON public.bb_npc_merchants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bb_npc_merchants_update" ON public.bb_npc_merchants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bb_house_interiors_mvp_access" ON public.bb_house_interiors;
CREATE POLICY "bb_house_interiors_select" ON public.bb_house_interiors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bb_house_interiors_insert" ON public.bb_house_interiors FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bb_house_interiors_update" ON public.bb_house_interiors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bb_gamepass_nfts_mvp_access" ON public.bb_gamepass_nfts;
CREATE POLICY "bb_gamepass_nfts_select" ON public.bb_gamepass_nfts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bb_gamepass_nfts_insert" ON public.bb_gamepass_nfts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bb_gamepass_nfts_update" ON public.bb_gamepass_nfts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bb_base_plots_mvp_access" ON public.bb_base_plots;
CREATE POLICY "bb_base_plots_select" ON public.bb_base_plots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bb_base_plots_insert" ON public.bb_base_plots FOR INSERT TO anon, authenticated WITH CHECK (plot_key <> 'blue_0');
CREATE POLICY "bb_base_plots_update" ON public.bb_base_plots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (plot_key <> 'blue_0');

-- Relayer sybil-throttle spawn log required by `api/near-relayer.ts`
CREATE TABLE IF NOT EXISTS public.bb_relayer_spawn_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  sub_account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bb_relayer_spawn_log_ip_created_idx
  ON public.bb_relayer_spawn_log (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS bb_relayer_spawn_log_created_idx
  ON public.bb_relayer_spawn_log (created_at DESC);

ALTER TABLE public.bb_relayer_spawn_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bb_relayer_spawn_log_select" ON public.bb_relayer_spawn_log;
CREATE POLICY "bb_relayer_spawn_log_select" ON public.bb_relayer_spawn_log
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bb_relayer_spawn_log_insert" ON public.bb_relayer_spawn_log;
CREATE POLICY "bb_relayer_spawn_log_insert" ON public.bb_relayer_spawn_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(ip_hash) = 64 AND char_length(sub_account_id) BETWEEN 3 AND 64);
