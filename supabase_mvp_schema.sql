-- Buddies Blitz MVP Database Schema (Dedicated Supabase Project)
-- Run this script once in the Supabase SQL Editor for your new Buddies Blitz project.

-- 1. Player Profiles (Basic balances & owned items)
CREATE TABLE IF NOT EXISTS public.bb_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  near_account_id text UNIQUE NOT NULL CHECK (char_length(near_account_id) BETWEEN 2 AND 64),
  auth_mode text NOT NULL DEFAULT 'social_invisible',
  display_name text NOT NULL DEFAULT 'COMMANDER' CHECK (char_length(display_name) BETWEEN 1 AND 48),
  email text,
  lul_balance numeric NOT NULL DEFAULT 120 CHECK (lul_balance >= 0 AND lul_balance <= 1000000),
  cyon_balance numeric NOT NULL DEFAULT 95 CHECK (cyon_balance >= 0 AND cyon_balance <= 1000000),
  respite_balance numeric NOT NULL DEFAULT 25 CHECK (respite_balance >= 0 AND respite_balance <= 100000),
  warzone_gold numeric NOT NULL DEFAULT 600 CHECK (warzone_gold >= 0 AND warzone_gold <= 1000000),
  owned_token_ids jsonb NOT NULL DEFAULT '["nep245:theme:japanese_zen"]'::jsonb,
  unlocked_skins jsonb NOT NULL DEFAULT '["default"]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Social & Radius Chat Messages
CREATE TABLE IF NOT EXISTS public.bb_social_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL CHECK (char_length(sender_name) BETWEEN 1 AND 48),
  sender_near_account text,
  recipient_name text,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 280),
  bubble_color text NOT NULL DEFAULT '#38bdf8' CHECK (char_length(bubble_color) <= 16),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. NPC Merchants / Shop State
CREATE TABLE IF NOT EXISTS public.bb_npc_merchants (
  merchant_id text PRIMARY KEY CHECK (merchant_id IN ('lobby_cafe', 'beach_house')),
  npc_name text NOT NULL,
  near_wallet_address text NOT NULL,
  cyon_treasury numeric NOT NULL DEFAULT 300 CHECK (cyon_treasury >= 0 AND cyon_treasury <= 5000000),
  respite_treasury numeric NOT NULL DEFAULT 45 CHECK (respite_treasury >= 0 AND respite_treasury <= 500000),
  is_bankrupt boolean NOT NULL DEFAULT false,
  stock_by_item jsonb NOT NULL DEFAULT '{}'::jsonb,
  recent_demand_by_item jsonb NOT NULL DEFAULT '{}'::jsonb,
  investors jsonb NOT NULL DEFAULT '[]'::jsonb,
  simulated_day integer NOT NULL DEFAULT 1 CHECK (simulated_day >= 1 AND simulated_day <= 100000),
  last_headline text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. House Interior Studio State
CREATE TABLE IF NOT EXISTS public.bb_house_interiors (
  owner_near_account text PRIMARY KEY CHECK (char_length(owner_near_account) BETWEEN 2 AND 64),
  active_theme_id text NOT NULL DEFAULT 'theme_japanese_zen',
  daylight_hour numeric NOT NULL DEFAULT 14 CHECK (daylight_hour >= 0 AND daylight_hour <= 24),
  placed_furniture jsonb NOT NULL DEFAULT '[]'::jsonb,
  mood_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Optional: Market Transactions & Gamepass/Base Tables (for full economy persistence)
CREATE TABLE IF NOT EXISTS public.bb_market_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text,
  actor_near_account text NOT NULL CHECK (char_length(actor_near_account) BETWEEN 2 AND 64),
  action_type text NOT NULL,
  item_id text,
  nep245_token_id text,
  currency text NOT NULL CHECK (currency IN ('LUL', 'CYON', 'RESPITE', 'GOLD')),
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
  treasury_respite numeric NOT NULL DEFAULT 18.5 CHECK (treasury_respite >= 0 AND treasury_respite <= 100000),
  total_earned_respite numeric NOT NULL DEFAULT 54.0,
  total_paid_out_respite numeric NOT NULL DEFAULT 35.5,
  pending_payout_respite numeric NOT NULL DEFAULT 0,
  active_access_key text NOT NULL DEFAULT 'ed25519:active_session_key',
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
  base_level integer NOT NULL DEFAULT 3,
  skin_theme_id text NOT NULL DEFAULT 'default',
  garden_preset_id text NOT NULL DEFAULT 'zen_garden',
  access_mode text NOT NULL DEFAULT 'PUBLIC',
  allowed_friends jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_harvesters jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.bb_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_npc_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_house_interiors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_market_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_gamepass_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_base_plots ENABLE ROW LEVEL SECURITY;

-- Policies for MVP Online Testing
CREATE POLICY "bb_profiles_mvp_access" ON public.bb_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bb_social_messages_select" ON public.bb_social_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bb_social_messages_insert" ON public.bb_social_messages FOR INSERT TO anon, authenticated WITH CHECK (char_length(trim(message)) BETWEEN 1 AND 280);
CREATE POLICY "bb_npc_merchants_mvp_access" ON public.bb_npc_merchants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bb_house_interiors_mvp_access" ON public.bb_house_interiors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bb_market_transactions_select" ON public.bb_market_transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bb_market_transactions_insert" ON public.bb_market_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bb_gamepass_nfts_mvp_access" ON public.bb_gamepass_nfts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bb_base_plots_mvp_access" ON public.bb_base_plots FOR ALL TO anon, authenticated USING (true) WITH CHECK (plot_key <> 'blue_0');

-- Seed Initial NPC Merchants
INSERT INTO public.bb_npc_merchants (merchant_id, npc_name, near_wallet_address, cyon_treasury, respite_treasury, is_bankrupt, stock_by_item, recent_demand_by_item, simulated_day, last_headline)
VALUES
  ('lobby_cafe', 'BRAM (Lobby Cafe Merchant)', 'bram-merchant.buddiesblitz.testnet', 320, 45, false, '{"tatami_tea_table": 4, "sakura_bonsai_pot": 5, "neon_arcade_cabinet": 2, "golden_blitz_trophy": 1}'::jsonb, '{"tatami_tea_table": 1, "sakura_bonsai_pot": 2}'::jsonb, 1, 'Lobby Cafe open for early online test.'),
  ('beach_house', 'KAI (Beach Safezone Merchant)', 'kai-merchant.buddiesblitz.testnet', 280, 40, false, '{"tatami_tea_table": 3, "sakura_bonsai_pot": 4, "neon_arcade_cabinet": 3, "golden_blitz_trophy": 1}'::jsonb, '{"neon_arcade_cabinet": 1}'::jsonb, 1, 'Beach Safezone open for early online test.')
ON CONFLICT (merchant_id) DO NOTHING;

-- Enable Supabase Realtime on Chat & Merchants
ALTER PUBLICATION supabase_realtime ADD TABLE public.bb_social_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bb_npc_merchants;
