import React, { useState } from 'react';
import {
  NearNetworkId,
  formatPlayerSubAccountFromMaster,
  isValidNearAccountId,
} from '../lib/nearClient';
import { soundEngine } from '../game/audio';

interface NearWalletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  networkId: NearNetworkId;
  onChangeNetworkId: (networkId: NearNetworkId) => void;
  currentWalletId: string | null;
  nearTestnetBalance: number;
  respiteBalance: number;
  onConnectAccountId: (accountId: string) => Promise<void> | void;
}

export const NearWalletSelectorModal: React.FC<NearWalletSelectorModalProps> = ({
  isOpen,
  onClose,
  currentWalletId,
  nearTestnetBalance,
  respiteBalance,
  onConnectAccountId,
}) => {
  const [emailInput, setEmailInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('bb_connected_google_email') || '';
    }
    return '';
  });
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  if (!isOpen) return null;

  const isRegistered = Boolean(currentWalletId && currentWalletId !== 'guest');
  const previewWalletAddress = emailInput.trim()
    ? formatPlayerSubAccountFromMaster(emailInput)
    : null;

  const handleRegisterWithGoogle = async () => {
    const raw = emailInput.trim().toLowerCase();
    if (!raw) {
      setStatusError('Please enter your Google email address to register.');
      return;
    }
    const cleanWallet = formatPlayerSubAccountFromMaster(raw);
    if (!cleanWallet || !isValidNearAccountId(cleanWallet)) {
      setStatusError('Please enter a valid Google email address.');
      return;
    }
    setStatusError(null);
    setIsConnecting(true);
    try {
      await onConnectAccountId(raw);
      onClose();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to register account.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Register Account Modal"
      data-near-wallet-selector-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-[3px] pointer-events-auto select-none"
    >
      <div className="w-full max-w-md bg-[#12151f] text-white border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="px-4 py-3 bg-[#0f172a] border-b-[3px] border-black flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
            {isRegistered ? 'WALLET ACCOUNT' : 'REGISTER ACCOUNT'}
          </h2>
          <button
            type="button"
            data-close-near-selector-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close Register Modal"
            className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs flex items-center justify-center cursor-pointer"
          >
            <span className="skew-x-6 inline-block">X</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {isRegistered ? (
            <div className="p-3 bg-[#1e293b] border-2 border-black space-y-2">
              <div className="text-[10px] font-black uppercase text-[#b8ff3c]">
                ACTIVE WALLET ADDRESS
              </div>
              <div className="text-xs font-mono font-black text-[#38bdf8] break-all">
                {currentWalletId}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-1.5 bg-black/40 border border-white/15">
                  <div className="text-[9px] font-black uppercase text-slate-400">NEAR</div>
                  <div className="text-xs font-black text-[#38bdf8]">
                    {nearTestnetBalance.toFixed(2)} NEAR
                  </div>
                </div>
                <div className="p-1.5 bg-black/40 border border-white/15">
                  <div className="text-[9px] font-black uppercase text-slate-400">RESPITE</div>
                  <div className="text-xs font-black text-[#d8b4fe]">
                    {respiteBalance.toLocaleString()} RESPITE
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#1e293b] border-2 border-black text-xs font-bold text-slate-200 leading-relaxed">
              Sign in with your Google account to automatically create your personal wallet and unlock the Currency Exchange and full Catalog.
            </div>
          )}

          <div className="space-y-2.5">
            <div className="text-[10px] font-black uppercase text-[#b8ff3c]">
              GOOGLE EMAIL ADDRESS
            </div>
            <input
              type="email"
              data-selector-account-input="true"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (statusError) setStatusError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleRegisterWithGoogle();
                }
              }}
              placeholder="name@gmail.com"
              className="w-full px-3 py-2.5 bg-white text-black font-bold text-xs border-2 border-black focus:outline-none"
            />

            {previewWalletAddress && (
              <div className="p-2.5 bg-[#0f172a] border border-white/20 flex items-center justify-between gap-2 text-[10px]">
                <span className="font-black uppercase text-slate-400">WALLET ADDRESS</span>
                <span className="font-mono font-bold text-[#38bdf8] truncate">
                  {previewWalletAddress}
                </span>
              </div>
            )}

            <button
              type="button"
              data-selector-bind-account-btn="true"
              disabled={isConnecting}
              onClick={() => void handleRegisterWithGoogle()}
              className="-skew-x-6 w-full py-3 px-4 bg-white hover:bg-slate-100 text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0_#000] cursor-pointer"
            >
              <span className="skew-x-6 flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>
                  {isConnecting
                    ? 'REGISTERING...'
                    : isRegistered
                      ? 'SWITCH GOOGLE ACCOUNT'
                      : 'REGISTER WITH GOOGLE'}
                </span>
              </span>
            </button>
          </div>

          {statusError && (
            <div className="p-2 bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[10.5px] font-bold">
              {statusError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
