import React, { useState } from 'react';
import {
   DEFAULT_ONCHAIN_SUB_ACCOUNT_ID,
  MASTER_TREASURY_ACCOUNT_ID,
  MASTER_WALLET_ACCOUNT_ID,
  NEAR_WALLET_SELECTOR_OPTIONS,
  NearNetworkId,
  NearWalletSelectorOption,
  RESPITE_NEP141_METADATA,
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

/**
 * Game-styled adaptation of NEAR Protocol's official `@near-wallet-selector/modal-ui`
 * (`https://docs.near.org/tools/wallet-selector`).
 *
 * Features the signature 2-column NEAR Wallet Selector architecture:
 * - Left Column: "Connect Your Wallet" module list (MyNearWallet, Meteor Wallet,
 *   Sender / Injected Extension, and Direct NEAR RPC Account ID).
 * - Right Column: Provider connection detail / "What is a Wallet?" + NEP-141 `RESPITE`
 *   smart contract info (`respite.buddiesblitz.testnet`), improvised in Buddies Blitz's
 *   comic neo-brutalist aesthetic.
 */
export const NearWalletSelectorModal: React.FC<NearWalletSelectorModalProps> = ({
  isOpen,
  onClose,
  networkId,
  onChangeNetworkId,
  currentWalletId,
  nearTestnetBalance,
  respiteBalance,
  onConnectAccountId,
}) => {
  const [selectedOptionId, setSelectedOptionId] =
    useState<NearWalletSelectorOption['id']>('meteor-wallet');
  const [accountInput, setAccountInput] = useState<string>(currentWalletId || MASTER_WALLET_ACCOUNT_ID);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  if (!isOpen) return null;

  const selectedOption =
    NEAR_WALLET_SELECTOR_OPTIONS.find((opt) => opt.id === selectedOptionId) ||
    NEAR_WALLET_SELECTOR_OPTIONS[0];

  const handleConnectDirectRpc = async () => {
    const clean = formatPlayerSubAccountFromMaster(accountInput);
    if (!clean || !isValidNearAccountId(clean)) {
      setStatusError(
        'Please enter a player username (creates <name>.buddiesblitz-master.testnet) or a valid NEAR address.',
      );
      return;
    }
    setStatusError(null);
    setIsConnecting(true);
    try {
      await onConnectAccountId(clean);
      onClose();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to verify NEAR account.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NEAR Wallet Selector Modal"
      data-near-wallet-selector-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-[3px] pointer-events-auto select-none"
    >
      <div className="w-full max-w-2xl bg-[#12151f] text-white border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Top Header Bar */}
        <div className="px-4 py-3 bg-[#0f172a] border-b-[3px] border-black flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="-skew-x-12 px-2.5 py-0.5 bg-[#38bdf8] text-black border-2 border-black shadow-[2px_2px_0_#000] font-black text-[10px] uppercase tracking-wider">
              <span className="skew-x-12 inline-block">@near-wallet-selector</span>
            </span>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
              CONNECT NEAR PROTOCOL WALLET
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Network Toggle (Testnet / Mainnet) */}
            <div className="flex items-center bg-black/50 p-0.5 border border-white/20">
              <button
                type="button"
                data-selector-net-testnet="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onChangeNetworkId('testnet');
                }}
                className={`px-2 py-0.5 text-[9.5px] font-black uppercase cursor-pointer ${
                  networkId === 'testnet' ? 'bg-[#38bdf8] text-black' : 'text-white/70'
                }`}
              >
                TESTNET
              </button>
              <button
                type="button"
                data-selector-net-mainnet="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onChangeNetworkId('mainnet');
                }}
                className={`px-2 py-0.5 text-[9.5px] font-black uppercase cursor-pointer ${
                  networkId === 'mainnet' ? 'bg-[#10b981] text-black' : 'text-white/70'
                }`}
              >
                MAINNET
              </button>
            </div>

            <button
              type="button"
              data-close-near-selector-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              aria-label="Close NEAR Wallet Selector"
              className="-skew-x-6 w-8 h-8 bg-[#ff3b30] hover:bg-[#ff554a] text-white border-2 border-black shadow-[2px_2px_0_#000] font-black text-xs flex items-center justify-center cursor-pointer"
            >
              <span className="skew-x-6 inline-block">X</span>
            </button>
          </div>
        </div>

        {/* Two-Column `@near-wallet-selector/modal-ui` Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto min-h-0">
          {/* LEFT COLUMN: Wallet Module List */}
          <div className="md:col-span-5 bg-[#181c29] border-b-[3px] md:border-b-0 md:border-r-[3px] border-black p-3.5 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              SELECT WALLET MODULE ({networkId.toUpperCase()})
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
                    className="-skew-x-6 w-9 h-9 border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-center text-black font-black text-[10px] shrink-0"
                  >
                    <span className="skew-x-6 inline-block">{option.iconLabel}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black uppercase text-white truncate">
                        {option.name}
                      </span>
                      <span className="px-1.5 py-0.2 bg-black/50 text-[8.5px] font-black uppercase text-[#b8ff3c] border border-white/15 shrink-0">
                        {option.badge}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 truncate mt-0.5">
                      {option.description}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* NEP-141 Respite Smart Contract Pill */}
            <div className="mt-3 p-2.5 bg-black/45 border border-white/15 space-y-1">
              <div className="flex items-center justify-between text-[9.5px] font-black uppercase">
                <span className="text-[#d8b4fe]">NEP-141 TOKEN CONTRACT</span>
                <span className="text-[#10b981]">{RESPITE_NEP141_METADATA.spec}</span>
              </div>
              <div className="text-[10px] font-mono font-bold text-[#38bdf8] truncate">
                {networkId === 'mainnet'
                  ? RESPITE_NEP141_METADATA.contractIdMainnet
                  : RESPITE_NEP141_METADATA.contractIdTestnet}
              </div>
              <div className="text-[9.5px] font-bold text-slate-300">
                1 NEAR = {RESPITE_NEP141_METADATA.rateRespitePerNear} RESPITE (Crypto Coin)
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Selected Wallet Action Panel & Account Status */}
          <div className="md:col-span-7 p-4 sm:p-5 flex flex-col justify-between space-y-4 bg-[#12151f]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-[#38bdf8]">
                    SELECTED MODULE
                  </div>
                  <h3 className="text-base sm:text-lg font-black uppercase text-white">
                    {selectedOption.name}
                  </h3>
                </div>
                <div
                  style={{ backgroundColor: selectedOption.accentHex }}
                  className="-skew-x-6 px-2.5 py-1 border-2 border-black shadow-[2px_2px_0_#000] text-black font-black text-[10px] uppercase"
                >
                  <span className="skew-x-6 inline-block">{selectedOption.badge}</span>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-300 leading-relaxed">
                {selectedOption.description}
              </p>

              {/* Current Wallet & Crypto Balance Summary */}
              <div className="p-3 bg-[#1e293b] border-2 border-black shadow-[3px_3px_0_#000] space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase">
                  <span className="text-slate-300">ACTIVE WALLET UID</span>
                  <span className="text-[#38bdf8] font-mono">
                    {currentWalletId || 'Not Connected'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 bg-black/40 border border-white/15">
                    <div className="text-[9px] font-black uppercase text-slate-400">
                      NEAR {networkId.toUpperCase()}
                    </div>
                    <div className="text-xs font-black text-[#38bdf8]">
                      {nearTestnetBalance.toFixed(2)} NEAR
                    </div>
                  </div>
                  <div className="p-2 bg-black/40 border border-white/15">
                    <div className="text-[9px] font-black uppercase text-slate-400">
                      RESPITE (NEP-141 COIN)
                    </div>
                    <div className="text-xs font-black text-[#d8b4fe]">
                      {respiteBalance.toLocaleString()} RESPITE
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Controls by Option Kind */}
              {selectedOption.id === 'my-near-wallet' && (
                <div className="space-y-2.5 pt-1">
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
                    <span className="skew-x-6 inline-block">
                      OPEN {networkId.toUpperCase()}.MYNEARWALLET.COM
                    </span>
                  </button>
                </div>
              )}

              {selectedOption.id === 'meteor-wallet' && (
                <div className="space-y-2 pt-1">
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
                      {isConnecting ? 'CONNECTING METEOR...' : 'CONNECT METEOR CHROME WALLET'}
                    </span>
                  </button>
                  <div className="text-[10px] font-bold text-slate-300">
                    Your seed phrase remains strictly inside your Chrome Meteor Wallet extension.
                  </div>
                </div>
              )}

              {/* Quick Master Admin UID & Sub-Account Login Buttons */}
              <div className="p-2.5 bg-[#1e1b4b] border-2 border-black space-y-1.5">
                <div className="text-[10px] font-black uppercase text-[#facc15]">
                  MASTER &amp; PLAYER SUB-ACCOUNT HIERARCHY
                </div>
                <div className="text-[9.5px] font-mono text-white/85">
                  Master: {MASTER_WALLET_ACCOUNT_ID} | Treasury: {MASTER_TREASURY_ACCOUNT_ID}
                </div>
                <div className="text-[9px] font-bold text-slate-300">
                  Players without a wallet are automatically assigned &lt;name&gt;.{MASTER_WALLET_ACCOUNT_ID} with zero seed phrase. Master retains FullAccessKey control.
                </div>
                <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    data-login-default-subaccount-btn="true"
                    onClick={async () => {
                      soundEngine.playUiClick();
                      setAccountInput(DEFAULT_ONCHAIN_SUB_ACCOUNT_ID);
                      await onConnectAccountId(DEFAULT_ONCHAIN_SUB_ACCOUNT_ID);
                      onClose();
                    }}
                    className="-skew-x-6 w-full py-2 px-3 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black font-black text-[10px] uppercase tracking-wider cursor-pointer"
                  >
                    <span className="skew-x-6 inline-block">
                      ENTER AS PLAYER SUB-ACCOUNT ({DEFAULT_ONCHAIN_SUB_ACCOUNT_ID})
                    </span>
                  </button>
                  <button
                    type="button"
                    data-login-master-uid-btn="true"
                    onClick={async () => {
                      soundEngine.playUiClick();
                      setAccountInput(MASTER_WALLET_ACCOUNT_ID);
                      setCustomMasterWalletId(MASTER_WALLET_ACCOUNT_ID);
                      await onConnectAccountId(MASTER_WALLET_ACCOUNT_ID);
                      onClose();
                    }}
                    className="-skew-x-6 w-full py-2 px-3 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black font-black text-[10px] uppercase tracking-wider cursor-pointer"
                  >
                    <span className="skew-x-6 inline-block">
                      LOGIN AS MASTER UID ({MASTER_WALLET_ACCOUNT_ID}) - UNLOCKS QA &amp; TREASURY
                    </span>
                  </button>
                </div>
              </div>

              {selectedOption.id === 'sender-extension' && (
                <div className="space-y-2.5 pt-1">
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
                        setStatusError(
                          ext.error ||
                            'No injected NEAR browser extension found. Use Player Sub-Account input below.',
                        );
                      }
                    }}
                    className="-skew-x-6 w-full py-3 px-4 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[4px_4px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer"
                  >
                    <span className="skew-x-6 inline-block">
                      {isConnecting ? 'DETECTING EXTENSION...' : 'CONNECT BROWSER EXTENSION'}
                    </span>
                  </button>
                </div>
              )}

              {/* Player Sub-Account or Direct NEAR Account ID input */}
              <div className="pt-2 border-t border-white/15 space-y-2">
                <div className="text-[10px] font-black uppercase text-[#b8ff3c]">
                  CREATE OR CONNECT PLAYER SUB-ACCOUNT (NO SEED PHRASE)
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
                    placeholder="Enter username (creates <name>.buddiesblitz-master.testnet)"
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
                      {isConnecting ? 'VERIFYING...' : 'CONNECT'}
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

            {/* Footer Note on 3-Currency Separation */}
            <div className="p-2.5 bg-black/50 border border-white/15 text-[10px] font-bold text-slate-300 leading-snug">
              <strong className="text-[#fec83e]">NON-CRYPTO:</strong> LUL (Fishing and Warzone) to
              CYON (Outfits and Non-NFT items).{' '}
              <strong className="text-[#d8b4fe]">CRYPTO (NEAR):</strong> Swap NEAR Testnet and
              RESPITE (NEP-141 Smart Contract) at the Exchange Merchant.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
