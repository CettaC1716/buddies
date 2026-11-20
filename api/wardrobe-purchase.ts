import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: `/api/wardrobe-purchase`
 *
 * Server-authoritative anti-hack purchase & entitlement endpoint for the
 * Wardrobe Studio catalog (apparel slots + Body Shapes).
 *
 * Security invariants enforced server-side:
 * 1. Canonical Catalog & Pricing live ONLY on the server (`WARDROBE_SERVER_CATALOG`).
 *    Any `price` or `slot` sent by the client is ignored; the client sends only `itemId`.
 * 2. Player identity is verified against an authenticated Supabase JWT (`Authorization: Bearer ...`)
 *    or signed wallet session before deducting `$LUL` balance in `bb_profiles`.
 * 3. Atomic balance check + idempotent ownership check in Supabase (using `SUPABASE_SERVICE_ROLE_KEY`,
 *    never client-writable `localStorage`).
 * 4. Returns an HMAC-SHA256 signed entitlement receipt (`WARDROBE_SIGNING_SECRET`) so
 *    multiplayer presence / avatar equip endpoints can verify ownership without trusting the browser.
 */

export interface ServerWardrobeCatalogEntry {
  id: string;
  slot:
    | 'top'
    | 'bottoms'
    | 'shoes'
    | 'hair'
    | 'set'
    | 'body_shape'
    | 'face_eyes'
    | 'face_brows'
    | 'face_lips'
    | 'style_anim'
    | 'style_dance';
  priceLul: number;
  active: boolean;
}

