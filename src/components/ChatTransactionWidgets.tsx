import React, { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  Coins,
  Eye,
  Gift,
  Home,
  LogIn,
  MapPin,
  ShoppingBag,
  Sofa,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import {
  CITY_TRANSIT_DESTINATIONS,
  type CityTransitDestinationSpec,
  type CityTransitStationId,
} from '../game/buddiesBlitzRules';
import {
  MERCHANT_CATALOG_ITEMS,
  MerchantAgentMarketState,
  MerchantCatalogItem,
  MerchantLocationId,
  NpcChatTransactionIntent,
  evaluateLulToCyonExchangeQuote,
  evaluateMerchantItemQuote,
} from '../game/buddiesMerchantPricing';
import { soundEngine } from '../game/audio';
import {
  HOUSE_OWNERSHIP_PRICE_RESPITE,
  RESPITE_NEP141_METADATA,
  getLastNearTransactionError,
  getNearBlocksTxUrl,
  isActiveWalletReadOnlyObserver,
  isCitizenSubAccountId,
  type NearRespiteSwapReceipt,
} from '../lib/nearClient';
import { Furniture3dThumbnail } from './Furniture3dThumbnail';

export interface ChatTxSharedProps {
  merchantLocation: MerchantLocationId;
  marketState: MerchantAgentMarketState;
  lulBalance: number;
  cyonBalance: number;
  respiteBalance: number;
  nearTestnetBalance: number;
  walletConnected: boolean;
  hasHouseOwnership: boolean;
  hanaWelcomeNearClaimed: boolean;
  ownedItemIds: string[];
  playerNearAccount: string;
  houseArchitectureStyle: 'plaza_manor' | 'japanese_pavilion';
  ownedHouseStyle?: 'plaza_manor' | 'japanese_pavilion' | null;
  onChainHouseStyleLocked?: boolean;
  onSelectHouseArchitectureStyle?: (style: 'plaza_manor' | 'japanese_pavilion') => void;
  onConnectWallet?: () => void;
  onViewModelHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  onEnterOwnHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  onExchangeLulToCyon: (customLulSpent?: number, customCyonGranted?: number) => void;
  onSwapNearAndRespite?: (
    direction: 'near_to_respite' | 'respite_to_near',
    inputAmount: number,
  ) => Promise<NearRespiteSwapReceipt | null> | NearRespiteSwapReceipt | null | void;
  onInvestInMerchant: () => void;
  onBuyMerchantItem: (
    item: MerchantCatalogItem,
    price: number,
  ) => Promise<{ ok: boolean; txHash?: string; explorerUrl?: string }>;
  onSellMerchantItem: (item: MerchantCatalogItem, refund: number) => Promise<boolean>;
  onBuyHouseWithRespite?: (
    priceRespite: number,
    style?: 'plaza_manor' | 'japanese_pavilion',
  ) => Promise<boolean> | boolean | void;
  onClaimHanaWelcomeNear?: () => Promise<{
    ok: boolean;
    txHash: string;
    explorerUrl: string;
    amountNear: number;
    error?: string;
  }>;
  onInspectFurniture?: (item: MerchantCatalogItem) => void;
  onTeleportToDestination?: (
    destination: CityTransitDestinationSpec,
    originStationId: CityTransitStationId,
  ) => void;
  onNotifySpeech: (text: string) => void;
}

function GuestSignInStrip({ onConnectWallet }: { onConnectWallet?: () => void }) {
  return (
    <div className="px-2.5 py-2 bg-[#1e293b] border border-white/25 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-200 truncate">
        <LogIn className="w-3.5 h-3.5 text-[#b8ff3c] shrink-0" aria-hidden="true" />
        <span>Sign in required to transact</span>
      </span>
      {onConnectWallet && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onConnectWallet();
          }}
          className="px-2.5 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black text-[9.5px] font-black uppercase cursor-pointer shrink-0"
        >
          SIGN IN
        </button>
      )}
    </div>
  );
}

