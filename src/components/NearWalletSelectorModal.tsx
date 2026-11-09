import React, { useState } from 'react';
import {
  NEAR_WALLET_SELECTOR_OPTIONS,
  NearNetworkId,
  NearWalletSelectorOption,
  connectInjectedNearExtensionWallet,
  formatPlayerSubAccountFromMaster,
  isValidNearAccountId,
  redirectToNearWebWalletLogin,
  setCustomMasterWalletId,
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
  networkId,
  currentWalletId,
  nearTestnetBalance,
  respiteBalance,
  onConnectAccountId,
}) => {
  const [selectedOptionId, setSelectedOptionId] =
    useState<NearWalletSelectorOption['id']>('meteor-wallet');
  const [accountInput, setAccountInput] = useState<string>(currentWalletId || '');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  if (!isOpen) return null;

  const selectedOption =
    NEAR_WALLET_SELECTOR_OPTIONS.find((opt) => opt.id === selectedOptionId) ||
    NEAR_WALLET_SELECTOR_OPTIONS[0];

  const handleConnectDirectRpc = async () => {
    const clean = formatPlayerSubAccountFromMaster(accountInput);
    if (!clean || !isValidNearAccountId(clean)) {
      setStatusError('Please enter a valid username or wallet address.');
      return;
    }
    setStatusError(null);
    setIsConnecting(true);
    try {
      await onConnectAccountId(clean);
      onClose();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to connect account.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect Wallet Modal"
      data-near-wallet-selector-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-[3px] pointer-events-auto select-none"
    >
      <div className="w-full max-w-xl bg-[#12151f] text-white border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] overflow-hidden flex flex-col max-h-[88dvh]">
        {/* Top Header Bar */}
        <div className="px-4 py-3 bg-[#0f172a] border-b-[3px] border-black flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
            CONNECT WALLET
          </h2>
          <button
            type="button"
            data-close-near-selector-btn="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Close Wallet Selector"
            className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs flex items-center justify-center cursor-pointer"
          >
            <span className="skew-x-6 inline-block">X</span>
          </button>
        </div>

        {/* Two-Column Wallet Selector Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto min-h-0">
          {/* LEFT COLUMN: Wallet Providers */}
          <div className="md:col-span-5 bg-[#181c29] border-b-[3px] md:border-b-0 md:border-r-[3px] border-black p-3 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              WALLETS
            </div>

            {NEAR_WALLET_SELECTOR_OPTIONS.map((option) => {
              const isSelected = option.id === selectedOption.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  data-wallet-selector-option={option.id}
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedOptionId(option.id);
                    setStatusError(null);
                  }}
                  className={`w-full text-left p-2.5 border-2 border-black transition-all flex items-center gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0f172a] shadow-[3px_3px_0_#38bdf8] translate-x-[1px]'
                      : 'bg-[#222738] hover:bg-[#2a3045] shadow-[2px_2px_0_#000]'
                  }`}
                >
                  <div
                    style={{ backgroundColor: option.accentHex }}
                    className="-skew-x-6 w-8 h-8 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-center text-black font-black text-[9.5px] shrink-0"
                  >
                    <span className="skew-x-6 inline-block">{option.iconLabel}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black uppercase text-white truncate">
                      {option.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT COLUMN: Selected Wallet Action */}
          <div className="md:col-span-7 p-4 flex flex-col justify-between space-y-4 bg-[#12151f]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2">
                <h3 className="text-base font-black uppercase text-white">
                  {selectedOption.name}
                </h3>
                <div
                  style={{ backgroundColor: selectedOption.accentHex }}
                  className="-skew-x-6 px-2 py-0.5 border-2 border-black text-black font-black text-[9.5px] uppercase"
                >
                  <span className="skew-x-6 inline-block">{selectedOption.badge}</span>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="p-2.5 bg-[#1e293b] border-2 border-black space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase">
                  <span className="text-slate-300">ACCOUNT</span>
                  <span className="text-[#38bdf8] font-mono truncate max-w-[180px]">
                    {currentWalletId || 'Not Connected'}
                  </span>
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

              {/* Action Controls by Option Kind */}
              {selectedOption.id === 'my-near-wallet' && (
                <button
                  type="button"
                  data-selector-launch-mynearwallet="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    redirectToNearWebWalletLogin({
                      networkId,
                      provider: 'mynearwallet',
                    });
                  }}
                  className="-skew-x-6 w-full py-3 px-4 bg-[#10b981] hover:bg-[#34d399] text-black border-2 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  <span className="skew-x-6 inline-block">CONNECT MYNEARWALLET</span>
                </button>
              )}

              {selectedOption.id === 'meteor-wallet' && (
                <button
                  type="button"
                  data-selector-launch-meteor="true"
                  onClick={async () => {
                    soundEngine.playUiClick();
                    setIsConnecting(true);
                    const ext = await connectInjectedNearExtensionWallet();
                    setIsConnecting(false);
                    if (ext.connected && ext.accountId) {
                      setCustomMasterWalletId(ext.accountId);
                      await onConnectAccountId(ext.accountId);
                      onClose();
                    } else {
                      redirectToNearWebWalletLogin({
                        networkId,
                        provider: 'meteor',
                      });
                    }
                  }}
                  className="-skew-x-6 w-full py-3 px-4 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  <span className="skew-x-6 inline-block">
                    {isConnecting ? 'CONNECTING...' : 'CONNECT METEOR WALLET'}
                  </span>
                </button>
              )}

              {selectedOption.id === 'sender-extension' && (
                <button
                  type="button"
                  data-selector-launch-extension="true"
                  onClick={async () => {
                    soundEngine.playUiClick();
                    setStatusError(null);
                    setIsConnecting(true);
                    const ext = await connectInjectedNearExtensionWallet();
                    setIsConnecting(false);
                    if (ext.connected && ext.accountId) {
                      await onConnectAccountId(ext.accountId);
                      onClose();
                    } else {
                      setStatusError('No browser wallet extension detected.');
                    }
                  }}
                  className="-skew-x-6 w-full py-3 px-4 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  <span className="skew-x-6 inline-block">
                    {isConnecting ? 'CONNECTING...' : 'CONNECT EXTENSION'}
                  </span>
                </button>
              )}

              {/* Direct Account Input */}
              <div className="pt-2 border-t border-white/15 space-y-1.5">
                <div className="text-[10px] font-black uppercase text-[#b8ff3c]">
                  USERNAME OR WALLET ADDRESS
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    data-selector-account-input="true"
                    value={accountInput}
                    onChange={(e) => {
                      setAccountInput(e.target.value);
                      if (statusError) setStatusError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleConnectDirectRpc();
                      }
                    }}
                    placeholder="Enter username or wallet ID"
                    className="flex-1 min-w-0 px-3 py-2 bg-white text-black font-bold text-xs border-2 border-black focus:outline-none"
                  />
                  <button
                    type="button"
                    data-selector-bind-account-btn="true"
                    disabled={isConnecting}
                    onClick={() => void handleConnectDirectRpc()}
                    className="-skew-x-6 px-4 py-2 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0_#000] cursor-pointer shrink-0"
                  >
                    <span className="skew-x-6 inline-block">
                      {isConnecting ? 'WAIT...' : 'ENTER'}
                    </span>
                  </button>
                </div>
              </div>

              {statusError && (
                <div className="p-2 bg-[#ff3b30]/20 border border-[#ff3b30] text-[#fca5a5] text-[10.5px] font-bold">
                  {statusError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

