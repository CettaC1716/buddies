# Buddies Blitz 3D

WebGL 3D game client built with React 19, Three.js, TypeScript, Vite, and Supabase.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your Supabase project credentials:

```bash
cp .env.example .env
```

3. Start the development server (runs on `http://localhost:3000`):

```bash
npm run dev
```

4. Run type-checking and production build verification:

```bash
npm run lint
npm run build
```

## Environment Variables (Vercel & Local `.env`)

Configure the following variables in Vercel Project Settings > Environment Variables:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Yes | Dedicated Supabase project URL (`https://<project-ref>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Yes | Dedicated Supabase project public `anon` key. |
| `VITE_ENABLE_QC` | No | Set to `false` in production to hide the internal Quality Control (QC) testing menu by default. Set to `true` locally if needed. |
| `VITE_NEAR_NETWORK` | No | NEAR network identifier (`testnet` by default). |
| `VITE_NEAR_RPC_URL` | No | NEAR JSON-RPC endpoint (`https://rpc.testnet.near.org` by default). |

Note: Even when `VITE_ENABLE_QC=false`, developers can toggle the internal QC/Sandbox menu at runtime using the keyboard shortcut `Ctrl+Shift+Q` (Windows/Linux) or `Cmd+Shift+Q` (macOS).

## Database Setup (New Supabase Project)

1. Create a new project in the Supabase Dashboard (separate from any other project).
2. Open the SQL Editor in the Supabase Dashboard and run the contents of `supabase_mvp_schema.sql`.
3. Copy the Project URL and `anon` public key from Project Settings > API into your local `.env` and Vercel Environment Variables.

## Project Structure

```text
.
├── public/
│   └── assets/                        # Static 3D models (.glb) and textures
├── src/
│   ├── App.tsx                        # 2D HUD overlay, modals, and Supabase/NEAR state sync
│   ├── main.tsx                       # React entry point
│   ├── lib/
│   │   ├── supabaseClient.ts          # Supabase PostgreSQL & Realtime client
│   │   └── nearClient.ts              # NEAR JSON-RPC and account/token helpers
│   └── game/
│       ├── BuddiesBlitzArena.tsx      # Imperative Three.js WebGL canvas and 60fps game loop
│       ├── buddiesBlitzRules.ts       # Core gameplay, physics, vehicle, and combat rules
│       ├── buddiesMerchantPricing.ts  # Merchant inventory and pricing calculations
│       ├── SocialChatModal.tsx        # Radius and social chat UI
│       ├── CharacterProfileModal.tsx  # Player profile and wallet modal
│       ├── NpcMerchantAndHouseModal.tsx # Shop and 3D cutaway house interior UI
│       └── TacticalKioskModal.tsx     # Zone teleportation kiosk UI
├── supabase_mvp_schema.sql            # SQL schema for initializing a new Supabase project
├── vercel.json                        # Static SPA routing and .glb asset caching headers
└── vite.config.ts                     # Vite build config with vendor chunk splitting
```
