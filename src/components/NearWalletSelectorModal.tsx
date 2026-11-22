import React, { useState } from 'react';
import { X } from 'lucide-react';
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
  // A citizen wallet's name is fixed at creation (rifallah's rule): once the
  // player has one, this modal must not offer creating another name.
  const hasCitizenWallet = isCitizenSubAccountId(currentWalletId ?? '');

  const handleOpenNearConnectorPopup = async () => {
    soundEngine.playUiClick();
    setErrorMessage(null);
    setStatusBanner('Opening NEAR Wallet menu (Meteor, MyNearWallet, Intear)...');
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
    setStatusBanner('Creating your in-game wallet...');
    setIsConnecting(true);
    try {
      const res = await spawnSubAccountOnChainViaMaster({
        handle: citizenHandleInput,
        strictUniqueHandle: true,
      });
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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 select-none"
    >
      <div className="relative w-full max-w-md rounded-[28px] bg-[#f4f6f9]/96 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] text-slate-900 max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white/95 border-b border-slate-200/80 shrink-0">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-semibold tracking-wide">
              Buddies Blitz
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-slate-900 leading-tight">
              Connect Wallet
            </h2>
          </div>

          <button
            type="button"
            data-wallet-selector-close="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Close Wallet Selector"
          >
            <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto">
          {currentWalletId && (
            <div
              className={`p-3.5 rounded-2xl border shadow-sm flex items-center justify-between gap-3 ${
                isReadOnlyObserver
                  ? 'bg-amber-50/90 border-amber-200/80'
                  : 'bg-emerald-50/80 border-emerald-200/80'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isReadOnlyObserver
                        ? 'bg-amber-200/80 text-amber-900'
                        : 'bg-emerald-200/80 text-emerald-900'
                    }`}
                  >
                    {isReadOnlyObserver ? 'View Only' : 'Connected'}
                  </span>
                  <a
                    href={getNearBlocksAccountUrl(currentWalletId, 'testnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    Explorer
                  </a>
                </div>
                <div className="mt-1.5 text-xs font-mono font-semibold truncate text-slate-900">
                  {currentWalletId}
                </div>
                {hasCitizenWallet && (
                  <div className="text-[11px] text-emerald-800/90 mt-1 leading-snug">
                    Your in-game wallet name was set when you created it and can&apos;t be
                    changed. Creating another wallet means a separate new player.
                  </div>
                )}
                {isReadOnlyObserver && (
                  <div className="text-[11px] text-amber-900/90 mt-1 leading-snug">
                    View-only mode cannot sign transactions. Press Switch to exit view mode, then connect your own wallet.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                className="px-3 py-1.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-semibold shrink-0 transition-colors cursor-pointer"
              >
                Switch
              </button>
            </div>
          )}

          {statusBanner && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-sky-50 border border-sky-200/80 text-xs font-medium text-sky-800">
              {statusBanner}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-xs font-medium text-rose-700"
            >
              {errorMessage}
            </div>
          )}

          {!currentWalletId && (<>
          {/* Option 1: Create In-Game Wallet (primary) */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/75 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">
                {hasCitizenWallet ? 'In-Game Wallet' : 'Create Wallet'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                {hasCitizenWallet ? 'Permanent' : 'Recommended'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {hasCitizenWallet
                ? 'Your wallet name was set when you created it and can\'t be changed.'
                : 'Continue with Google for automatic setup, or pick a wallet username below.'}
            </p>

            {!hasCitizenWallet && onSelectGoogleAutoRegister && (
              <button
                type="button"
                data-wallet-option="google-auto-register"
                disabled={isConnecting}
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                  onSelectGoogleAutoRegister();
                }}
                className="w-full py-2.5 px-4 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white shadow-sm font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <span>Continue with Google</span>
              </button>
            )}

            {!hasCitizenWallet && (
            <form onSubmit={handleProvisionCitizenSubAccount} className="space-y-2 pt-1 border-t border-slate-100">
              <label className="block text-[11px] font-semibold text-slate-600">
                Wallet Username
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={citizenHandleInput}
                  onChange={(e) => setCitizenHandleInput(e.target.value)}
                  placeholder="sakura01"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400"
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
                  className="px-3 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Random
                </button>
                <button
                  type="submit"
                  disabled={isConnecting || cleanedHandlePreview.length < 2}
                  className="px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Create
                </button>
              </div>
              {cleanedHandlePreview.length >= 2 && (
                <div className="text-[11px] font-mono font-medium text-emerald-700">
                  {cleanedHandlePreview}.{NEAR_CONFIG.masterAccountId}
                </div>
              )}
            </form>
            )}
          </div>

          {/* Option 2: External NEAR Wallet (secondary, optional) */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/75 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">
                External Wallet
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                Optional
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Already have a NEAR wallet? Connect Meteor, MyNearWallet, or Intear instead.
            </p>

            <button
              type="button"
              data-wallet-option="near-connect-modal"
              disabled={isConnecting}
              onClick={() => void handleOpenNearConnectorPopup()}
              className="w-full py-2.5 px-4 rounded-full bg-sky-100 hover:bg-sky-200 disabled:bg-slate-100 disabled:text-slate-400 text-sky-900 font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
            >
              {isConnecting ? 'Opening...' : 'Connect External Wallet'}
            </button>
          </div>

          {/* Option 3: View Account */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/75 shadow-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleInspectReadOnlyAccount(accountInput);
              }}
              className="space-y-2"
            >
              <label className="block text-[11px] font-semibold text-slate-600">
                View Account (Read Only)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  data-wallet-account-input="true"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  placeholder="username.buddiesblitz.testnet"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={isConnecting || !accountInput.trim()}
                  data-wallet-connect-submit="true"
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
                >
                  {isConnecting ? '...' : 'View'}
                </button>
              </div>
            </form>
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
};