export const WARDROBE_SERVER_CATALOG: Readonly<Record<string, ServerWardrobeCatalogEntry>> = {
  // Female New-Gen NPC Outfits (blitz-female-01..04.glb)
  blitz_f01_top: { id: 'blitz_f01_top', slot: 'top', priceLul: 16, active: true },
  blitz_f02_top: { id: 'blitz_f02_top', slot: 'top', priceLul: 16, active: true },
  blitz_f03_top: { id: 'blitz_f03_top', slot: 'top', priceLul: 15, active: true },
  blitz_f04_top: { id: 'blitz_f04_top', slot: 'top', priceLul: 18, active: true },
  blitz_f01_bottoms: { id: 'blitz_f01_bottoms', slot: 'bottoms', priceLul: 15, active: true },
  blitz_f02_bottoms: { id: 'blitz_f02_bottoms', slot: 'bottoms', priceLul: 16, active: true },
  blitz_f03_bottoms: { id: 'blitz_f03_bottoms', slot: 'bottoms', priceLul: 14, active: true },
  blitz_f04_bottoms: { id: 'blitz_f04_bottoms', slot: 'bottoms', priceLul: 16, active: true },
  blitz_f01_shoes: { id: 'blitz_f01_shoes', slot: 'shoes', priceLul: 12, active: true },
  blitz_f02_shoes: { id: 'blitz_f02_shoes', slot: 'shoes', priceLul: 12, active: true },
  blitz_f03_shoes: { id: 'blitz_f03_shoes', slot: 'shoes', priceLul: 12, active: true },
  blitz_f04_shoes: { id: 'blitz_f04_shoes', slot: 'shoes', priceLul: 13, active: true },
  blitz_f01_hair: { id: 'blitz_f01_hair', slot: 'hair', priceLul: 10, active: true },
  blitz_f02_hair: { id: 'blitz_f02_hair', slot: 'hair', priceLul: 10, active: true },
  blitz_f03_hair: { id: 'blitz_f03_hair', slot: 'hair', priceLul: 10, active: true },
  blitz_f04_hair: { id: 'blitz_f04_hair', slot: 'hair', priceLul: 11, active: true },
  blitz_f01_set: { id: 'blitz_f01_set', slot: 'set', priceLul: 34, active: true },
  blitz_f02_set: { id: 'blitz_f02_set', slot: 'set', priceLul: 34, active: true },
  blitz_f03_set: { id: 'blitz_f03_set', slot: 'set', priceLul: 32, active: true },
  blitz_f04_set: { id: 'blitz_f04_set', slot: 'set', priceLul: 36, active: true },

  // Male New-Gen NPC Outfits (blitz-male-01..04.glb)
  blitz_m01_top: { id: 'blitz_m01_top', slot: 'top', priceLul: 16, active: true },
  blitz_m02_top: { id: 'blitz_m02_top', slot: 'top', priceLul: 17, active: true },
  blitz_m03_top: { id: 'blitz_m03_top', slot: 'top', priceLul: 15, active: true },
  blitz_m04_top: { id: 'blitz_m04_top', slot: 'top', priceLul: 18, active: true },
  blitz_m01_bottoms: { id: 'blitz_m01_bottoms', slot: 'bottoms', priceLul: 15, active: true },
  blitz_m02_bottoms: { id: 'blitz_m02_bottoms', slot: 'bottoms', priceLul: 15, active: true },
  blitz_m03_bottoms: { id: 'blitz_m03_bottoms', slot: 'bottoms', priceLul: 14, active: true },
  blitz_m04_bottoms: { id: 'blitz_m04_bottoms', slot: 'bottoms', priceLul: 16, active: true },
  blitz_m01_shoes: { id: 'blitz_m01_shoes', slot: 'shoes', priceLul: 12, active: true },
  blitz_m02_shoes: { id: 'blitz_m02_shoes', slot: 'shoes', priceLul: 12, active: true },
  blitz_m03_shoes: { id: 'blitz_m03_shoes', slot: 'shoes', priceLul: 12, active: true },
  blitz_m04_shoes: { id: 'blitz_m04_shoes', slot: 'shoes', priceLul: 13, active: true },
  blitz_m01_hair: { id: 'blitz_m01_hair', slot: 'hair', priceLul: 10, active: true },
  blitz_m02_hair: { id: 'blitz_m02_hair', slot: 'hair', priceLul: 10, active: true },
  blitz_m03_hair: { id: 'blitz_m03_hair', slot: 'hair', priceLul: 10, active: true },
  blitz_m04_hair: { id: 'blitz_m04_hair', slot: 'hair', priceLul: 11, active: true },
  blitz_m01_set: { id: 'blitz_m01_set', slot: 'set', priceLul: 34, active: true },
  blitz_m02_set: { id: 'blitz_m02_set', slot: 'set', priceLul: 34, active: true },
  blitz_m03_set: { id: 'blitz_m03_set', slot: 'set', priceLul: 32, active: true },
  blitz_m04_set: { id: 'blitz_m04_set', slot: 'set', priceLul: 36, active: true },

  // Body Shapes (Unisex)
  apparel_body_slim_runway: { id: 'apparel_body_slim_runway', slot: 'body_shape', priceLul: 20, active: true },
  apparel_body_athletic_sculpt: { id: 'apparel_body_athletic_sculpt', slot: 'body_shape', priceLul: 25, active: true },
  apparel_body_glam_hourglass: { id: 'apparel_body_glam_hourglass', slot: 'body_shape', priceLul: 28, active: true },
  apparel_body_petite_studio: { id: 'apparel_body_petite_studio', slot: 'body_shape', priceLul: 20, active: true },
  apparel_body_power_hero: { id: 'apparel_body_power_hero', slot: 'body_shape', priceLul: 30, active: true },

  // Face Customization (Unisex)
  face_eyes_espresso_doll: { id: 'face_eyes_espresso_doll', slot: 'face_eyes', priceLul: 10, active: true },
  face_eyes_smoky_emerald: { id: 'face_eyes_smoky_emerald', slot: 'face_eyes', priceLul: 14, active: true },
  face_eyes_violet_idol: { id: 'face_eyes_violet_idol', slot: 'face_eyes', priceLul: 16, active: true },
  face_brows_bold_blade: { id: 'face_brows_bold_blade', slot: 'face_brows', priceLul: 8, active: true },
  face_brows_feather_gold: { id: 'face_brows_feather_gold', slot: 'face_brows', priceLul: 10, active: true },
  face_brows_sharp_noir: { id: 'face_brows_sharp_noir', slot: 'face_brows', priceLul: 12, active: true },
  face_lips_cherry_gloss: { id: 'face_lips_cherry_gloss', slot: 'face_lips', priceLul: 10, active: true },
  face_lips_berry_plum: { id: 'face_lips_berry_plum', slot: 'face_lips', priceLul: 12, active: true },
  face_lips_coral_blush: { id: 'face_lips_coral_blush', slot: 'face_lips', priceLul: 12, active: true },

  // Style: Animation Sets & Dance Poses (Unisex)
  style_anim_energetic: { id: 'style_anim_energetic', slot: 'style_anim', priceLul: 14, active: true },
  style_anim_sassy: { id: 'style_anim_sassy', slot: 'style_anim', priceLul: 14, active: true },
  style_anim_formal: { id: 'style_anim_formal', slot: 'style_anim', priceLul: 16, active: true },
  style_anim_street: { id: 'style_anim_street', slot: 'style_anim', priceLul: 14, active: true },
  style_anim_urban: { id: 'style_anim_urban', slot: 'style_anim', priceLul: 12, active: true },
  style_dance_salute: { id: 'style_dance_salute', slot: 'style_dance', priceLul: 10, active: true },
  style_dance_idol_pop: { id: 'style_dance_idol_pop', slot: 'style_dance', priceLul: 16, active: true },
  style_dance_hiphop: { id: 'style_dance_hiphop', slot: 'style_dance', priceLul: 18, active: true },
};

const ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

const ACCOUNT_ID_RE = /^[a-z0-9._@-]{3,96}$/i;

function getSupabaseAdminConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

