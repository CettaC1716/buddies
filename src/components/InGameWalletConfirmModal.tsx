import React from 'react';
import type { LocalTxConfirmRequest } from '../lib/nearClient';
import { soundEngine } from '../game/audio';

/**
 * In-game wallet confirmation — the local (sub-account) wallet reviews and
 * approves every transaction it signs, exactly like an external wallet
 * popup, but rendered inside the game. Rendered by App while a
 * LocalTxConfirmRequest is pending; Approve/Reject resolve the signer.
 */

const METHOD_LABELS: Record<string, string> = {
  swap_near_for_respite: 'Swap NEAR -> RESPITE',
  claim_hana_welcome_near: 'Claim Starter Pack from Hana',
  claim_hana_welcome_near_attested: 'Claim Starter Pack from Hana (Google verified)',
  buy_merchant_item: 'Buy item from Merchant Shop',
  sell_merchant_item: 'Sell item back to Merchant',
  purchase_citizen_asset: 'Buy House or Companion',
  list_property_deed: 'List House Deed for sale',
  list_property_furniture: 'List Furniture NFT for sale',
  buy_property: 'Buy listed property',
  cancel_property_listing: 'Cancel property listing',
  mint_fish_nft: 'Turn Fish into an NFT',
  mint_fish_nft_attested: 'Turn Fish into an NFT',
  list_fish_nft: 'List Fish NFT for sale',
  buy_fish_nft: 'Buy Fish NFT',
  unlist_fish_nft: 'Remove Fish NFT listing',
  ft_transfer: 'Transfer RESPITE',
  nft_transfer: 'Transfer NFT',
  mt_transfer: 'Transfer Collectible Item',
  fund_deed_royalty: 'Add to House Account',
  claim_deed_payout: 'Collect from House Account',
  authorize_deed_session_key: 'Allow House Access',
  mint_merchant_item: 'Mint Merchant Item',
};

const DETAIL_KEY_LABELS: Record<string, string> = {
  catalog_id: 'Item',
  token_id: 'Item code',
  listing_id: 'Listing',
  item_id: 'Item',
  amount: 'Amount',
  price: 'Price',
  receiver_id: 'Recipient',
};

function humanizeMethod(_methodName: string): string {
  // Unmapped methods never leak raw contract names to players.
  return 'Confirm Transaction';
}

function formatNearFromYocto(yocto: string): string {
  try {
    const raw = BigInt(yocto || '0');
    if (raw === 0n) return '0';
    const whole = raw / 10n ** 24n;
    const frac = raw % 10n ** 24n;
    const fracStr = frac.toString().padStart(24, '0').slice(0, 6).replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
  } catch {
    return '0';
  }
}

function detailRows(request: LocalTxConfirmRequest): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const args = request.args ?? {};
  const interesting = ['catalog_id', 'token_id', 'listing_id', 'item_id', 'amount', 'price', 'receiver_id'];
  for (const key of interesting) {
    const value = args[key];
    if (typeof value === 'string' || typeof value === 'number') {
      rows.push([DETAIL_KEY_LABELS[key] ?? key.replace(/_/g, ' '), String(value)]);
    }
  }
  return rows.slice(0, 3);
}

interface InGameWalletConfirmModalProps {
  request: LocalTxConfirmRequest | null;
  onApprove: () => void;
  onReject: () => void;
}

export const InGameWalletConfirmModal: React.FC<InGameWalletConfirmModalProps> = ({
  request,
  onApprove,
  onReject,
}) => {
  if (!request) return null;

  const depositNear = formatNearFromYocto(request.depositYocto);
  const hasDeposit = depositNear !== '0';
  const details = detailRows(request);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm transaction in your in-game wallet"
      data-ingame-wallet-confirm="true"
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4 select-none"
    >
      <div className="relative w-full max-w-sm bg-white border-[4px] border-[#0d0f12] shadow-[8px_8px_0px_#0d0f12] p-5 text-[#0d0f12]">
        <div className="border-b-[3px] border-[#0d0f12] pb-3">
          <div className="inline-block px-2 py-0.5 bg-[#b8ff3c] border-2 border-[#0d0f12] text-[10px] font-black uppercase tracking-wider">
            IN-GAME WALLET
          </div>
          <h2 className="mt-1.5 text-xl font-black uppercase tracking-tight leading-none">
            Confirm Transaction
          </h2>
          <div className="mt-1.5 text-[11px] font-mono font-bold text-slate-600 truncate">
            {request.signerAccountId}
          </div>
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-start justify-between gap-3">
            <span className="font-black uppercase tracking-wider text-slate-500">Action</span>
            <span className="font-black text-right">
              {METHOD_LABELS[request.methodName] ?? humanizeMethod(request.methodName)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="font-black uppercase tracking-wider text-slate-500">App</span>
            <span className="font-mono font-bold text-right truncate max-w-[210px]">
              {request.receiverId}
            </span>
          </div>
          {details.map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-3">
              <span className="font-black uppercase tracking-wider text-slate-500">{key}</span>
              <span className="font-mono font-bold text-right truncate max-w-[210px]">{value}</span>
            </div>
          ))}
          {hasDeposit && (
            <div className="flex items-start justify-between gap-3 p-2 bg-[#f0fdf4] border-2 border-[#0d0f12]">
              <span className="font-black uppercase tracking-wider">You pay</span>
              <span className="font-black text-sm">{depositNear} NEAR</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <span className="font-black uppercase tracking-wider text-slate-500">Network fee</span>
            <span className="font-bold text-right">Tiny fee (&lt; 0.01 NEAR, from balance)</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            data-ingame-wallet-reject="true"
            onClick={() => {
              soundEngine.playUiClick();
              onReject();
            }}
            className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-100 text-[#0d0f12] border-2 border-[#0d0f12] shadow-[0_3px_0_#0d0f12] font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            data-ingame-wallet-approve="true"
            onClick={() => {
              soundEngine.playUiClick();
              onApprove();
            }}
            className="flex-1 py-2.5 px-3 bg-[#b8ff3c] hover:bg-[#d2ff7a] text-[#0d0f12] border-2 border-[#0d0f12] shadow-[0_3px_0_#0d0f12] font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Approve
          </button>
        </div>

        <p className="mt-3 text-[10px] font-bold text-slate-500 text-center leading-snug">
          Confirmed safely by your in-game wallet. Nothing is sent until you approve.
        </p>
      </div>
    </div>
  );
};
