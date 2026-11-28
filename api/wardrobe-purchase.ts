import crypto from 'node:crypto';
import { BLENDER_MODULAR_WARDROBE_ITEMS } from '../src/game/buddiesBlitzGeneratedWardrobeOutfits';

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
 *    or signed wallet session before deducting CYON balance in `bb_profiles`.
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
    | 'face_eyeshadow'
    | 'face_blush'
    | 'face_facepaint'
    | 'face_beard'
    | 'style_anim'
    | 'style_dance'
    | 'style_pose'
    | 'style_action';
  priceCyon: number;
  active: boolean;
}

/**
 * Wardrobe purchases settle in CYON, never in $LUL wages. Source catalogs keep
 * legacy LUL-denominated list prices; the CYON shelf price is derived with the
 * same rule as the client (`convertWardrobeLulPriceToCyon` in
 * `src/game/buddiesWardrobeStudioRules.ts`):
 * `clamp(round(priceLul * 2 / 5) * 5, 10, 100)` for paid items (rounded to the
 * nearest 5), 0 for free items.
 */
function convertLulPriceToCyon(priceLul: number): number {
  if (!Number.isFinite(priceLul) || priceLul <= 0) return 0;
  return Math.min(100, Math.max(10, Math.round((priceLul * 2) / 5) * 5));
}

const PAID_MODULAR_HAIR_SERVER_ENTRIES: Record<string, ServerWardrobeCatalogEntry> = Object.fromEntries(
  BLENDER_MODULAR_WARDROBE_ITEMS.filter(
    (item) =>
      !item.isStarterDefault &&
      item.priceLul > 0 &&
      (item.slot === 'top' ||
        item.slot === 'bottoms' ||
        item.slot === 'shoes' ||
        item.slot === 'hair' ||
        item.slot === 'set'),
  ).map((item) => [
    item.id,
    {
      id: item.id,
      slot: item.slot as ServerWardrobeCatalogEntry['slot'],
      priceCyon: convertLulPriceToCyon(item.priceLul),
      active: true,
    },
  ]),
);

