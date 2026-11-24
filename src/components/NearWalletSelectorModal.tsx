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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 p-4 select-none"
    >
      <div className="relative w-full max-w-md rounded-[28px] bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] text-white max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-white/12 shrink-0">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/90">
              Buddies Blitz
            </div>
            <h2 className="mt-0.5 text-lg sm:text-xl font-semibold tracking-tight text-white leading-tight">
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
            className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/22 border border-white/18 text-white/85 hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
            aria-label="Close Wallet Selector"
          >
            <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content (flat hairline-divided sections directly on smoked dark glass) */}
        <div className="px-5 pb-4 overflow-y-auto">
          {currentWalletId && (
            <div
              className={`mt-4 p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isReadOnlyObserver
                  ? 'bg-amber-500/14 border-amber-400/35'
                  : 'bg-emerald-500/14 border-emerald-400/35'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      isReadOnlyObserver ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    {isReadOnlyObserver ? 'View Only' : 'Connected'}
                  </span>
                  <span className="text-white/25">·</span>
                  <a
                    href={getNearBlocksAccountUrl(currentWalletId, 'testnet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 hover:underline"
                  >
                    Explorer
                  </a>
                </div>
                <div className="mt-1 text-xs font-mono font-semibold truncate text-white">
                  {currentWalletId}
                </div>
                {hasCitizenWallet && (
                  <div className="text-[11px] text-emerald-200/85 mt-1 leading-snug">
                    Your in-game wallet name was set when you created it and can&apos;t be
                    changed. Creating another wallet means a separate new player.
                  </div>
                )}
                {isReadOnlyObserver && (
                  <div className="text-[11px] text-amber-200/85 mt-1 leading-snug">
                    View-only mode cannot sign transactions. Press Switch to exit view mode, then connect your own wallet.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                className="px-3 py-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/32 border border-rose-400/35 text-rose-200 text-[11px] font-semibold shrink-0 transition-colors cursor-pointer"
              >
                Switch
              </button>
            </div>
          )}

          {statusBanner && (
            <div className="mt-3.5 px-3.5 py-2.5 rounded-2xl bg-sky-500/15 border border-sky-400/30 text-xs font-medium text-sky-200">
              {statusBanner}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-3.5 px-3.5 py-2.5 rounded-2xl bg-rose-500/15 border border-rose-400/35 text-xs font-medium text-rose-200"
            >
              {errorMessage}
            </div>
          )}

          {!currentWalletId && (
            <div className="divide-y divide-white/12">
              {/* Option 1: Create In-Game Wallet (primary) */}
              <section className="py-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white">
                    {hasCitizenWallet ? 'In-Game Wallet' : 'Create Wallet'}
                  </span>
                  <span className="text-[10.5px] font-semibold text-emerald-300">
                    {hasCitizenWallet ? 'Permanent' : 'Recommended'}
                  </span>
                </div>
                <p className="text-xs text-white/65 leading-relaxed">
                  {hasCitizenWallet
                    ? "Your wallet name was set when you created it and can't be changed."
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
                    className="w-full h-10 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/35 text-slate-950 shadow-[0_6px_18px_rgba(16,185,129,0.28)] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.98]"
                  >
                    <span>Continue with Google</span>
                  </button>
                )}

                {!hasCitizenWallet && (
                  <form onSubmit={handleProvisionCitizenSubAccount} className="space-y-2 pt-1.5">
                    <label className="block text-[11px] font-semibold text-white/75">
                      Wallet Username
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={citizenHandleInput}
                        onChange={(e) => setCitizenHandleInput(e.target.value)}
                        placeholder="sakura01"
                        className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-white/[0.08] border border-white/16 text-xs font-medium text-white placeholder:text-white/40 leading-normal focus:outline-none focus:ring-2 focus:ring-sky-400/45 focus:border-sky-400/70"
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
                        className="h-10 px-3.5 rounded-full bg-white/10 hover:bg-white/18 border border-white/16 text-white/90 text-[11px] font-semibold transition-colors cursor-pointer shrink-0 active:scale-95"
                      >
                        Random
                      </button>
                      <button
                        type="submit"
                        disabled={isConnecting || cleanedHandlePreview.length < 2}
                        className="h-10 px-4 rounded-full bg-sky-400 hover:bg-sky-300 disabled:bg-white/10 disabled:text-white/35 text-slate-950 text-[11px] font-bold transition-colors cursor-pointer shrink-0 active:scale-95"
                      >
                        Create
                      </button>
                    </div>
                    {cleanedHandlePreview.length >= 2 && (
                      <div className="text-[11px] font-mono font-medium text-emerald-300">
                        {cleanedHandlePreview}.{NEAR_CONFIG.masterAccountId}
                      </div>
                    )}
                  </form>
                )}
              </section>

              {/* Option 2: External NEAR Wallet (secondary, optional) */}
              <section className="py-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white">
                    External Wallet
                  </span>
                  <span className="text-[10.5px] font-medium text-white/45">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-white/65 leading-relaxed">
                  Already have a NEAR wallet? Connect Meteor, MyNearWallet, or Intear instead.
                </p>

                <button
                  type="button"
                  data-wallet-option="near-connect-modal"
                  disabled={isConnecting}
                  onClick={() => void handleOpenNearConnectorPopup()}
                  className="w-full h-10 px-4 rounded-full bg-sky-400/18 hover:bg-sky-400/28 border border-sky-300/35 disabled:bg-white/8 disabled:text-white/35 text-sky-200 font-semibold text-xs transition-colors cursor-pointer active:scale-[0.98]"
                >
                  {isConnecting ? 'Opening...' : 'Connect External Wallet'}
                </button>
              </section>

              {/* Option 3: View Account */}
              <section className="pt-4 pb-1">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleInspectReadOnlyAccount(accountInput);
                  }}
                  className="space-y-2"
                >
                  <label className="block text-[11px] font-semibold text-white/75">
                    View Account (Read Only)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      data-wallet-account-input="true"
                      value={accountInput}
                      onChange={(e) => setAccountInput(e.target.value)}
                      placeholder="username.buddiesblitz.testnet"
                      className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-white/[0.08] border border-white/16 text-xs font-medium text-white placeholder:text-white/40 leading-normal focus:outline-none focus:ring-2 focus:ring-sky-400/45 focus:border-sky-400/70"
                    />
                    <button
                      type="submit"
                      disabled={isConnecting || !accountInput.trim()}
                      data-wallet-connect-submit="true"
                      className="h-10 px-4 rounded-full bg-white/12 hover:bg-white/22 disabled:bg-white/8 disabled:text-white/35 border border-white/16 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 active:scale-95"
                    >
                      {isConnecting ? '...' : 'View'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
