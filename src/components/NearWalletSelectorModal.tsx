import React, { useState } from 'react';
import {
  NEAR_CONFIG,
  connectNearWalletSelector,
  getMyNearWalletLoginUrl,
  spawnSubAccountOnChainViaMaster,
  type NearNetworkId,
  type NearOnboardingMode,
} from '../lib/nearClient';
import { soundEngine } from '../game/audio';

interface NearWalletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWalletId: string | null;
  onConnectAccount: (
    accountId: string,
    mode?: NearOnboardingMode,
    network?: NearNetworkId,
  ) => void;
  onSelectGoogleAutoRegister?: () => void;
}

export const NearWalletSelectorModal: React.FC<NearWalletSelectorModalProps> = ({
  isOpen,
  onClose,
  currentWalletId,
  onConnectAccount,
  onSelectGoogleAutoRegister,
}) => {
  const [citizenHandleInput, setCitizenHandleInput] = useState<string>('');
  const [accountInput, setAccountInput] = useState<string>(currentWalletId ?? '');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProvisionCitizenSubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playUiClick();
    setErrorMessage(null);
    setStatusBanner('Preparing your <handle>.buddiesblitz.testnet wallet & FunctionCall key...');
    setIsConnecting(true);
    try {
      const res = await spawnSubAccountOnChainViaMaster({ handle: citizenHandleInput });
      if (!res.ok || !res.subAccountId) {
        setErrorMessage(res.error || 'Could not create Citizen Sub-Account.');
        setStatusBanner(null);
        return;
      }
      onConnectAccount(res.subAccountId, 'social_invisible', 'testnet');
      setStatusBanner(null);
      onClose();
    } catch (err) {
      setStatusBanner(null);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to provision Citizen Sub-Account right now.',
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectExtensionOrVerifyAccount = async (
    explicitAccount?: string,
    requireSignature = false,
  ) => {
    soundEngine.playUiClick();
    setErrorMessage(null);
    setStatusBanner(null);
    setIsConnecting(true);
    try {
      const result = await connectNearWalletSelector(explicitAccount ?? accountInput, {
        requireWalletSignature: requireSignature,
      });
      const net: NearNetworkId = result.accountId.endsWith('.near') ? 'mainnet' : 'testnet';
      onConnectAccount(result.accountId, 'wallet_selector', net);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to connect NEAR wallet. Use Google OAuth / Citizen Handle above or install Meteor Wallet.',
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const cleanedHandlePreview = citizenHandleInput
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account Registration & Wallet Connection"
      data-near-wallet-selector-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 select-none"
    >
      <div className="relative w-full max-w-md bg-white border-[4px] border-[#0d0f12] shadow-[8px_8px_0px_#0d0f12] p-5 text-[#0d0f12] max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b-[3px] border-[#0d0f12] pb-3">
          <div>
            <div className="inline-block px-2 py-0.5 bg-[#b8ff3c] border-2 border-[#0d0f12] text-[10px] font-black uppercase tracking-wider">
              SEEDLESS CITIZEN ONBOARDING &amp; NEP-413 WALLET
            </div>
            <h2
              className="mt-1.5 text-xl sm:text-2xl font-black uppercase tracking-tight leading-none"
              style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}
            >
              REGISTER OR CONNECT NEAR
            </h2>
          </div>

          <button
            type="button"
            data-wallet-selector-close="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-[#0d0f12] shadow-[0_2px_0_#0d0f12] font-black text-sm flex items-center justify-center cursor-pointer"
            aria-label="Close Wallet Selector"
          >
            X
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {statusBanner && (
            <div className="p-2.5 bg-[#ecfeff] border-2 border-[#0891b2] text-[11px] font-bold text-[#0e7490]">
              {statusBanner}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-2.5 bg-[#fef2f2] border-2 border-[#ff3b30] text-[11px] font-bold text-[#991b1b]"
            >
              {errorMessage}
            </div>
          )}

          {/* Option 1: Seedless Google OAuth + Sub-Account Naming */}
          <div className="p-3 bg-[#f0fdf4] border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0d0f12]">
                1. SEEDLESS CITIZEN SUB-ACCOUNT
              </span>
              <span className="px-1.5 py-0.5 bg-[#b8ff3c] border border-[#0d0f12] text-[9px] font-black uppercase">
                FUNCTION CALL KEY
              </span>
            </div>
            <p className="text-[11px] font-bold text-[#334155] leading-snug">
              No seed phrases or gas popups. Choose a citizen handle under{' '}
              <code className="font-mono text-[10px] bg-white px-1 border border-slate-300">
                .{NEAR_CONFIG.masterAccountId}
              </code>{' '}
              or sign in with Google.
            </p>

            {onSelectGoogleAutoRegister && (
              <button
                type="button"
                data-wallet-option="google-auto-register"
                disabled={isConnecting}
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                  onSelectGoogleAutoRegister();
                }}
                className="w-full py-2 px-3 bg-[#b8ff3c] hover:bg-[#d2ff7a] text-[#0d0f12] border-2 border-[#0d0f12] shadow-[0_2.5px_0_#0d0f12] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONTINUE WITH GOOGLE OAUTH</span>
              </button>
            )}

            <form onSubmit={handleProvisionCitizenSubAccount} className="space-y-1.5 pt-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#0d0f12]">
                CHOOSE YOUR WALLET NAME
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={citizenHandleInput}
                  onChange={(e) => setCitizenHandleInput(e.target.value)}
                  placeholder="e.g. sakura01"
                  className="flex-1 px-2.5 py-1.5 bg-white border-2 border-[#0d0f12] text-xs font-bold text-[#0d0f12] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
                    let rnd = '';
                    for (let i = 0; i < 6; i++) {
                      rnd += alphabet[Math.floor(Math.random() * alphabet.length)];
                    }
                    setCitizenHandleInput(rnd);
                  }}
                  className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 border-2 border-[#0d0f12] text-[10px] font-black uppercase cursor-pointer"
                >
                  RANDOM
                </button>
                <button
                  type="submit"
                  disabled={isConnecting || cleanedHandlePreview.length < 2}
                  className="px-3 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] disabled:bg-slate-400 text-[#b8ff3c] border-2 border-[#0d0f12] text-[11px] font-black uppercase cursor-pointer"
                >
                  CREATE WALLET
                </button>
              </div>
              {cleanedHandlePreview.length >= 2 && (
                <div className="text-[10px] font-mono font-bold text-emerald-800">
                  Preview: {cleanedHandlePreview}.{NEAR_CONFIG.masterAccountId}
                </div>
              )}
            </form>
          </div>

          {/* Option 2: External NEAR Wallet Signer (NEP-413) */}
          <div className="p-3 bg-[#f8fafc] border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0d0f12]">
                2. EXTERNAL NEAR WALLET (NEP-413)
              </span>
              <span className="px-1.5 py-0.5 bg-[#38bdf8] border border-[#0d0f12] text-[9px] font-black uppercase">
                SIGNED
              </span>
            </div>

            <button
              type="button"
              data-wallet-option="browser-extension"
              disabled={isConnecting}
              onClick={() => void handleConnectExtensionOrVerifyAccount('', true)}
              className="w-full py-2 px-3 bg-[#0f172a] hover:bg-[#1e293b] text-white border-2 border-[#0d0f12] shadow-[0_2px_0_#0d0f12] font-black text-[11px] uppercase tracking-wider cursor-pointer"
            >
              {isConnecting ? 'SIGNING CHALLENGE...' : 'SIGN IN WITH METEOR / SENDER EXTENSION'}
            </button>

            <a
              href={getMyNearWalletLoginUrl('testnet')}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-center border-2 border-[#0d0f12] text-[10px] font-black uppercase tracking-wider text-[#0d0f12]"
            >
              OPEN MYNEARWALLET TESTNET SIGNER ↗
            </a>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConnectExtensionOrVerifyAccount(accountInput, false);
              }}
              className="space-y-1.5 pt-1.5 border-t border-slate-300"
            >
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                INSPECT EXISTING TESTNET ACCOUNT (READ-ONLY RPC LOOKUP)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  data-wallet-account-input="true"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  placeholder="kxvqmr.buddiesblitz.testnet"
                  className="flex-1 px-2.5 py-1.5 bg-white border-2 border-[#0d0f12] text-xs font-bold text-[#0d0f12] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isConnecting || !accountInput.trim()}
                  data-wallet-connect-submit="true"
                  className="px-3 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] disabled:bg-slate-300 text-[#0d0f12] border-2 border-[#0d0f12] shadow-[0_2px_0_#0d0f12] font-black text-xs uppercase cursor-pointer"
                >
                  {isConnecting ? '...' : 'INSPECT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
