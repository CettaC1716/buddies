import React from 'react';
import { Clock, ShieldCheck, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  canConfirmPendingTx,
  formatPendingTxCountdown,
  formatPendingTxSummary,
  getPendingTxRemainingSeconds,
  type PendingWalletTxItem,
} from '../lib/pendingWalletTxQueue';

/**
 * In-phone glassmorphism transaction confirmation modal.
 * Rendered inside the Wallet app container (never over the game world).
 * Confirm/Reject resolve the exact same localTxConfirmHandler promise in nearClient.ts.
 */

export interface InGameWalletConfirmModalProps {
  pendingTx: PendingWalletTxItem | null;
  nowMs: number;
  onConfirm: (txId: string) => void;
  onReject: (txId: string) => void;
  onClose?: () => void;
}

export const InGameWalletConfirmModal: React.FC<InGameWalletConfirmModalProps> = ({
  pendingTx,
  nowMs,
  onConfirm,
  onReject,
  onClose,
}) => {
  if (!pendingTx) return null;

  const summary = formatPendingTxSummary(pendingTx.request);
  const remainingSeconds = getPendingTxRemainingSeconds(pendingTx, nowMs);
  const isExpired = !canConfirmPendingTx(pendingTx, nowMs);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm payment in Wallet"
      data-ingame-wallet-confirm="true"
      data-ingame-wallet-confirm-expired={isExpired ? 'true' : 'false'}
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#090d16]/72 backdrop-blur-md p-3.5 select-none"
    >
      <div className="relative w-full max-w-[330px] rounded-[24px] bg-gradient-to-b from-[#171d2c]/95 via-[#111622]/94 to-[#0c101a]/96 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_64px_rgba(0,0,0,0.65)] text-white overflow-hidden">
        <div className="px-4 pt-3.5 pb-3 border-b border-white/12 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold text-amber-200">
              <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Wallet Review</span>
            </div>
            <h2 className="mt-1.5 text-base font-semibold tracking-tight text-white leading-tight">
              {isExpired ? 'Request Expired' : 'Confirm Request'}
            </h2>
            <div className="mt-0.5 text-[11px] font-mono text-white/55 truncate">
              {pendingTx.request.signerAccountId}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              aria-label="Close review"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/75 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3.5">
          {/* Expiry pill */}
          <div
            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-medium ${
              isExpired
                ? 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                : remainingSeconds <= 20
                  ? 'bg-amber-500/15 border-amber-400/35 text-amber-200'
                  : 'bg-white/[0.06] border-white/12 text-white/75'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{isExpired ? 'This request has expired' : 'Time left to confirm'}</span>
            </span>
            {!isExpired && (
              <span className="font-mono tabular-nums font-semibold">
                {formatPendingTxCountdown(remainingSeconds)}
              </span>
            )}
          </div>

          {/* Request details */}
          <div className="rounded-2xl bg-white/[0.06] border border-white/12 divide-y divide-white/10 text-xs">
            <div className="px-3.5 py-2.5 flex items-start justify-between gap-3">
              <span className="text-white/55 shrink-0">Action</span>
              <span className="font-semibold text-white text-right">{summary.actionLabel}</span>
            </div>

            {summary.amountLabel && (
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-emerald-500/10">
                <span className="text-emerald-200 font-medium shrink-0">Amount</span>
                <span className="font-mono tabular-nums font-bold text-sm text-emerald-300 text-right">
                  {summary.amountLabel}
                </span>
              </div>
            )}

            <div className="px-3.5 py-2.5 flex items-start justify-between gap-3">
              <span className="text-white/55 shrink-0">Recipient</span>
              <span className="font-mono text-white/85 text-right truncate max-w-[180px]">
                {summary.recipientLabel}
              </span>
            </div>

            {summary.detailRows.map(([label, value]) => (
              <div key={label} className="px-3.5 py-2 flex items-start justify-between gap-3">
                <span className="text-white/55 shrink-0">{label}</span>
                <span className="font-mono text-white/80 text-right truncate max-w-[180px]">
                  {value}
                </span>
              </div>
            ))}

            <div className="px-3.5 py-2 flex items-start justify-between gap-3 text-[11px]">
              <span className="text-white/50 shrink-0">Fee</span>
              <span className="text-white/70 text-right">{summary.feeNote}</span>
            </div>
          </div>

          {/* Actions */}
          {isExpired ? (
            <button
              type="button"
              data-ingame-wallet-reject="true"
              onClick={() => {
                soundEngine.playUiClick();
                onReject(pendingTx.id);
              }}
              className="w-full py-2.5 px-4 rounded-full bg-white/14 hover:bg-white/22 text-white border border-white/20 font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
            >
              Dismiss Expired Request
            </button>
          ) : (
            <div className="flex gap-2.5">
              <button
                type="button"
                data-ingame-wallet-reject="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onReject(pendingTx.id);
                }}
                className="flex-1 py-2.5 px-4 rounded-full bg-white/10 hover:bg-white/18 text-white/90 border border-white/18 font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
              >
                Reject
              </button>
              <button
                type="button"
                data-ingame-wallet-approve="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onConfirm(pendingTx.id);
                }}
                className="flex-1 py-2.5 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
              >
                Confirm
              </button>
            </div>
          )}

          <p className="text-[10.5px] text-white/50 text-center leading-relaxed">
            Nothing is sent until you tap Confirm.
          </p>
        </div>
      </div>
    </div>
  );
};
