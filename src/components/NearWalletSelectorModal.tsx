import React, { useState } from 'react';
import {
  NEAR_CONFIG,
  connectNearWalletSelector,
  connectWithNearConnectorModal,
  disconnectNearWallet,
  getNearBlocksAccountUrl,
  isActiveWalletReadOnlyObserver,
  isCitizenSubAccountId,
  setActiveWalletAuthKind,
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
  onDisconnectAccount?: () => void;
  onSelectGoogleAutoRegister?: () => void;
}

export const NearWalletSelectorModal: React.FC<NearWalletSelectorModalProps> = ({
  isOpen,
  onClose,
  currentWalletId,
  onConnectAccount,
  onDisconnectAccount,
  onSelectGoogleAutoRegister,
}) => {
  const [citizenHandleInput, setCitizenHandleInput] = useState<string>('');
  const [accountInput, setAccountInput] = useState<string>(currentWalletId ?? '');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isReadOnlyObserver =
    Boolean(currentWalletId) &&
    isActiveWalletReadOnlyObserver() &&
    !isCitizenSubAccountId(currentWalletId ?? '');

  const handleOpenNearConnectorPopup = async () => {
    soundEngine.playUiClick();
    setErrorMessage(null);
    setStatusBanner('Opening NEAR Testnet Wallet Selector (Meteor Web, MyNearWallet, Intear)...');
    setIsConnecting(true);
    try {
      const result = await connectWithNearConnectorModal('testnet');
      const net: NearNetworkId = result.accountId.endsWith('.near') ? 'mainnet' : 'testnet';
      onConnectAccount(result.accountId, 'wallet_selector', net);
      setStatusBanner(null);
      onClose();
    } catch (err) {
      setStatusBanner(null);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Wallet connection was cancelled. Select Meteor Wallet (Web) in the popup to create or connect a Testnet wallet.',
      );
    } finally {
      setIsConnecting(false);
    }
  };

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
      setActiveWalletAuthKind('citizen-subaccount');
      onConnectAccount(res.subAccountId, 'social_invisible', 'testnet');
      setStatusBanner(null);
      onClose();
    } catch (err) {
      setStatusBanner(null);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to create wallet right now.',
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleInspectReadOnlyAccount = async (explicitAccount?: string) => {
    soundEngine.playUiClick();
    setErrorMessage(null);
    setStatusBanner(null);
    setIsConnecting(true);
    try {
      const result = await connectNearWalletSelector(explicitAccount ?? accountInput, {
        requireWalletSignature: false,
      });
      const net: NearNetworkId = result.accountId.endsWith('.near') ? 'mainnet' : 'testnet';
      onConnectAccount(result.accountId, 'wallet_selector', net);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Account not found.',
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    soundEngine.playUiClick();
    await disconnectNearWallet();
    onDisconnectAccount?.();
    setStatusBanner('Wallet disconnected.');
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
      aria-label="Wallet Connection"
      data-near-wallet-selector-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 select-none"
    >
      <div className="relative w-full max-w-md bg-white border-[4px] border-[#0d0f12] shadow-[8px_8px_0px_#0d0f12] p-5 text-[#0d0f12] max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b-[3px] border-[#0d0f12] pb-3">
          <div>
            <div className="inline-block px-2 py-0.5 bg-[#b8ff3c] border-2 border-[#0d0f12] text-[10px] font-black uppercase tracking-wider">
              BUDDIES BLITZ
            </div>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">
              CONNECT WALLET
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
          {currentWalletId && (
            <div
              className={`p-2.5 border-2 border-[#0d0f12] flex items-center justify-between gap-2 ${
                isReadOnlyObserver ? 'bg-[#fef3c7]' : 'bg-[#ecfdf5]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 border border-[#0d0f12] bg-white">
                    {isReadOnlyObserver ? 'VIEW ONLY' : 'CONNECTED'}
                  </span>
                  <a
                    href={getNearBlocksAccountUrl(currentWalletId, 'testnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-black underline text-[#0284c7]"
                  >
                    Explorer
                  </a>
                </div>
                <div className="mt-1 text-xs font-mono font-black truncate text-[#0d0f12]">
                  {currentWalletId}
                </div>
                {isReadOnlyObserver && (
                  <div className="text-[10px] font-bold text-[#92400e] mt-0.5">
                    View-only mode cannot sign transactions. Connect a wallet below.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                className="px-2 py-1 bg-[#fee2e2] hover:bg-[#fecaca] border-2 border-[#0d0f12] text-[10px] font-black uppercase text-[#991b1b] shrink-0 cursor-pointer"
              >
                SWITCH
              </button>
            </div>
          )}

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

          {/* Option 1: Create In-Game Wallet (primary) */}
          <div className="p-3 bg-[#f0fdf4] border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0d0f12]">
                CREATE WALLET
              </span>
              <span className="px-1.5 py-0.5 bg-[#b8ff3c] border border-[#0d0f12] text-[9px] font-black uppercase">
                RECOMMENDED
              </span>
            </div>
            <p className="text-[11px] font-bold text-[#334155] leading-snug">
              Sign in with Google or choose a wallet username below.
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
                className="w-full py-2.5 px-3 bg-[#b8ff3c] hover:bg-[#d2ff7a] text-[#0d0f12] border-2 border-[#0d0f12] shadow-[0_3px_0_#0d0f12] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONTINUE WITH GOOGLE</span>
              </button>
            )}

            <form onSubmit={handleProvisionCitizenSubAccount} className="space-y-1.5 pt-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#0d0f12]">
                WALLET USERNAME
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={citizenHandleInput}
                  onChange={(e) => setCitizenHandleInput(e.target.value)}
                  placeholder="sakura01"
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
                  CREATE
                </button>
              </div>
              {cleanedHandlePreview.length >= 2 && (
                <div className="text-[10px] font-mono font-bold text-emerald-800">
                  {cleanedHandlePreview}.{NEAR_CONFIG.masterAccountId}
                </div>
              )}
            </form>
          </div>

          {/* Option 2: External NEAR Wallet (secondary, optional) */}
          <div className="p-3 bg-[#f8fafc] border-[2.5px] border-[#0d0f12] shadow-[0_3px_0_#0d0f12] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0d0f12]">
                EXTERNAL WALLET
              </span>
              <span className="px-1.5 py-0.5 bg-slate-300 border border-[#0d0f12] text-[9px] font-black uppercase">
                OPTIONAL
              </span>
            </div>
            <p className="text-[11px] font-bold text-[#334155] leading-snug">
              Already have a NEAR wallet? Connect Meteor, MyNearWallet, or Intear instead.
            </p>

            <button
              type="button"
              data-wallet-option="near-connect-modal"
              disabled={isConnecting}
              onClick={() => void handleOpenNearConnectorPopup()}
              className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-[#0d0f12] border-2 border-[#0d0f12] shadow-[0_2px_0_#0d0f12] font-black text-[11px] uppercase tracking-wider cursor-pointer"
            >
              {isConnecting ? 'OPENING...' : 'CONNECT EXTERNAL WALLET'}
            </button>
          </div>

          {/* Option 3: View Account */}
          <div className="p-3 bg-[#f8fafc] border-[2px] border-slate-400 space-y-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleInspectReadOnlyAccount(accountInput);
              }}
              className="space-y-1.5"
            >
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                VIEW ACCOUNT (READ ONLY)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  data-wallet-account-input="true"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  placeholder="username.buddiesblitz.testnet"
                  className="flex-1 px-2.5 py-1.5 bg-white border-2 border-[#0d0f12] text-xs font-bold text-[#0d0f12] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isConnecting || !accountInput.trim()}
                  data-wallet-connect-submit="true"
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-[#0d0f12] border-2 border-[#0d0f12] font-black text-[11px] uppercase cursor-pointer"
                >
                  {isConnecting ? '...' : 'VIEW'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