/** Shared inline LUL -> CYON exchange widget used in Chat Action Card & Quick Shop Modal. */
function InlineExchangePanel({
  marketState,
  lulBalance,
  walletConnected,
  initialLulAmount,
  onExchangeLulToCyon,
  onConnectWallet,
  onNotifySpeech,
}: {
  marketState: MerchantAgentMarketState;
  lulBalance: number;
  walletConnected: boolean;
  initialLulAmount?: number | null;
  onExchangeLulToCyon: (customLulSpent?: number, customCyonGranted?: number) => void;
  onConnectWallet?: () => void;
  onNotifySpeech: (text: string) => void;
}) {
  const quote = evaluateLulToCyonExchangeQuote(marketState);
  const rateLul = quote.lulCostFor10Cyon;
  const rateCyon = quote.cyonGranted;
  const [lulInputStr, setLulInputStr] = useState<string>(() => {
    const fallbackAmt = Math.max(rateLul, initialLulAmount ?? rateLul);
    return String(Math.floor(fallbackAmt));
  });
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialLulAmount && initialLulAmount > 0) {
      setLulInputStr(String(Math.floor(Math.max(rateLul, initialLulAmount))));
      setDoneMsg(null);
    }
  }, [initialLulAmount, rateLul]);

  const parsedLul = Math.max(0, Math.floor(Number(lulInputStr) || 0));
  const packets = rateLul > 0 ? Math.floor(parsedLul / rateLul) : 0;
  const lulSpent = packets * rateLul;
  const cyonOut = packets * rateCyon;
  const canExchange =
    walletConnected &&
    quote.canExchange &&
    parsedLul >= rateLul &&
    lulSpent <= lulBalance &&
    cyonOut > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-300 flex-wrap">
        <span>
          Rate: <strong className="text-[#38bdf8]">{rateLul} LUL = {rateCyon} CYON</strong>
        </span>
        <span>Balance: {lulBalance.toLocaleString()} LUL</span>
      </div>

      {!walletConnected ? (
        <GuestSignInStrip onConnectWallet={onConnectWallet} />
      ) : (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {([1, 2, 5] as const).map((mult) => {
              const presetVal = rateLul * mult;
              return (
                <button
                  key={mult}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setLulInputStr(String(presetVal));
                    setDoneMsg(null);
                  }}
                  className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] text-[#38bdf8] border border-white/30 text-[9.5px] font-black cursor-pointer"
                >
                  {presetVal} LUL
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                const maxPackets = rateLul > 0 ? Math.floor(lulBalance / rateLul) : 0;
                setLulInputStr(String(Math.max(rateLul, maxPackets * rateLul)));
                setDoneMsg(null);
              }}
              className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] text-[#b8ff3c] border border-white/30 text-[9.5px] font-black cursor-pointer"
            >
              MAX
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={rateLul}
              step={rateLul}
              value={lulInputStr}
              onChange={(e) => {
                setLulInputStr(e.target.value);
                setDoneMsg(null);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="LUL amount to exchange"
              className="w-28 px-2.5 py-1.5 bg-[#1e293b] text-white border-2 border-white/70 text-xs font-black focus:outline-none focus:border-[#38bdf8]"
            />
            <span className="text-[11px] font-black text-[#10b981]">
              -&gt; +{cyonOut} CYON
            </span>
            <button
              type="button"
              data-chat-tx-exchange-confirm="true"
              disabled={!canExchange}
              onClick={() => {
                if (!canExchange) return;
                soundEngine.playUiClick();
                onExchangeLulToCyon(lulSpent, cyonOut);
                const msg = `Exchanged ${lulSpent} LUL for +${cyonOut} CYON.`;
                setDoneMsg(msg);
                onNotifySpeech(msg);
              }}
              className={`ml-auto px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase ${
                canExchange
                  ? 'bg-[#10b981] hover:bg-[#34d399] text-black cursor-pointer'
                  : 'bg-slate-600 text-slate-300 cursor-not-allowed'
              }`}
            >
              CONFIRM EXCHANGE
            </button>
          </div>
          {!quote.canExchange && (
            <div className="text-[10px] font-bold text-amber-300">
              Shop CYON reserve is too low ({marketState.treasuryCyon} CYON). Support shop with 300 LUL to refill.
            </div>
          )}
          {doneMsg && (
            <div className="px-2 py-1 bg-[#064e3b] border border-[#10b981] text-[10px] font-bold text-[#a7f3d0]">
              {doneMsg}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Shared inline NEAR -> RESPITE swap widget used in Chat Action Card & Quick Shop Modal. */
function InlineSwapNearPanel({
  nearTestnetBalance,
  respiteBalance,
  walletConnected,
  playerNearAccount,
  initialNearAmount,
  onSwapNearAndRespite,
  onConnectWallet,
  onNotifySpeech,
}: {
  nearTestnetBalance: number;
  respiteBalance: number;
  walletConnected: boolean;
  playerNearAccount: string;
  initialNearAmount?: number | null;
  onSwapNearAndRespite?: ChatTxSharedProps['onSwapNearAndRespite'];
  onConnectWallet?: () => void;
  onNotifySpeech: (text: string) => void;
}) {
  const ratePerNear = RESPITE_NEP141_METADATA.rateRespitePerNear;
  const [nearInputStr, setNearInputStr] = useState<string>(() =>
    String(initialNearAmount && initialNearAmount > 0 ? initialNearAmount : 0.25),
  );
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<NearRespiteSwapReceipt | null>(null);

  useEffect(() => {
    if (initialNearAmount && initialNearAmount > 0) {
      setNearInputStr(String(initialNearAmount));
      setErrMsg(null);
    }
  }, [initialNearAmount]);

  const parsedNear = Math.max(0, Number(nearInputStr) || 0);
  const respiteOut = Math.floor(parsedNear * ratePerNear);
  const isReadOnlyWallet =
    walletConnected &&
    isActiveWalletReadOnlyObserver() &&
    !isCitizenSubAccountId(playerNearAccount);
  const exceedsBalance =
    walletConnected && !isReadOnlyWallet && nearTestnetBalance > 0 && parsedNear > nearTestnetBalance;
  const canSwap =
    walletConnected &&
    !busy &&
    !isReadOnlyWallet &&
    parsedNear >= 0.0025 &&
    respiteOut >= 1 &&
    !exceedsBalance;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-300 flex-wrap">
        <span>
          Rate: <strong className="text-[#d8b4fe]">1 NEAR = {ratePerNear} RESPITE</strong>
        </span>
        <span>
          {nearTestnetBalance.toFixed(2)} NEAR · {respiteBalance.toLocaleString()} R
        </span>
      </div>

      {!walletConnected ? (
        <GuestSignInStrip onConnectWallet={onConnectWallet} />
      ) : (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['0.05', '0.25', '0.50', '1'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setNearInputStr(preset);
                  setErrMsg(null);
                }}
                className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] text-[#d8b4fe] border border-white/30 text-[9.5px] font-black cursor-pointer"
              >
                {preset} NEAR
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.0025}
              step={0.01}
              value={nearInputStr}
              onChange={(e) => {
                setNearInputStr(e.target.value);
                setErrMsg(null);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="NEAR amount to swap"
              className="w-28 px-2.5 py-1.5 bg-[#1e293b] text-white border-2 border-white/70 text-xs font-black focus:outline-none focus:border-[#d8b4fe]"
            />
            <span className="text-[11px] font-black text-[#d8b4fe]">
              -&gt; +{respiteOut} R
            </span>
            <button
              type="button"
              data-chat-tx-swap-confirm="true"
              disabled={!canSwap}
              onClick={async () => {
                if (!canSwap) return;
                soundEngine.playUiClick();
                setErrMsg(null);
                setReceipt(null);
                setBusy(true);
                try {
                  const res = await onSwapNearAndRespite?.('near_to_respite', parsedNear);
                  if (res) {
                    setReceipt(res);
                    onNotifySpeech(
                      `Swap complete! Swapped ${parsedNear} NEAR for +${respiteOut} RESPITE.`,
                    );
                  } else {
                    const detail = getLastNearTransactionError() || 'Swap failed or was cancelled.';
                    setErrMsg(detail);
                    onNotifySpeech(detail);
                  }
                } finally {
                  setBusy(false);
                }
              }}
              className={`ml-auto px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase ${
                canSwap
                  ? 'bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black cursor-pointer'
                  : 'bg-slate-600 text-slate-300 cursor-not-allowed'
              }`}
            >
              {busy ? 'SWAPPING...' : 'SWAP NOW'}
            </button>
          </div>

          {isReadOnlyWallet && (
            <div className="text-[10px] font-bold text-amber-300">
              View-only wallet mode is active ({playerNearAccount}). Switch to your own account to swap.
            </div>
          )}
          {exceedsBalance && (
            <div className="text-[10px] font-bold text-rose-300">
              Not enough NEAR ({nearTestnetBalance.toFixed(2)} NEAR available).
            </div>
          )}
          {errMsg && (
            <div className="px-2 py-1 bg-[#7f1d1d] border border-[#f87171] text-[10px] font-bold text-rose-100">
              {errMsg}
            </div>
          )}
          {receipt && (
            <div className="px-2 py-1 bg-[#064e3b] border border-[#10b981] text-[10px] font-bold text-[#a7f3d0] flex items-center justify-between gap-2">
              <span>
                Swapped {receipt.nearAmount} NEAR -&gt; +{receipt.respiteAmount} RESPITE
              </span>
              {receipt.txHash && (
                <a
                  href={getNearBlocksTxUrl(receipt.txHash, 'testnet')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#38bdf8] underline font-mono shrink-0"
                >
                  Receipt
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Shared inline Private House purchase panel for chat card & modal. */
function InlineHouseDealPanel({
  walletConnected,
  hasHouseOwnership,
  respiteBalance,
  houseArchitectureStyle,
  ownedHouseStyle = null,
  onChainHouseStyleLocked = false,
  initialStyle,
  onSelectHouseArchitectureStyle,
  onViewModelHouse,
  onEnterOwnHouse,
  onBuyHouseWithRespite,
  onConnectWallet,
  onSwitchToSwapNear,
  onNotifySpeech,
}: {
  walletConnected: boolean;
  hasHouseOwnership: boolean;
  respiteBalance: number;
  houseArchitectureStyle: 'plaza_manor' | 'japanese_pavilion';
  ownedHouseStyle?: 'plaza_manor' | 'japanese_pavilion' | null;
  onChainHouseStyleLocked?: boolean;
  initialStyle?: 'plaza_manor' | 'japanese_pavilion';
  onSelectHouseArchitectureStyle?: (style: 'plaza_manor' | 'japanese_pavilion') => void;
  onViewModelHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  onEnterOwnHouse?: (style?: 'plaza_manor' | 'japanese_pavilion') => void;
  onBuyHouseWithRespite?: (
    priceRespite: number,
    style?: 'plaza_manor' | 'japanese_pavilion',
  ) => Promise<boolean> | boolean | void;
  onConnectWallet?: () => void;
  onSwitchToSwapNear: (suggestedNear: number) => void;
  onNotifySpeech: (text: string) => void;
}) {
  const isOwned = Boolean(walletConnected && hasHouseOwnership);
  const effectiveOwnedStyle = isOwned ? ownedHouseStyle ?? houseArchitectureStyle : null;
  const [selectedStyle, setSelectedStyle] = useState<'plaza_manor' | 'japanese_pavilion'>(
    initialStyle ?? effectiveOwnedStyle ?? houseArchitectureStyle,
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (initialStyle) {
      setSelectedStyle(initialStyle);
    } else if (isOwned && onChainHouseStyleLocked && effectiveOwnedStyle) {
      setSelectedStyle(effectiveOwnedStyle);
    }
  }, [initialStyle, isOwned, onChainHouseStyleLocked, effectiveOwnedStyle]);

  const canAfford = walletConnected && respiteBalance >= HOUSE_OWNERSHIP_PRICE_RESPITE;
  const isViewingOwnedStyle = isOwned && effectiveOwnedStyle === selectedStyle;
  const deficitRespite = Math.max(0, HOUSE_OWNERSHIP_PRICE_RESPITE - respiteBalance);
  const neededNear = Math.max(
    0.05,
    Math.ceil((deficitRespite / RESPITE_NEP141_METADATA.rateRespitePerNear) * 100) / 100,
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            { id: 'plaza_manor', label: 'PLAZA MANOR' },
            { id: 'japanese_pavilion', label: 'JAPANESE PAVILION' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setSelectedStyle(opt.id);
              if (!isOwned || !onChainHouseStyleLocked) {
                onSelectHouseArchitectureStyle?.(opt.id);
              }
            }}
            className={`px-2 py-1 border-2 border-black text-[9.5px] font-black uppercase cursor-pointer ${
              selectedStyle === opt.id
                ? 'bg-[#38bdf8] text-black shadow-[2px_2px_0px_#000]'
                : 'bg-[#1e293b] text-slate-300 hover:text-white'
            }`}
          >
            {isOwned && effectiveOwnedStyle === opt.id ? `${opt.label} · DEED` : opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-300">
        <span>
          Price: <strong className="text-[#d8b4fe]">{HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE</strong>
        </span>
        <span>Your balance: {respiteBalance.toLocaleString()} R</span>
      </div>

      {!walletConnected ? (
        <GuestSignInStrip onConnectWallet={onConnectWallet} />
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {onViewModelHouse && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onViewModelHouse(selectedStyle);
              }}
              className="px-2.5 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1"
            >
              <Eye className="w-3 h-3" aria-hidden="true" />
              <span>PREVIEW</span>
            </button>
          )}
          {!isOwned && !canAfford && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onSwitchToSwapNear(neededNear);
              }}
              className="px-2.5 py-1.5 bg-[#d8b4fe] hover:bg-[#e9d5ff] text-black border-2 border-black text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1"
            >
              <ArrowRightLeft className="w-3 h-3" aria-hidden="true" />
              <span>SWAP {neededNear} NEAR</span>
            </button>
          )}
          {isOwned ? (
            onEnterOwnHouse &&
            (!onChainHouseStyleLocked || isViewingOwnedStyle) ? (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onEnterOwnHouse(
                    onChainHouseStyleLocked && effectiveOwnedStyle
                      ? effectiveOwnedStyle
                      : selectedStyle,
                  );
                }}
                className="ml-auto px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" aria-hidden="true" />
                <span>ENTER YOUR HOUSE</span>
              </button>
            ) : (
              onEnterOwnHouse &&
              effectiveOwnedStyle && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onEnterOwnHouse(effectiveOwnedStyle);
                  }}
                  className="ml-auto px-3 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1"
                >
                  <Check className="w-3 h-3" aria-hidden="true" />
                  <span>
                    ENTER OWNED{' '}
                    {effectiveOwnedStyle === 'japanese_pavilion' ? 'PAVILION' : 'MANOR'}
                  </span>
                </button>
              )
            )
          ) : (
            <button
              type="button"
              data-chat-tx-buy-house-confirm="true"
              disabled={!canAfford || busy}
              onClick={async () => {
                if (!canAfford || busy) return;
                soundEngine.playUiClick();
                onSelectHouseArchitectureStyle?.(selectedStyle);
                setFeedback(null);
                setBusy(true);
                try {
                  const ok = await onBuyHouseWithRespite?.(
                    HOUSE_OWNERSHIP_PRICE_RESPITE,
                    selectedStyle,
                  );
                  if (ok) {
                    const msg = 'House Deed confirmed! You now own your Private House.';
                    setFeedback({ ok: true, text: msg });
                    onNotifySpeech(msg);
                  } else {
                    const detail =
                      getLastNearTransactionError() ||
                      'Could not buy House. Check RESPITE balance and confirm the wallet prompt.';
                    setFeedback({ ok: false, text: detail });
                    onNotifySpeech(detail);
                  }
                } finally {
                  setBusy(false);
                }
              }}
              className={`ml-auto px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                canAfford && !busy
                  ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer'
                  : 'bg-slate-600 text-slate-300 cursor-not-allowed'
              }`}
            >
              <Home className="w-3 h-3" aria-hidden="true" />
              <span>{busy ? 'SIGNING...' : `BUY HOUSE (${HOUSE_OWNERSHIP_PRICE_RESPITE} R)`}</span>
            </button>
          )}
        </div>
      )}
      {feedback && (
        <div
          className={`px-2 py-1 border text-[10px] font-bold ${
            feedback.ok
              ? 'bg-[#064e3b] border-[#10b981] text-[#a7f3d0]'
              : 'bg-[#7f1d1d] border-[#f87171] text-rose-100'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}

/** Inline single-item catalog deal panel inside Chat Session. */
function InlineCatalogItemPanel({
  item,
  marketState,
  cyonBalance,
  respiteBalance,
  walletConnected,
  hasHouseOwnership,
  ownedItemIds,
  onBuyMerchantItem,
  onSellMerchantItem,
  onConnectWallet,
  onInspectFurniture,
  onOpenModal,
  onNeedFundsSwitch,
  onNotifySpeech,
}: {
  item: MerchantCatalogItem;
  marketState: MerchantAgentMarketState;
  cyonBalance: number;
  respiteBalance: number;
  walletConnected: boolean;
  hasHouseOwnership: boolean;
  ownedItemIds: string[];
  onBuyMerchantItem: ChatTxSharedProps['onBuyMerchantItem'];
  onSellMerchantItem: ChatTxSharedProps['onSellMerchantItem'];
  onConnectWallet?: () => void;
  onInspectFurniture?: (item: MerchantCatalogItem) => void;
  onOpenModal: () => void;
  onNeedFundsSwitch: (currency: 'CYON' | 'RESPITE', neededAmount: number) => void;
  onNotifySpeech: (text: string) => void;
}) {
  const quote = evaluateMerchantItemQuote(marketState, item);
  const isOwned = ownedItemIds.includes(item.id);
  const balance = item.currency === 'CYON' ? cyonBalance : respiteBalance;
  const needsHouse = item.category === 'nft_collector_furniture' && !hasHouseOwnership;
  const canBuy =
    walletConnected &&
    !needsHouse &&
    (!isOwned || Boolean(item.interiorSlot)) &&
    quote.stock > 0 &&
    balance >= quote.buyPrice;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
    txHash?: string;
    explorerUrl?: string;
  } | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5">
        {item.category !== 'fishing_gear' ? (
          <div className="w-20 shrink-0 border-2 border-black overflow-hidden">
            <Furniture3dThumbnail
              catalogId={item.id}
              name={item.name}
              iconEmoji={item.iconEmoji}
              size="compact"
              onInspect={onInspectFurniture ? () => onInspectFurniture(item) : undefined}
            />
          </div>
        ) : (
          <div className="w-12 h-12 shrink-0 bg-[#1e293b] border-2 border-black flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-[#38bdf8]" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-black uppercase text-white truncate">
            {item.name}
          </div>
          <div className="text-[9.5px] font-bold text-slate-300 leading-snug">
            {item.description}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black flex-wrap">
            <span className={item.currency === 'CYON' ? 'text-[#38bdf8]' : 'text-[#d8b4fe]'}>
              {quote.buyPrice} {item.currency}
            </span>
            <span className="text-slate-400">Stock {quote.stock}</span>
            <span className="text-slate-400">
              Balance: {balance.toLocaleString()} {item.currency}
            </span>
          </div>
        </div>
      </div>

      {!walletConnected ? (
        <GuestSignInStrip onConnectWallet={onConnectWallet} />
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal();
            }}
            className="px-2.5 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-white border-2 border-black text-[9.5px] font-black uppercase cursor-pointer"
          >
            BROWSE ALL
          </button>

          {balance < quote.buyPrice && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onNeedFundsSwitch(item.currency, quote.buyPrice - balance);
              }}
              className="px-2.5 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black text-[9.5px] font-black uppercase cursor-pointer"
            >
              GET {item.currency} HERE
            </button>
          )}

          {isOwned && !item.interiorSlot && item.category === 'fishing_gear' ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                soundEngine.playUiClick();
                setBusy(true);
                try {
                  const ok = await onSellMerchantItem(item, quote.sellbackPrice);
                  const text = ok
                    ? `Sold ${item.name} for +${quote.sellbackPrice} ${item.currency}.`
                    : 'Sale did not complete.';
                  setFeedback({ ok, text });
                  onNotifySpeech(text);
                } finally {
                  setBusy(false);
                }
              }}
              className="ml-auto px-3 py-1.5 bg-[#facc15] hover:bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer"
            >
              SELL (+{quote.sellbackPrice} {item.currency})
            </button>
          ) : (
            <button
              type="button"
              data-chat-tx-buy-item-confirm="true"
              disabled={!canBuy || busy}
              onClick={async () => {
                if (!canBuy || busy) return;
                soundEngine.playPickup();
                setFeedback(null);
                setBusy(true);
                try {
                  const res = await onBuyMerchantItem(item, quote.buyPrice);
                  const text = res.ok
                    ? `Purchased ${item.name} for ${quote.buyPrice} ${item.currency}!`
                    : 'Purchase failed — your balance was not charged.';
                  setFeedback({
                    ok: res.ok,
                    text,
                    txHash: res.txHash,
                    explorerUrl: res.explorerUrl,
                  });
                  onNotifySpeech(text);
                } finally {
                  setBusy(false);
                }
              }}
              className={`ml-auto px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase ${
                canBuy && !busy
                  ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer'
                  : 'bg-slate-600 text-slate-300 cursor-not-allowed'
              }`}
            >
              {busy
                ? 'BUYING...'
                : needsHouse
                  ? 'OWN HOUSE FIRST'
                  : quote.stock <= 0
                    ? 'OUT OF STOCK'
                    : `BUY (${quote.buyPrice} ${item.currency})`}
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`px-2 py-1 border text-[10px] font-bold flex items-center justify-between gap-2 ${
            feedback.ok
              ? 'bg-[#064e3b] border-[#10b981] text-[#a7f3d0]'
              : 'bg-[#7f1d1d] border-[#f87171] text-rose-100'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.txHash && (
            <a
              href={feedback.explorerUrl || getNearBlocksTxUrl(feedback.txHash, 'testnet')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#38bdf8] underline font-mono shrink-0"
            >
              Receipt
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Neo-brutalist city location list rendered inline in Chat Session.
 * Clicking any location box transforms that box into a YES / NO teleport confirmation.
 */
function InlineTeleportPlacesPanel({
  merchantLocation,
  focusStationId,
  onTeleportToDestination,
}: {
  merchantLocation: MerchantLocationId;
  focusStationId: CityTransitStationId | null;
  onTeleportToDestination?: (
    destination: CityTransitDestinationSpec,
    originStationId: CityTransitStationId,
  ) => void;
}) {
  const [confirmingDestId, setConfirmingDestId] = useState<CityTransitStationId | null>(null);
  const [kioskThumbnails, setKioskThumbnails] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const winStore = window as unknown as {
        __BUDDIES_KIOSK_THUMBNAILS__?: Record<string, string>;
      };
      return winStore.__BUDDIES_KIOSK_THUMBNAILS__ ?? {};
    }
    return {};
  });

  useEffect(() => {
    setConfirmingDestId(null);
  }, [focusStationId, merchantLocation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncThumbnails = () => {
      const winStore = window as unknown as {
        __BUDDIES_KIOSK_THUMBNAILS__?: Record<string, string>;
      };
      if (winStore.__BUDDIES_KIOSK_THUMBNAILS__) {
        setKioskThumbnails({ ...winStore.__BUDDIES_KIOSK_THUMBNAILS__ });
      }
    };
    syncThumbnails();
    if (!Object.keys(kioskThumbnails).length) {
      window.dispatchEvent(new CustomEvent('request-kiosk-thumbnails'));
    }
    window.addEventListener('kiosk-thumbnails-ready', syncThumbnails);
    return () => {
      window.removeEventListener('kiosk-thumbnails-ready', syncThumbnails);
    };
  }, []);

  const currentStationId: CityTransitStationId =
    merchantLocation === 'lobby_cafe' ? 'central_plaza' : 'kai_fish_market';

  const orderedDestinations = React.useMemo(() => {
    const priorityIds: CityTransitStationId[] = [currentStationId];
    if (focusStationId && focusStationId !== currentStationId) {
      priorityIds.push(focusStationId);
    }
    const prioritized = priorityIds
      .map((id) => CITY_TRANSIT_DESTINATIONS.find((d) => d.id === id))
      .filter((d): d is CityTransitDestinationSpec => Boolean(d));
    const remaining = CITY_TRANSIT_DESTINATIONS.filter(
      (d) => !priorityIds.includes(d.id),
    );
    return [...prioritized, ...remaining];
  }, [currentStationId, focusStationId]);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold text-slate-300">
        Click any location box below to teleport straight there.
      </div>
      <div
        data-chat-teleport-list="true"
        className="p-2 bg-[#f1f5f9] border-[2px] border-black space-y-2 max-h-[252px] overflow-y-auto"
      >
        {orderedDestinations.map((dest) => {
          const isHere = dest.id === currentStationId;
          const isFocused = Boolean(focusStationId && dest.id === focusStationId);
          const isConfirming = confirmingDestId === dest.id;
          const thumbSrc = kioskThumbnails[dest.id] || dest.heroImageUrl;

          if (isConfirming) {
            return (
              <div
                key={dest.id}
                data-chat-teleport-confirm={dest.id}
                className="w-full p-2.5 bg-[#facc15] border-[2.5px] border-black shadow-[3px_3px_0px_#000] flex items-center gap-2.5 transition-all duration-150"
              >
                <img
                  src={thumbSrc}
                  alt={dest.shortTitle}
                  className="w-11 h-11 object-cover border-[2px] border-black shrink-0 bg-slate-900"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black uppercase tracking-tight text-black leading-tight truncate">
                    {isHere
                      ? `RE-CENTER AT ${dest.title}?`
                      : `TELEPORT TO ${dest.title}?`}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      data-chat-teleport-yes={dest.id}
                      onClick={() => {
                        soundEngine.playUiConfirm();
                        setConfirmingDestId(null);
                        onTeleportToDestination?.(dest, currentStationId);
                      }}
                      className="px-3.5 py-1 bg-[#a3e635] hover:bg-[#bef264] text-black border-[2px] border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      data-chat-teleport-no={dest.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setConfirmingDestId(null);
                      }}
                      className="px-3.5 py-1 bg-white hover:bg-slate-200 text-black border-[2px] border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <button
              key={dest.id}
              type="button"
              data-chat-teleport-card={dest.id}
              onClick={() => {
                soundEngine.playUiClick();
                setConfirmingDestId(dest.id);
              }}
              className={`w-full p-2.5 flex items-center gap-2.5 text-left transition-all duration-150 cursor-pointer hover:-translate-y-0.5 ${
                isFocused
                  ? 'bg-[#facc15] hover:bg-[#fde047] border-[2.5px] border-black shadow-[3px_3px_0px_#000]'
                  : 'bg-white hover:bg-[#fef9c3] border-[2.5px] border-black shadow-[3px_3px_0px_#000]'
              }`}
            >
              <img
                src={thumbSrc}
                alt={dest.shortTitle}
                className="w-11 h-11 object-cover border-[2px] border-black shrink-0 bg-slate-900"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-tight text-black truncate">
                  {dest.title}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {isHere ? (
                    <span className="px-1.5 py-0.5 bg-[#a3e635] text-black border-[1.5px] border-black text-[9px] font-black uppercase">
                      HERE
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 text-black border-[1.5px] border-black text-[9px] font-black uppercase ${
                        dest.id === 'warzone_arena' ? 'bg-[#f87171]' : 'bg-[#00f0ff]'
                      }`}
                    >
                      {dest.tag}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Interactive transaction card rendered directly inside the merchant Chat Session
 * stream so players can exchange, swap, or purchase items without leaving chat.
 */
export const ChatActionCard: React.FC<
  ChatTxSharedProps & {
    intent: NpcChatTransactionIntent;
    onChangeIntent: (next: NpcChatTransactionIntent | null) => void;
    onOpenQuickModal: (initialTab: 'exchange' | 'house' | 'items') => void;
  }
> = (props) => {
  const { intent, onChangeIntent, onOpenQuickModal } = props;
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [bonusResult, setBonusResult] = useState<string | null>(null);

  const matchedItem =
    intent.kind === 'buy_catalog_item'
      ? MERCHANT_CATALOG_ITEMS.find((it) => it.id === intent.itemId) ?? null
      : null;

  const titleByKind: Record<NpcChatTransactionIntent['kind'], string> = {
    exchange_lul_cyon: 'IN-CHAT EXCHANGE · LUL -> CYON',
    swap_near_respite: 'IN-CHAT SWAP · NEAR -> RESPITE',
    buy_house: 'IN-CHAT HOUSE DEAL',
    buy_catalog_item: matchedItem ? `QUICK BUY · ${matchedItem.name}` : 'QUICK ITEM DEAL',
    browse_catalog: 'QUICK SHOP READY',
    invest_shop: 'SUPPORT SHOP RESERVE',
    claim_welcome: 'STARTER PACK BONUS',
    teleport_places: 'CITY TELEPORT · SELECT LOCATION',
  };

  const modalTabForIntent: 'exchange' | 'house' | 'items' =
    intent.kind === 'exchange_lul_cyon' ||
    intent.kind === 'swap_near_respite' ||
    intent.kind === 'invest_shop'
      ? 'exchange'
      : intent.kind === 'buy_house' ||
          (intent.kind === 'browse_catalog' && intent.scope === 'house')
        ? props.merchantLocation === 'lobby_cafe'
          ? 'house'
          : 'items'
        : 'items';

  return (
    <div
      data-chat-tx-card="true"
      data-chat-tx-kind={intent.kind}
      className="p-3 bg-[#141c2e] text-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-[#facc15] truncate">
          {intent.kind === 'teleport_places' ? (
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#00f0ff]" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{titleByKind[intent.kind]}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {intent.kind !== 'teleport_places' && (
            <button
              type="button"
              data-chat-open-tx-modal-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenQuickModal(modalTabForIntent);
              }}
              className="px-2 py-0.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border border-black text-[9px] font-black uppercase cursor-pointer inline-flex items-center gap-1"
            >
              <Store className="w-3 h-3" aria-hidden="true" />
              <span>OPEN MODAL</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Close transaction card"
            onClick={() => {
              soundEngine.playUiClick();
              onChangeIntent(null);
            }}
            className="w-5 h-5 bg-[#1e293b] hover:bg-[#334155] text-white border border-black flex items-center justify-center cursor-pointer"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {intent.kind === 'exchange_lul_cyon' && (
        <InlineExchangePanel
          marketState={props.marketState}
          lulBalance={props.lulBalance}
          walletConnected={props.walletConnected}
          initialLulAmount={intent.suggestedLulAmount}
          onExchangeLulToCyon={props.onExchangeLulToCyon}
          onConnectWallet={props.onConnectWallet}
          onNotifySpeech={props.onNotifySpeech}
        />
      )}

      {intent.kind === 'swap_near_respite' && (
        <InlineSwapNearPanel
          nearTestnetBalance={props.nearTestnetBalance}
          respiteBalance={props.respiteBalance}
          walletConnected={props.walletConnected}
          playerNearAccount={props.playerNearAccount}
          initialNearAmount={intent.suggestedNearAmount}
          onSwapNearAndRespite={props.onSwapNearAndRespite}
          onConnectWallet={props.onConnectWallet}
          onNotifySpeech={props.onNotifySpeech}
        />
      )}

      {intent.kind === 'buy_house' && (
        <InlineHouseDealPanel
          walletConnected={props.walletConnected}
          hasHouseOwnership={props.hasHouseOwnership}
          respiteBalance={props.respiteBalance}
          houseArchitectureStyle={props.houseArchitectureStyle}
          ownedHouseStyle={props.ownedHouseStyle}
          onChainHouseStyleLocked={props.onChainHouseStyleLocked}
          initialStyle={intent.style}
          onSelectHouseArchitectureStyle={props.onSelectHouseArchitectureStyle}
          onViewModelHouse={props.onViewModelHouse}
          onEnterOwnHouse={props.onEnterOwnHouse}
          onBuyHouseWithRespite={props.onBuyHouseWithRespite}
          onConnectWallet={props.onConnectWallet}
          onSwitchToSwapNear={(suggestedNear) =>
            onChangeIntent({ kind: 'swap_near_respite', suggestedNearAmount: suggestedNear })
          }
          onNotifySpeech={props.onNotifySpeech}
        />
      )}

      {intent.kind === 'buy_catalog_item' && matchedItem && (
        <InlineCatalogItemPanel
          item={matchedItem}
          marketState={props.marketState}
          cyonBalance={props.cyonBalance}
          respiteBalance={props.respiteBalance}
          walletConnected={props.walletConnected}
          hasHouseOwnership={props.hasHouseOwnership}
          ownedItemIds={props.ownedItemIds}
          onBuyMerchantItem={props.onBuyMerchantItem}
          onSellMerchantItem={props.onSellMerchantItem}
          onConnectWallet={props.onConnectWallet}
          onInspectFurniture={props.onInspectFurniture}
          onOpenModal={() => onOpenQuickModal('items')}
          onNeedFundsSwitch={(currency, neededAmount) => {
            if (currency === 'CYON') {
              const q = evaluateLulToCyonExchangeQuote(props.marketState);
              const packetsNeeded = Math.max(1, Math.ceil(neededAmount / Math.max(1, q.cyonGranted)));
              onChangeIntent({
                kind: 'exchange_lul_cyon',
                suggestedLulAmount: packetsNeeded * q.lulCostFor10Cyon,
              });
            } else {
              const nearNeeded =
                Math.ceil((neededAmount / RESPITE_NEP141_METADATA.rateRespitePerNear) * 100) / 100;
              onChangeIntent({
                kind: 'swap_near_respite',
                suggestedNearAmount: Math.max(0.05, nearNeeded),
              });
            }
          }}
          onNotifySpeech={props.onNotifySpeech}
        />
      )}

      {intent.kind === 'browse_catalog' && (
        <div className="space-y-2">
          <div className="text-[10.5px] font-bold text-slate-300">
            Browse items, swap currencies, or buy directly inside the Chat Quick Shop without leaving this conversation.
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenQuickModal(modalTabForIntent);
              }}
              className="px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" aria-hidden="true" />
              <span>OPEN QUICK SHOP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenQuickModal('exchange');
              }}
              className="px-3 py-1.5 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>OPEN EXCHANGE</span>
            </button>
          </div>
        </div>
      )}

      {intent.kind === 'invest_shop' && (
        <div className="space-y-2">
          <div className="text-[10.5px] font-bold text-slate-300">
            Shop reserve: <strong className="text-[#38bdf8]">{props.marketState.treasuryCyon} CYON</strong>. Support with 300 LUL to receive +45 CYON and a 15% catalog discount.
          </div>
          {!props.walletConnected ? (
            <GuestSignInStrip onConnectWallet={props.onConnectWallet} />
          ) : (
            <button
              type="button"
              disabled={props.lulBalance < 300}
              onClick={() => {
                if (props.lulBalance < 300) return;
                soundEngine.playPickup();
                props.onInvestInMerchant();
                props.onNotifySpeech(
                  'Thank you! Shop reserves refilled, +45 CYON added, and your 15% catalog discount is active.',
                );
              }}
              className={`px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase ${
                props.lulBalance >= 300
                  ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer'
                  : 'bg-slate-600 text-slate-300 cursor-not-allowed'
              }`}
            >
              SUPPORT SHOP (300 LUL)
            </button>
          )}
        </div>
      )}

      {intent.kind === 'claim_welcome' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-[10.5px] font-bold text-slate-300">
            <span>Starter Pack: 0.30 NEAR + 100 LUL + 20 CYON</span>
            {props.hanaWelcomeNearClaimed && (
              <span className="px-2 py-0.5 bg-[#10b981] text-black border border-black text-[9px] font-black uppercase">
                CLAIMED
              </span>
            )}
          </div>
          {!props.walletConnected ? (
            <GuestSignInStrip onConnectWallet={props.onConnectWallet} />
          ) : !props.hanaWelcomeNearClaimed && props.onClaimHanaWelcomeNear ? (
            <button
              type="button"
              disabled={claimingBonus}
              onClick={async () => {
                if (claimingBonus) return;
                soundEngine.playUiClick();
                setClaimingBonus(true);
                try {
                  const res = await props.onClaimHanaWelcomeNear!();
                  const msg = res.ok
                    ? `${res.amountNear.toFixed(2)} NEAR + 100 LUL + 20 CYON added!`
                    : res.error || 'Could not claim starter pack right now.';
                  setBonusResult(msg);
                  props.onNotifySpeech(msg);
                } finally {
                  setClaimingBonus(false);
                }
              }}
              className="px-3 py-1.5 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1.5"
            >
              <Gift className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{claimingBonus ? 'CLAIMING...' : 'CLAIM STARTER PACK'}</span>
            </button>
          ) : null}
          {bonusResult && (
            <div className="text-[10px] font-bold text-[#a7f3d0]">{bonusResult}</div>
          )}
        </div>
      )}

      {intent.kind === 'teleport_places' && (
        <InlineTeleportPlacesPanel
          merchantLocation={props.merchantLocation}
          focusStationId={intent.focusStationId}
          onTeleportToDestination={props.onTeleportToDestination}
        />
      )}
    </div>
  );
};

/**
 * Centered Quick Transaction Modal launched right from Chat Session so players
 * can exchange, swap, or purchase catalog items without touching top tabs.
 */
export const QuickShopChatModal: React.FC<
  ChatTxSharedProps & {
    isOpen: boolean;
    initialTab: 'exchange' | 'house' | 'items';
    onClose: () => void;
  }
> = (props) => {
  const { isOpen, initialTab, onClose, merchantLocation } = props;
  const [modalTab, setModalTab] = useState<'exchange' | 'house' | 'items'>(initialTab);
  const [swapNearOverride, setSwapNearOverride] = useState<number | null>(null);
  const [itemFeedback, setItemFeedback] = useState<{
    ok: boolean;
    text: string;
    txHash?: string;
    explorerUrl?: string;
  } | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setModalTab(
        initialTab === 'house' && merchantLocation !== 'lobby_cafe' ? 'items' : initialTab,
      );
      setItemFeedback(null);
    }
  }, [isOpen, initialTab, merchantLocation]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visibleItems = MERCHANT_CATALOG_ITEMS.filter((item) =>
    merchantLocation === 'beach_house'
      ? item.category === 'fishing_gear'
      : item.category !== 'fishing_gear',
  );

  return (
    <div
      data-chat-quick-tx-modal="true"
      className="fixed inset-0 z-[75] bg-black/65 p-3 sm:p-5 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[86vh] bg-white text-black border-[3.5px] border-black shadow-[6px_6px_0px_#000] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-[#0f172a] text-white border-b-[3px] border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Store className="w-4 h-4 text-[#b8ff3c] shrink-0" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-wider truncate">
              {merchantLocation === 'lobby_cafe'
                ? "HANA'S CHAT CHECKOUT"
                : "KAI'S CHAT CHECKOUT"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close quick checkout modal"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="w-7 h-7 bg-[#ef4444] hover:bg-[#f87171] text-white border-2 border-black font-black flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 py-2 bg-slate-100 border-b-2 border-black flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setModalTab('exchange');
              }}
              className={`px-2.5 py-1 border-2 border-black text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1 ${
                modalTab === 'exchange' ? 'bg-[#10b981] text-black' : 'bg-white text-black'
              }`}
            >
              <ArrowRightLeft className="w-3 h-3" aria-hidden="true" />
              <span>EXCHANGE</span>
            </button>
            {merchantLocation === 'lobby_cafe' && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setModalTab('house');
                }}
                className={`px-2.5 py-1 border-2 border-black text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1 ${
                  modalTab === 'house' ? 'bg-[#38bdf8] text-black' : 'bg-white text-black'
                }`}
              >
                <Home className="w-3 h-3" aria-hidden="true" />
                <span>HOUSE</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setModalTab('items');
              }}
              className={`px-2.5 py-1 border-2 border-black text-[10px] font-black uppercase cursor-pointer inline-flex items-center gap-1 ${
                modalTab === 'items' ? 'bg-[#facc15] text-black' : 'bg-white text-black'
              }`}
            >
              <Sofa className="w-3 h-3" aria-hidden="true" />
              <span>{merchantLocation === 'beach_house' ? 'FISHING GEAR' : 'ITEMS & THEMES'}</span>
            </button>
          </div>
          <div className="text-[9.5px] font-black uppercase text-slate-700 flex items-center gap-2">
            <span>{props.lulBalance.toLocaleString()} LUL</span>
            <span>{props.cyonBalance.toLocaleString()} CYON</span>
            <span>{props.respiteBalance.toLocaleString()} R</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {modalTab === 'exchange' && (
            <>
              <div className="p-3 bg-[#141c2e] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                <div className="text-[10.5px] font-black uppercase text-[#38bdf8] flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>EXCHANGE LUL -&gt; CYON</span>
                </div>
                <InlineExchangePanel
                  marketState={props.marketState}
                  lulBalance={props.lulBalance}
                  walletConnected={props.walletConnected}
                  onExchangeLulToCyon={props.onExchangeLulToCyon}
                  onConnectWallet={props.onConnectWallet}
                  onNotifySpeech={props.onNotifySpeech}
                />
              </div>

              <div className="p-3 bg-[#141c2e] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                <div className="text-[10.5px] font-black uppercase text-[#d8b4fe] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>SWAP NEAR -&gt; RESPITE</span>
                </div>
                <InlineSwapNearPanel
                  nearTestnetBalance={props.nearTestnetBalance}
                  respiteBalance={props.respiteBalance}
                  walletConnected={props.walletConnected}
                  playerNearAccount={props.playerNearAccount}
                  initialNearAmount={swapNearOverride}
                  onSwapNearAndRespite={props.onSwapNearAndRespite}
                  onConnectWallet={props.onConnectWallet}
                  onNotifySpeech={props.onNotifySpeech}
                />
              </div>
            </>
          )}

          {modalTab === 'house' && merchantLocation === 'lobby_cafe' && (
            <div className="p-3 bg-[#141c2e] text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
              <div className="text-[10.5px] font-black uppercase text-[#38bdf8] flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" aria-hidden="true" />
                <span>PRIVATE HOUSE OWNERSHIP</span>
              </div>
              <InlineHouseDealPanel
                walletConnected={props.walletConnected}
                hasHouseOwnership={props.hasHouseOwnership}
                respiteBalance={props.respiteBalance}
                houseArchitectureStyle={props.houseArchitectureStyle}
                ownedHouseStyle={props.ownedHouseStyle}
                onChainHouseStyleLocked={props.onChainHouseStyleLocked}
                onSelectHouseArchitectureStyle={props.onSelectHouseArchitectureStyle}
                onViewModelHouse={props.onViewModelHouse}
                onEnterOwnHouse={props.onEnterOwnHouse}
                onBuyHouseWithRespite={props.onBuyHouseWithRespite}
                onConnectWallet={props.onConnectWallet}
                onSwitchToSwapNear={(suggestedNear) => {
                  setSwapNearOverride(suggestedNear);
                  setModalTab('exchange');
                }}
                onNotifySpeech={props.onNotifySpeech}
              />
            </div>
          )}

          {modalTab === 'items' && (
            <div className="space-y-2.5">
              {!props.walletConnected && <GuestSignInStrip onConnectWallet={props.onConnectWallet} />}
              {itemFeedback && (
                <div
                  className={`p-2 border-2 border-black text-[10px] font-bold flex items-center justify-between gap-2 ${
                    itemFeedback.ok
                      ? 'bg-[#ecfdf5] text-[#065f46]'
                      : 'bg-[#fef2f2] text-[#991b1b]'
                  }`}
                >
                  <span>{itemFeedback.text}</span>
                  {itemFeedback.txHash && (
                    <a
                      href={
                        itemFeedback.explorerUrl ||
                        getNearBlocksTxUrl(itemFeedback.txHash, 'testnet')
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0369a1] underline font-mono shrink-0"
                    >
                      Receipt
                    </a>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {visibleItems.map((item) => {
                  const quote = evaluateMerchantItemQuote(props.marketState, item);
                  const isOwned = props.ownedItemIds.includes(item.id);
                  const balance = item.currency === 'CYON' ? props.cyonBalance : props.respiteBalance;
                  const needsHouse =
                    item.category === 'nft_collector_furniture' && !props.hasHouseOwnership;
                  const canBuy =
                    props.walletConnected &&
                    !needsHouse &&
                    (!isOwned || Boolean(item.interiorSlot)) &&
                    quote.stock > 0 &&
                    balance >= quote.buyPrice;

                  return (
                    <div
                      key={item.id}
                      data-quick-modal-item={item.id}
                      className="p-2.5 bg-[#0f172a] text-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col gap-2"
                    >
                      <div className="flex items-start gap-2">
                        {item.category !== 'fishing_gear' ? (
                          <div className="w-16 shrink-0 border border-white/30 overflow-hidden">
                            <Furniture3dThumbnail
                              catalogId={item.id}
                              name={item.name}
                              iconEmoji={item.iconEmoji}
                              size="compact"
                              onInspect={
                                props.onInspectFurniture
                                  ? () => props.onInspectFurniture!(item)
                                  : undefined
                              }
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 shrink-0 bg-[#1e293b] border border-white/30 flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-[#38bdf8]" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-black uppercase text-white truncate">
                            {item.name}
                          </div>
                          <div className="text-[9.5px] font-bold text-slate-300 mt-0.5">
                            {quote.buyPrice} {item.currency} · Stock {quote.stock}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 mt-auto">
                        {props.onInspectFurniture && item.category !== 'fishing_gear' && (
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              props.onInspectFurniture!(item);
                            }}
                            className="px-2 py-1 bg-[#1e293b] hover:bg-[#334155] text-white border border-white/30 text-[9px] font-black uppercase cursor-pointer"
                          >
                            3D VIEW
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!canBuy || busyItemId === item.id}
                          onClick={async () => {
                            if (!canBuy) return;
                            soundEngine.playPickup();
                            setBusyItemId(item.id);
                            setItemFeedback(null);
                            try {
                              const res = await props.onBuyMerchantItem(item, quote.buyPrice);
                              const text = res.ok
                                ? `Bought ${item.name} (${quote.buyPrice} ${item.currency}).`
                                : 'Purchase failed — your balance was not charged.';
                              setItemFeedback({
                                ok: res.ok,
                                text,
                                txHash: res.txHash,
                                explorerUrl: res.explorerUrl,
                              });
                              props.onNotifySpeech(text);
                            } finally {
                              setBusyItemId(null);
                            }
                          }}
                          className={`ml-auto px-2.5 py-1 border-2 border-black text-[9.5px] font-black uppercase ${
                            canBuy && busyItemId !== item.id
                              ? 'bg-[#b8ff3c] hover:bg-[#d9f99d] text-black cursor-pointer'
                              : 'bg-slate-600 text-slate-300 cursor-not-allowed'
                          }`}
                        >
                          {busyItemId === item.id
                            ? 'BUYING...'
                            : needsHouse
                              ? 'NEEDS HOUSE'
                              : isOwned && !item.interiorSlot
                                ? 'OWNED'
                                : `BUY ${quote.buyPrice} ${item.currency === 'RESPITE' ? 'R' : item.currency}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
