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
  type CityTransitDestinationSpec,
  type CityTransitStationId,
  getTravelDistrictDestinations,
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
  houseArchitectureStyle: 'glass_modern';
  ownedHouseStyle?: 'glass_modern' | null;
  onChainHouseStyleLocked?: boolean;
  onSelectHouseArchitectureStyle?: (style: 'glass_modern') => void;
  onConnectWallet?: () => void;
  onViewModelHouse?: (style?: 'glass_modern') => void;
  onEnterOwnHouse?: (style?: 'glass_modern') => void;
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
    style?: 'glass_modern',
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
    <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 truncate">
        <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
        <span>Sign in required to transact</span>
      </span>
      {onConnectWallet && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onConnectWallet();
          }}
          className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs text-[10.5px] font-semibold cursor-pointer transition-colors shrink-0"
        >
          Sign in
        </button>
      )}
    </div>
  );
}

/** Shared inline LUL -> CYON exchange widget used in Exchange Quick View & Quick Shop Modal. */
export function InlineExchangePanel({
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
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 flex-wrap">
        <span>
          Rate: <strong className="text-sky-600">{rateLul} LUL = {rateCyon} CYON</strong>
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
                  className="px-2.5 py-1 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 text-[10px] font-semibold cursor-pointer transition-colors"
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
              className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[10px] font-semibold cursor-pointer transition-colors"
            >
              Max
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
              className="w-28 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-900 border border-slate-200/90 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white"
            />
            <span className="text-xs font-semibold text-emerald-600">
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
              className={`ml-auto px-3.5 py-1.5 rounded-full text-[11px] font-semibold shadow-xs transition-colors ${
                canExchange
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Confirm exchange
            </button>
          </div>
          {!quote.canExchange && (
            <div className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-1.5">
              Shop CYON reserve is too low ({marketState.treasuryCyon} CYON). Support shop with 300 LUL to refill.
            </div>
          )}
          {doneMsg && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-800">
              {doneMsg}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Shared inline NEAR -> RESPITE swap widget used in Exchange Quick View & Quick Shop Modal. */
export function InlineSwapNearPanel({
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
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 flex-wrap">
        <span>
          Rate: <strong className="text-violet-600">1 NEAR = {ratePerNear} RESPITE</strong>
        </span>
        <span>
          {respiteBalance.toLocaleString()} RESPITE · {nearTestnetBalance.toFixed(2)} NEAR
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
                className="px-2.5 py-1 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200/80 text-[10px] font-semibold cursor-pointer transition-colors"
              >
                {preset} NEAR
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
              className="w-28 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-900 border border-slate-200/90 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white"
            />
            <span className="text-xs font-semibold text-violet-600">
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
              className={`ml-auto px-3.5 py-1.5 rounded-full text-[11px] font-semibold shadow-xs transition-colors ${
                canSwap
                  ? 'bg-violet-500 hover:bg-violet-600 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {busy ? 'Swapping...' : 'Swap now'}
            </button>
          </div>

          {isReadOnlyWallet && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] font-medium text-amber-800">
              View-only wallet mode is active ({playerNearAccount}). Switch to your own account to swap.
            </div>
          )}
          {exceedsBalance && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/80 text-[11px] font-medium text-rose-700">
              Not enough NEAR ({nearTestnetBalance.toFixed(2)} NEAR available).
            </div>
          )}
          {errMsg && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/80 text-[11px] font-medium text-rose-700">
              {errMsg}
            </div>
          )}
          {receipt && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-800 flex items-center justify-between gap-2">
              <span>
                Swapped {receipt.nearAmount} NEAR -&gt; +{receipt.respiteAmount} RESPITE
              </span>
              {receipt.txHash && (
                <a
                  href={getNearBlocksTxUrl(receipt.txHash, 'testnet')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:text-sky-700 underline font-mono shrink-0"
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

/** Shared inline Private House purchase panel for Exchange Quick View & modal. */
export function InlineHouseDealPanel({
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
  houseArchitectureStyle: 'glass_modern';
  ownedHouseStyle?: 'glass_modern' | null;
  onChainHouseStyleLocked?: boolean;
  initialStyle?: 'glass_modern';
  onSelectHouseArchitectureStyle?: (style: 'glass_modern') => void;
  onViewModelHouse?: (style?: 'glass_modern') => void;
  onEnterOwnHouse?: (style?: 'glass_modern') => void;
  onBuyHouseWithRespite?: (
    priceRespite: number,
    style?: 'glass_modern',
  ) => Promise<boolean> | boolean | void;
  onConnectWallet?: () => void;
  onSwitchToSwapNear: (suggestedNear: number) => void;
  onNotifySpeech: (text: string) => void;
}) {
  const isOwned = Boolean(walletConnected && hasHouseOwnership);
  const effectiveOwnedStyle = isOwned ? ownedHouseStyle ?? houseArchitectureStyle : null;
  const [selectedStyle, setSelectedStyle] = useState<'glass_modern'>(
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
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2">
        {([{ id: 'glass_modern', label: 'Glass Modern' }] as const).map((opt) => (
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
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition-all ${
              selectedStyle === opt.id
                ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-sky-50 hover:text-sky-700'
            }`}
          >
            {isOwned && effectiveOwnedStyle === opt.id ? `${opt.label} · Deed` : opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
        <span>
          Price: <strong className="text-violet-600">{HOUSE_OWNERSHIP_PRICE_RESPITE} RESPITE</strong>
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
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Preview</span>
            </button>
          )}
          {!isOwned && !canAfford && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onSwitchToSwapNear(neededNear);
              }}
              className="px-3 py-1.5 rounded-full bg-violet-100 hover:bg-violet-200 text-violet-800 border border-violet-200/80 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Swap {neededNear} NEAR</span>
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
                className="ml-auto px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Enter your house</span>
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
                  className="ml-auto px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-xs text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    Enter owned Glass Modern
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
              className={`ml-auto px-3.5 py-1.5 rounded-full text-[11px] font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors ${
                canAfford && !busy
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{busy ? 'Signing...' : `Buy house (${HOUSE_OWNERSHIP_PRICE_RESPITE} R)`}</span>
            </button>
          )}
        </div>
      )}
      {feedback && (
        <div
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-medium ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
              : 'bg-rose-50 border-rose-200/80 text-rose-700'
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
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        {item.category !== 'fishing_gear' ? (
          <div className="w-20 shrink-0 rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50">
            <Furniture3dThumbnail
              catalogId={item.id}
              name={item.name}
              iconEmoji={item.iconEmoji}
              size="compact"
              onInspect={onInspectFurniture ? () => onInspectFurniture(item) : undefined}
            />
          </div>
        ) : (
          <div className="w-12 h-12 shrink-0 rounded-xl bg-sky-50 border border-sky-200/80 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-sky-500" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-xs font-semibold text-slate-900 truncate">
            {item.name}
          </div>
          <div className="text-[11px] text-slate-500 leading-snug">
            {item.description}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold flex-wrap">
            <span className={item.currency === 'CYON' ? 'text-sky-600' : 'text-violet-600'}>
              {quote.buyPrice} {item.currency}
            </span>
            <span className="text-slate-400 font-medium">Stock {quote.stock}</span>
            <span className="text-slate-400 font-medium">
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
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 text-[10.5px] font-semibold cursor-pointer transition-colors"
          >
            Browse all
          </button>

          {balance < quote.buyPrice && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onNeedFundsSwitch(item.currency, quote.buyPrice - balance);
              }}
              className="px-3 py-1.5 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200/80 text-[10.5px] font-semibold cursor-pointer transition-colors"
            >
              Get {item.currency} here
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
              className="ml-auto px-3.5 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 shadow-xs text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Sell (+{quote.sellbackPrice} {item.currency})
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
              className={`ml-auto px-3.5 py-1.5 rounded-full text-[11px] font-semibold shadow-xs transition-colors ${
                canBuy && !busy
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {busy
                ? 'Buying...'
                : needsHouse
                  ? 'Own house first'
                  : quote.stock <= 0
                    ? 'Out of stock'
                    : `Buy (${quote.buyPrice} ${item.currency})`}
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-medium flex items-center justify-between gap-2 ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
              : 'bg-rose-50 border-rose-200/80 text-rose-700'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.txHash && (
            <a
              href={feedback.explorerUrl || getNearBlocksTxUrl(feedback.txHash, 'testnet')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:text-sky-700 underline font-mono shrink-0"
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
 * Neo-brutalist city location list rendered inside Exchange Quick View.
 * Clicking any location box transforms that box into a YES / NO teleport confirmation.
 */
export function InlineTeleportPlacesPanel({
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
    const visibleList = getTravelDistrictDestinations();
    const priorityIds: CityTransitStationId[] = [currentStationId];
    if (focusStationId && focusStationId !== currentStationId) {
      priorityIds.push(focusStationId);
    }
    const prioritized = priorityIds
      .map((id) => visibleList.find((d) => d.id === id))
      .filter((d): d is CityTransitDestinationSpec => Boolean(d));
    const remaining = visibleList.filter(
      (d) => !priorityIds.includes(d.id),
    );
    return [...prioritized, ...remaining];
  }, [currentStationId, focusStationId]);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-slate-500">
        Click any location box below to teleport straight there.
      </div>
      <div
        data-chat-teleport-list="true"
        className="p-2.5 rounded-2xl bg-[#f2f4f8] border border-slate-200/80 space-y-2 max-h-[252px] overflow-y-auto"
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
                className="w-full p-2.5 rounded-xl bg-sky-50 border border-sky-300 shadow-sm flex items-center gap-2.5 transition-all duration-150"
              >
                <img
                  src={thumbSrc}
                  alt={dest.shortTitle}
                  className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 leading-tight truncate">
                    {isHere
                      ? `Re-center at ${dest.title}?`
                      : `Teleport to ${dest.title}?`}
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
                      className="px-3.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs active:scale-95 text-[10.5px] font-semibold cursor-pointer transition-all"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      data-chat-teleport-no={dest.id}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setConfirmingDestId(null);
                      }}
                      className="px-3.5 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-xs active:scale-95 text-[10.5px] font-semibold cursor-pointer transition-all"
                    >
                      No
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
              className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-left transition-all duration-150 cursor-pointer border shadow-xs ${
                isFocused
                  ? 'bg-sky-50 hover:bg-sky-100/80 border-sky-300 ring-1 ring-sky-200'
                  : 'bg-white hover:bg-sky-50/60 border-slate-200/80 hover:border-sky-200'
              }`}
            >
              <img
                src={thumbSrc}
                alt={dest.shortTitle}
                className="w-11 h-11 rounded-lg object-cover border border-slate-200/80 shrink-0 bg-slate-100"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {dest.title}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {isHere ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[9.5px] font-semibold">
                      Here
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[9.5px] font-semibold ${
                        dest.id === 'warzone_arena'
                          ? 'bg-rose-100 text-rose-700 border-rose-200/80'
                          : 'bg-sky-100 text-sky-700 border-sky-200/80'
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
    exchange_lul_cyon: 'In-chat exchange · LUL -> CYON',
    swap_near_respite: 'In-chat swap · NEAR -> RESPITE',
    buy_house: 'In-chat house deal',
    buy_catalog_item: matchedItem ? `Quick buy · ${matchedItem.name}` : 'Quick item deal',
    browse_catalog: 'Quick shop ready',
    invest_shop: 'Support shop reserve',
    claim_welcome: 'Starter pack bonus',
    teleport_places: 'City teleport · Select location',
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
      className="p-3.5 rounded-2xl bg-white/95 text-slate-900 border border-slate-200/80 shadow-sm space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 truncate">
          {intent.kind === 'teleport_places' ? (
            <MapPin className="w-3.5 h-3.5 shrink-0 text-sky-500" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" aria-hidden="true" />
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
              className="px-2.5 py-1 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <Store className="w-3 h-3" aria-hidden="true" />
              <span>Open modal</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Close transaction card"
            onClick={() => {
              soundEngine.playUiClick();
              onChangeIntent(null);
            }}
            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
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
        <div className="space-y-2.5">
          <div className="text-[11px] font-medium text-slate-600">
            Browse items, swap currencies, or buy directly inside the Chat Quick Shop without leaving this conversation.
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenQuickModal(modalTabForIntent);
              }}
              className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            >
              <Store className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Open quick shop</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenQuickModal('exchange');
              }}
              className="px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-xs text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Open exchange</span>
            </button>
          </div>
        </div>
      )}

      {intent.kind === 'invest_shop' && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-medium text-slate-600">
            The shop holds <strong className="text-sky-600">{props.marketState.treasuryCyon} CYON</strong>. Back the shop with 300 LUL to receive +45 CYON and a 15% catalog discount.
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
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold shadow-xs transition-colors ${
                props.lulBalance >= 300
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Support shop (300 LUL)
            </button>
          )}
        </div>
      )}

      {intent.kind === 'claim_welcome' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
            <span>Starter Pack: 0.30 NEAR + 100 LUL + 20 CYON</span>
            {props.hanaWelcomeNearClaimed && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[10px] font-semibold">
                Claimed
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
              className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            >
              <Gift className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{claimingBonus ? 'Claiming...' : 'Claim starter pack'}</span>
            </button>
          ) : null}
          {bonusResult && (
            <div className="text-[11px] font-medium text-emerald-700">{bonusResult}</div>
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
 * Shared Quick Shop / Fishing Gear items grid reused by both QuickShopChatModal
 * and the Exchange tab's embedded QUICK SHOP / FISHING GEAR views.
 */
export const QuickShopItemsPanel: React.FC<ChatTxSharedProps> = (props) => {
  const { merchantLocation } = props;
  const [itemFeedback, setItemFeedback] = useState<{
    ok: boolean;
    text: string;
    txHash?: string;
    explorerUrl?: string;
  } | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const visibleItems = MERCHANT_CATALOG_ITEMS.filter((item) =>
    merchantLocation === 'beach_house'
      ? item.category === 'fishing_gear'
      : item.category !== 'fishing_gear',
  );

  return (
    <div className="space-y-2.5">
      {!props.walletConnected && <GuestSignInStrip onConnectWallet={props.onConnectWallet} />}
      {itemFeedback && (
        <div
          className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center justify-between gap-2 ${
            itemFeedback.ok
              ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
              : 'bg-rose-50 border-rose-200/80 text-rose-700'
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
              className="text-sky-600 hover:text-sky-700 underline font-mono shrink-0"
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
              className="p-3 rounded-2xl bg-slate-50/90 text-slate-900 border border-slate-200/80 shadow-xs flex flex-col gap-2.5"
            >
              <div className="flex items-start gap-2.5">
                {item.category !== 'fishing_gear' ? (
                  <div className="w-16 shrink-0 rounded-xl border border-slate-200/80 overflow-hidden bg-white">
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
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-sky-50 border border-sky-200/80 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-sky-500" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {item.name}
                  </div>
                  <div className="text-[10.5px] font-medium text-slate-500 mt-0.5">
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
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-sky-50 text-slate-700 border border-slate-200/80 text-[10px] font-semibold cursor-pointer transition-colors"
                  >
                    3D view
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
                  className={`ml-auto px-3 py-1 rounded-full text-[10.5px] font-semibold shadow-xs transition-colors ${
                    canBuy && busyItemId !== item.id
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {busyItemId === item.id
                    ? 'Buying...'
                    : needsHouse
                      ? 'Needs house'
                      : isOwned && !item.interiorSlot
                        ? 'Owned'
                        : `Buy ${quote.buyPrice} ${item.currency === 'RESPITE' ? 'R' : item.currency}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
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

  useEffect(() => {
    if (isOpen) {
      setModalTab(
        initialTab === 'house' && merchantLocation !== 'lobby_cafe' ? 'items' : initialTab,
      );
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

  return (
    <div
      data-chat-quick-tx-modal="true"
      className="fixed inset-0 z-[75] bg-slate-900/45 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[86vh] rounded-[24px] bg-[#e8ecf2]/96 backdrop-blur-2xl text-slate-900 border border-white/80 shadow-[0_24px_64px_rgba(15,23,42,0.28)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-white/90 border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold text-slate-900 truncate">
              {merchantLocation === 'lobby_cafe'
                ? "Hana's Chat Checkout"
                : "Kai's Chat Checkout"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close quick checkout modal"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-2.5 bg-white/60 border-b border-slate-200/70 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setModalTab('exchange');
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                modalTab === 'exchange'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <ArrowRightLeft className="w-3 h-3" aria-hidden="true" />
              <span>Exchange</span>
            </button>
            {merchantLocation === 'lobby_cafe' && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setModalTab('house');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                  modalTab === 'house'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Home className="w-3 h-3" aria-hidden="true" />
                <span>House</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setModalTab('items');
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                modalTab === 'items'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Sofa className="w-3 h-3" aria-hidden="true" />
              <span>{merchantLocation === 'beach_house' ? 'Fishing Gear' : 'Items & Themes'}</span>
            </button>
          </div>
          <div className="text-[10.5px] font-semibold text-slate-600 flex items-center gap-2">
            <span>{props.lulBalance.toLocaleString()} LUL</span>
            <span>{props.cyonBalance.toLocaleString()} CYON</span>
            <span>{props.respiteBalance.toLocaleString()} R</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {modalTab === 'exchange' && (
            <>
              <div className="p-4 rounded-2xl bg-white text-slate-900 border border-slate-200/70 shadow-sm space-y-2.5">
                <div className="text-xs font-semibold text-sky-600 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" aria-hidden="true" />
                  <span>Exchange LUL -&gt; CYON</span>
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

              <div className="p-4 rounded-2xl bg-white text-slate-900 border border-slate-200/70 shadow-sm space-y-2.5">
                <div className="text-xs font-semibold text-violet-600 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Swap NEAR -&gt; RESPITE</span>
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
            <div className="p-4 rounded-2xl bg-white text-slate-900 border border-slate-200/70 shadow-sm space-y-2.5">
              <div className="text-xs font-semibold text-sky-600 flex items-center gap-1.5">
                <Home className="w-4 h-4" aria-hidden="true" />
                <span>Private House Ownership</span>
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
            <div className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-sm">
              <QuickShopItemsPanel {...props} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