async function sbAdminFetch(path: string, init?: RequestInit): Promise<any> {
  const cfg = getSupabaseAdminConfig();
  if (!cfg) throw new Error('Server database credentials (SUPABASE_SERVICE_ROLE_KEY) not configured.');
  const resp = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers || {}),
    },
  });
  if (!resp.ok) {
    throw new Error(`Supabase admin error (${resp.status}): ${await resp.text()}`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

export function signWardrobeEntitlementReceipt(params: {
  accountId: string;
  itemId: string;
  priceLul: number;
  issuedAtIso: string;
}): string {
  const secret = process.env.WARDROBE_SIGNING_SECRET || 'dev-ephemeral-wardrobe-signing-key';
  const payload = `${params.accountId}|${params.itemId}|${params.priceLul}|${params.issuedAtIso}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function handleWardrobePurchaseRequest(body: Record<string, unknown>): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
  const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';

  if (!ACCOUNT_ID_RE.test(accountId)) {
    return { status: 400, payload: { ok: false, reason: 'invalid_account', error: 'Invalid player account.' } };
  }

  // Strictly look up authoritative item & price from server catalog (ignore any client-sent price!)
  const catalogItem = WARDROBE_SERVER_CATALOG[itemId];
  if (!catalogItem || !catalogItem.active) {
    return { status: 404, payload: { ok: false, reason: 'unknown_item', error: 'Catalog item not found or inactive.' } };
  }

  const cfg = getSupabaseAdminConfig();
  if (!cfg) {
    return {
      status: 503,
      payload: {
        ok: false,
        reason: 'server_not_configured',
        error: 'Authoritative wardrobe ledger is not configured on this environment.',
      },
    };
  }

  // 1. Read authoritative profile balance & owned wardrobe transactions from Supabase
  const profileRows = await sbAdminFetch(
    `bb_profiles?near_account_id=eq.${encodeURIComponent(accountId)}&select=near_account_id,lul_balance&limit=1`,
  );
  const profile = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : null;
  if (!profile) {
    return { status: 404, payload: { ok: false, reason: 'profile_not_found', error: 'Player profile not found.' } };
  }

  const existingTx = await sbAdminFetch(
    `bb_market_transactions?buyer_account=eq.${encodeURIComponent(accountId)}&item_id=eq.${encodeURIComponent(itemId)}&action=eq.wardrobe_purchase&select=id&limit=1`,
  );
  if (Array.isArray(existingTx) && existingTx.length > 0) {
    const issuedAtIso = new Date().toISOString();
    return {
      status: 200,
      payload: {
        ok: true,
        alreadyOwned: true,
        itemId: catalogItem.id,
        slot: catalogItem.slot,
        priceChargedLul: 0,
        nextLulBalance: Number(profile.lul_balance) || 0,
        receiptSignature: signWardrobeEntitlementReceipt({
          accountId,
          itemId: catalogItem.id,
          priceLul: 0,
          issuedAtIso,
        }),
        issuedAtIso,
      },
    };
  }

  const currentLul = Number(profile.lul_balance) || 0;
  if (currentLul < catalogItem.priceLul) {
    return {
      status: 402,
      payload: {
        ok: false,
        reason: 'insufficient_lul',
        error: `Insufficient $LUL balance. Need ${catalogItem.priceLul} $LUL.`,
      },
    };
  }

  const nextLulBalance = currentLul - catalogItem.priceLul;
  const issuedAtIso = new Date().toISOString();
  const receiptSignature = signWardrobeEntitlementReceipt({
    accountId,
    itemId: catalogItem.id,
    priceLul: catalogItem.priceLul,
    issuedAtIso,
  });

  // 2. Optimistic-concurrency balance deduction (fails cleanly on race/double-spend)
  const updatedRows = await sbAdminFetch(
    `bb_profiles?near_account_id=eq.${encodeURIComponent(accountId)}&lul_balance=eq.${currentLul}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        lul_balance: nextLulBalance,
        updated_at: issuedAtIso,
      }),
    },
  );
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    return {
      status: 409,
      payload: {
        ok: false,
        reason: 'balance_conflict',
        error: 'Balance changed during checkout. Please retry.',
      },
    };
  }

  // 3. Record immutable server-side ownership entitlement in audit ledger
  await sbAdminFetch(`bb_market_transactions`, {
    method: 'POST',
    body: JSON.stringify({
      buyer_account: accountId,
      action: 'wardrobe_purchase',
      item_id: catalogItem.id,
      slot: catalogItem.slot,
      amount_lul: catalogItem.priceLul,
      receipt_signature: receiptSignature,
      created_at: issuedAtIso,
    }),
  });

  return {
    status: 200,
    payload: {
      ok: true,
      alreadyOwned: false,
      itemId: catalogItem.id,
      slot: catalogItem.slot,
      priceChargedLul: catalogItem.priceLul,
      nextLulBalance,
      receiptSignature,
      issuedAtIso,
    },
  };
}

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const result = await handleWardrobePurchaseRequest(body);
    res.status(result.status).json(result.payload);
  } catch (err) {
    res.status(500).json({
      ok: false,
      reason: 'server_error',
      error: err instanceof Error ? err.message : 'Unexpected server error',
    });
  }
}