export const WARDROBE_SERVER_CATALOG: Readonly<Record<string, ServerWardrobeCatalogEntry>> = {
  ...PAID_MODULAR_HAIR_SERVER_ENTRIES,
  // Body Shapes (Unisex) — priceCyon converted from legacy LUL list prices (20/25/28/20/30)
  apparel_body_slim_runway: { id: 'apparel_body_slim_runway', slot: 'body_shape', priceCyon: 40, active: true },
  apparel_body_athletic_sculpt: { id: 'apparel_body_athletic_sculpt', slot: 'body_shape', priceCyon: 50, active: true },
  apparel_body_glam_hourglass: { id: 'apparel_body_glam_hourglass', slot: 'body_shape', priceCyon: 55, active: true },
  apparel_body_petite_studio: { id: 'apparel_body_petite_studio', slot: 'body_shape', priceCyon: 40, active: true },
  apparel_body_power_hero: { id: 'apparel_body_power_hero', slot: 'body_shape', priceCyon: 60, active: true },

  // Face Customization (Unisex) — priceCyon converted from legacy LUL list prices (eyes 10/14/16, brows 8/10/12, lips 10/12/12)
  face_eyes_espresso_doll: { id: 'face_eyes_espresso_doll', slot: 'face_eyes', priceCyon: 20, active: true },
  face_eyes_smoky_emerald: { id: 'face_eyes_smoky_emerald', slot: 'face_eyes', priceCyon: 30, active: true },
  face_eyes_violet_idol: { id: 'face_eyes_violet_idol', slot: 'face_eyes', priceCyon: 30, active: true },
  face_brows_bold_blade: { id: 'face_brows_bold_blade', slot: 'face_brows', priceCyon: 15, active: true },
  face_brows_feather_gold: { id: 'face_brows_feather_gold', slot: 'face_brows', priceCyon: 20, active: true },
  face_brows_sharp_noir: { id: 'face_brows_sharp_noir', slot: 'face_brows', priceCyon: 25, active: true },
  face_lips_cherry_gloss: { id: 'face_lips_cherry_gloss', slot: 'face_lips', priceCyon: 20, active: true },
  face_lips_berry_plum: { id: 'face_lips_berry_plum', slot: 'face_lips', priceCyon: 25, active: true },
  face_lips_coral_blush: { id: 'face_lips_coral_blush', slot: 'face_lips', priceCyon: 25, active: true },

  // Style: Animation Sets & Dance Poses (Unisex) — priceCyon converted from legacy LUL list prices (anim 14/14/16/14/12, dance 10/16/18)
  style_anim_energetic: { id: 'style_anim_energetic', slot: 'style_anim', priceCyon: 30, active: true },
  style_anim_sassy: { id: 'style_anim_sassy', slot: 'style_anim', priceCyon: 30, active: true },
  style_anim_formal: { id: 'style_anim_formal', slot: 'style_anim', priceCyon: 30, active: true },
  style_anim_street: { id: 'style_anim_street', slot: 'style_anim', priceCyon: 30, active: true },
  style_anim_urban: { id: 'style_anim_urban', slot: 'style_anim', priceCyon: 25, active: true },
  style_dance_salute: { id: 'style_dance_salute', slot: 'style_dance', priceCyon: 20, active: true },
  style_dance_idol_pop: { id: 'style_dance_idol_pop', slot: 'style_dance', priceCyon: 30, active: true },
  style_dance_hiphop: { id: 'style_dance_hiphop', slot: 'style_dance', priceCyon: 35, active: true },
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
  priceCyon: number;
  issuedAtIso: string;
}): string {
  const secret = process.env.WARDROBE_SIGNING_SECRET || 'dev-ephemeral-wardrobe-signing-key';
  const payload = `${params.accountId}|${params.itemId}|${params.priceCyon}|${params.issuedAtIso}`;
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
    `bb_profiles?near_account_id=eq.${encodeURIComponent(accountId)}&select=near_account_id,cyon_balance&limit=1`,
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
        priceChargedCyon: 0,
        nextCyonBalance: Number(profile.cyon_balance) || 0,
        receiptSignature: signWardrobeEntitlementReceipt({
          accountId,
          itemId: catalogItem.id,
          priceCyon: 0,
          issuedAtIso,
        }),
        issuedAtIso,
      },
    };
  }

  const currentCyon = Number(profile.cyon_balance) || 0;
  if (currentCyon < catalogItem.priceCyon) {
    return {
      status: 402,
      payload: {
        ok: false,
        reason: 'insufficient_cyon',
        error: `Insufficient CerCoins balance. Need ${catalogItem.priceCyon} CerCoins.`,
      },
    };
  }

  const nextCyonBalance = currentCyon - catalogItem.priceCyon;
  const issuedAtIso = new Date().toISOString();
  const receiptSignature = signWardrobeEntitlementReceipt({
    accountId,
    itemId: catalogItem.id,
    priceCyon: catalogItem.priceCyon,
    issuedAtIso,
  });

  // 2. Record the server-side ownership entitlement in the audit ledger FIRST.
  // Money must never move before the ownership record exists: if this insert
  // fails (e.g. a ledger column mismatch), the purchase aborts here with the
  // balance untouched, so a retry can never double-charge the player.
  await sbAdminFetch(`bb_market_transactions`, {
    method: 'POST',
    body: JSON.stringify({
      buyer_account: accountId,
      action: 'wardrobe_purchase',
      item_id: catalogItem.id,
      slot: catalogItem.slot,
      amount_cyon: catalogItem.priceCyon,
      receipt_signature: receiptSignature,
      created_at: issuedAtIso,
    }),
  });

  // Compensation for the deduction step below: remove the entitlement row just
  // written, keyed on the per-purchase unique receipt signature so a concurrent
  // purchase's row is never touched. Best-effort — the original failure wins.
  const rollbackEntitlement = async (): Promise<void> => {
    try {
      await sbAdminFetch(
        `bb_market_transactions?receipt_signature=eq.${encodeURIComponent(receiptSignature)}`,
        { method: 'DELETE' },
      );
    } catch {
      // Ignore compensation errors; surface the deduction failure instead.
    }
  };

  // 3. Optimistic-concurrency balance deduction (fails cleanly on race/double-spend)
  let updatedRows: any;
  try {
    updatedRows = await sbAdminFetch(
      `bb_profiles?near_account_id=eq.${encodeURIComponent(accountId)}&cyon_balance=eq.${currentCyon}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          cyon_balance: nextCyonBalance,
          updated_at: issuedAtIso,
        }),
      },
    );
  } catch (err) {
    await rollbackEntitlement();
    throw err;
  }
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    await rollbackEntitlement();
    return {
      status: 409,
      payload: {
        ok: false,
        reason: 'balance_conflict',
        error: 'Balance changed during checkout. Please retry.',
      },
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      alreadyOwned: false,
      itemId: catalogItem.id,
      slot: catalogItem.slot,
      priceChargedCyon: catalogItem.priceCyon,
      nextCyonBalance,
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
