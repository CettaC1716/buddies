import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Clock,
  Coins,
  Delete,
  Eye,
  EyeOff,
  History,
  Lock,
  Send,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  BALANCE_PEEK_DURATION_MS,
  buildOrderedWalletBalances,
  MASKED_BALANCE_TEXT,
  type WalletCurrencyId,
} from '../lib/phoneHomeCityNews';
import {
  canConfirmPendingTx,
  formatPendingTxCountdown,
  formatPendingTxSummary,
  getPendingTxRemainingSeconds,
  type PendingWalletTxItem,
} from '../lib/pendingWalletTxQueue';
import {
  hasWalletPinConfigured,
  isValidWalletPinFormat,
  saveWalletPin,
  verifyWalletPin,
  WALLET_PIN_MAX_LENGTH,
  WALLET_PIN_MIN_LENGTH,
} from '../lib/walletPinLock';
import { InGameWalletConfirmModal } from './InGameWalletConfirmModal';

export interface WalletHistoryTxItem {
  id: string;
  action_type: string;
  item_id?: string | null;
  reasoning_summary?: string | null;
  created_at: string;
  near_tx_hash?: string | null;
  amountText: string;
  badgeCurrency: 'RESPITE' | 'NEAR' | 'LUL' | 'CYON';
  actionLabel: string;
}

export interface PersonalWalletPanelProps {
  embeddedInPhone: boolean;
  onClose?: () => void;
  isUnlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  activeTab: 'wallet' | 'exchange' | 'history';
  onSelectTab: (tab: 'wallet' | 'exchange' | 'history') => void;
  connectedGoogleEmail: string;
  walletId: string;
  playerUid: string;
  walletConnected: boolean;
  isReadOnlyWallet: boolean;
  hideBalancesDefault?: boolean;
  respiteBalance: number;
  nearBalance: number;
  lulBalance: number;
  cyonBalance: number;
  onLogOut: () => void;
  onOpenWalletSelector: () => void;
  respiteTransferRecipient: string;
  onChangeRespiteTransferRecipient: (value: string) => void;
  respiteTransferAmount: string;
  onChangeRespiteTransferAmount: (value: string) => void;
  respiteTransferStatus: {
    type: 'success' | 'error';
    text: string;
    txHash?: string;
  } | null;
  onSendRespite: () => Promise<void>;
  historyFilter: 'ALL' | 'RESPITE' | 'NEAR' | 'LUL' | 'CYON';
  onChangeHistoryFilter: (filter: 'ALL' | 'RESPITE' | 'NEAR' | 'LUL' | 'CYON') => void;
  historyItems: readonly WalletHistoryTxItem[];
  isLoadingHistory: boolean;
  onRefreshHistory: () => void;
  pendingTxs: readonly PendingWalletTxItem[];
  nowMs: number;
  onConfirmPendingTx: (txId: string) => void;
  onRejectPendingTx: (txId: string) => void;
  /** Exchange & Swap integration moved 100% from Hana chat modal into Smartphone Wallet */
  lulCostFor10Cyon?: number;
  onExchangeLulToCyon?: (customLulSpent?: number, customCyonGranted?: number) => void;
  onSwapNearAndRespite?: (
    direction: 'near_to_respite' | 'respite_to_near',
    amountIn: number,
  ) => Promise<{
    ok: boolean;
    txHash?: string;
    error?: string;
    amountOut: number;
  }>;
  hanaWelcomeNearClaimed?: boolean;
  onClaimHanaWelcomeNear?: () => Promise<{
    ok: boolean;
    txHash?: string;
    error?: string;
  }>;
}

const CURRENCY_BADGE_STYLE: Record<
  WalletCurrencyId,
  { gradient: string; glyph: React.ReactNode }
> = {
  RESPITE: {
    gradient: 'from-violet-400 to-purple-600',
    glyph: <span className="font-bold text-[11px]">RS</span>,
  },
  NEAR: {
    gradient: 'from-emerald-400 to-teal-600',
    glyph: <span className="font-bold text-xs">N</span>,
  },
  LUL: {
    gradient: 'from-amber-400 to-orange-500',
    glyph: <Coins className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />,
  },
  CYON: {
    gradient: 'from-sky-400 to-blue-600',
    glyph: <span className="font-bold text-[11px]">CY</span>,
  },
};

export const PersonalWalletPanel: React.FC<PersonalWalletPanelProps> = ({
  embeddedInPhone,
  onClose,
  isUnlocked,
  onUnlock,
  onLock,
  activeTab,
  onSelectTab,
  connectedGoogleEmail,
  walletId,
  playerUid,
  walletConnected,
  isReadOnlyWallet,
  hideBalancesDefault = true,
  respiteBalance,
  nearBalance,
  lulBalance,
  cyonBalance,
  onLogOut: _onLogOut,
  onOpenWalletSelector,
  respiteTransferRecipient,
  onChangeRespiteTransferRecipient,
  respiteTransferAmount,
  onChangeRespiteTransferAmount,
  respiteTransferStatus,
  onSendRespite,
  historyFilter,
  onChangeHistoryFilter,
  historyItems,
  isLoadingHistory,
  onRefreshHistory,
  pendingTxs,
  nowMs,
  onConfirmPendingTx,
  onRejectPendingTx,
  lulCostFor10Cyon = 100,
  onExchangeLulToCyon,
  onSwapNearAndRespite,
  hanaWelcomeNearClaimed = false,
  onClaimHanaWelcomeNear,
}) => {
  const [hasPin, setHasPin] = useState<boolean>(() => hasWalletPinConfigured());
  const [pinStep, setPinStep] = useState<'enter' | 'create' | 'confirm'>(() =>
    hasWalletPinConfigured() ? 'enter' : 'create',
  );
  const [pinDraft, setPinDraft] = useState<string>('');
  const [firstPinDraft, setFirstPinDraft] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);

  const [isBalanceVisible, setIsBalanceVisible] = useState<boolean>(() => !hideBalancesDefault);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [activeReviewTxId, setActiveReviewTxId] = useState<string | null>(null);

  // Smartphone Wallet Exchange & Swap state
  const [swapDirection, setSwapDirection] = useState<'near_to_respite' | 'respite_to_near'>(
    'near_to_respite',
  );
  const [swapAmountStr, setSwapAmountStr] = useState<string>('0.20');
  const [isSwappingNear, setIsSwappingNear] = useState<boolean>(false);
  const [ isClaimingGrant, setIsClaimingGrant] = useState<boolean>(false);
  const [cyonPackets, setCyonPackets] = useState<number>(1);
  const [exchangeFeedback, setExchangeFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    txHash?: string;
  } | null>(null);

  const peekTimerRef = useRef<number | null>(null);
  const prevPendingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setIsBalanceVisible(!hideBalancesDefault);
    if (peekTimerRef.current !== null) {
      window.clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  }, [hideBalancesDefault]);

  // Re-sync PIN status whenever Wallet locks
  useEffect(() => {
    if (!isUnlocked) {
      const configured = hasWalletPinConfigured();
      setHasPin(configured);
      setPinStep(configured ? 'enter' : 'create');
      setPinDraft('');
      setFirstPinDraft('');
      setPinError(null);
      setIsBalanceVisible(!hideBalancesDefault);
      setActiveReviewTxId(null);
      if (peekTimerRef.current !== null) {
        window.clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
      }
    }
  }, [isUnlocked, hideBalancesDefault]);

  // Cleanup peek timer on unmount
  useEffect(() => {
    return () => {
      if (peekTimerRef.current !== null) {
        window.clearTimeout(peekTimerRef.current);
      }
    };
  }, []);

  // Auto-open in-phone confirmation modal if a new pending tx arrives while Wallet is unlocked
  useEffect(() => {
    const currentIds = new Set(pendingTxs.map((tx) => tx.id));
    if (isUnlocked && pendingTxs.length > 0) {
      const newlyArrived = pendingTxs.find((tx) => !prevPendingIdsRef.current.has(tx.id));
      if (newlyArrived && !activeReviewTxId) {
        setActiveReviewTxId(newlyArrived.id);
      }
    }
    if (activeReviewTxId && !currentIds.has(activeReviewTxId)) {
      setActiveReviewTxId(null);
    }
    prevPendingIdsRef.current = currentIds;
  }, [isUnlocked, pendingTxs, activeReviewTxId]);

  const activePendingCount = useMemo(
    () => pendingTxs.filter((tx) => canConfirmPendingTx(tx, nowMs)).length,
    [pendingTxs, nowMs],
  );

  const reviewedTx = useMemo(
    () => pendingTxs.find((tx) => tx.id === activeReviewTxId) ?? null,
    [pendingTxs, activeReviewTxId],
  );

  const orderedBalances = useMemo(
    () =>
      buildOrderedWalletBalances({
        respiteBalance,
        nearBalance,
        lulBalance,
        cyonBalance,
        includeCyon: true,
      }),
    [respiteBalance, nearBalance, lulBalance, cyonBalance],
  );

  const toggleBalancePeek = () => {
    soundEngine.playUiClick();
    if (peekTimerRef.current !== null) {
      window.clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    if (isBalanceVisible) {
      setIsBalanceVisible(false);
      return;
    }
    setIsBalanceVisible(true);
    if (hideBalancesDefault) {
      peekTimerRef.current = window.setTimeout(() => {
        setIsBalanceVisible(false);
        peekTimerRef.current = null;
      }, BALANCE_PEEK_DURATION_MS);
    }
  };

  const appendPinDigit = (digit: string) => {
    if (isVerifyingPin) return;
    setPinError(null);
    setPinDraft((prev) => (prev.length < WALLET_PIN_MAX_LENGTH ? `${prev}${digit}` : prev));
  };

  const backspacePin = () => {
    if (isVerifyingPin) return;
    setPinError(null);
    setPinDraft((prev) => prev.slice(0, -1));
  };

  const submitPinStep = async () => {
    if (isVerifyingPin) return;
    if (!isValidWalletPinFormat(pinDraft)) {
      setPinError(`Enter ${WALLET_PIN_MIN_LENGTH} to ${WALLET_PIN_MAX_LENGTH} digits.`);
      return;
    }

    if (pinStep === 'create') {
      setFirstPinDraft(pinDraft);
      setPinDraft('');
      setPinError(null);
      setPinStep('confirm');
      return;
    }

    if (pinStep === 'confirm') {
      if (pinDraft !== firstPinDraft) {
        setPinError("PINs didn't match. Try again.");
        setPinDraft('');
        setFirstPinDraft('');
        setPinStep('create');
        return;
      }
      setIsVerifyingPin(true);
      try {
        await saveWalletPin(pinDraft);
        setHasPin(true);
        setPinDraft('');
        setFirstPinDraft('');
        setPinError(null);
        soundEngine.playUiConfirm();
        onUnlock();
      } catch {
        setPinError('Could not save PIN on this device.');
      } finally {
        setIsVerifyingPin(false);
      }
      return;
    }

    setIsVerifyingPin(true);
    try {
      const ok = await verifyWalletPin(pinDraft);
      if (ok) {
        setPinDraft('');
        setPinError(null);
        soundEngine.playUiConfirm();
        onUnlock();
      } else {
        setPinError('Wrong PIN. Try again.');
        setPinDraft('');
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Support physical keyboard entry on the PIN screen
  useEffect(() => {
    if (isUnlocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        appendPinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        backspacePin();
      } else if (e.key === 'Enter' && pinDraft.length >= WALLET_PIN_MIN_LENGTH) {
        e.preventDefault();
        e.stopPropagation();
        void submitPinStep();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const filteredHistory = useMemo(
    () =>
      historyItems.filter((tx) =>
        historyFilter === 'ALL' ? true : tx.badgeCurrency === historyFilter,
      ),
    [historyItems, historyFilter],
  );

  const shellClass = embeddedInPhone
    ? 'relative w-full h-full flex-1 flex flex-col bg-transparent text-white overflow-hidden min-h-0'
    : 'relative flex-1 flex flex-col rounded-[28px] bg-gradient-to-b from-[#171d2c]/88 via-[#111622]/86 to-[#0c101a]/90 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_64px_rgba(0,0,0,0.58)] text-white overflow-hidden min-h-0';

  if (!isUnlocked) {
    const title =
      pinStep === 'create'
        ? 'Create Wallet PIN'
        : pinStep === 'confirm'
          ? 'Confirm Your PIN'
          : 'Enter Wallet PIN';
    const subtitle =
      pinStep === 'create'
        ? 'Choose 4 to 6 digits to keep your balances private on this device.'
        : pinStep === 'confirm'
          ? 'Enter the same PIN one more time.'
          : 'Unlock to view balances and review requests.';

    return (
      <div data-personal-wallet-modal={embeddedInPhone ? 'true' : undefined} className={shellClass}>
        <div
          className={`flex items-center justify-between gap-2 border-b border-white/12 shrink-0 ${
            embeddedInPhone ? 'px-4 py-3' : 'px-5 py-3.5'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
            <Lock className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
            <span>Wallet</span>
          </div>
          {!embeddedInPhone && onClose && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiCancel();
                onClose();
              }}
              aria-label="Close Wallet"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          data-wallet-pin-screen="true"
          data-wallet-pin-mode={pinStep}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-5 flex flex-col items-center justify-center gap-4"
        >
          <div className="text-center space-y-1.5 max-w-[260px]">
            <div className="w-11 h-11 mx-auto rounded-2xl bg-white/10 border border-white/18 flex items-center justify-center shadow-inner">
              <Lock className="w-5 h-5 text-amber-300" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-[11px] text-white/65 leading-relaxed">{subtitle}</p>
            {activePendingCount > 0 && hasPin && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/18 border border-amber-300/35 text-[10.5px] font-semibold text-amber-200 mt-1">
                <span>
                  {activePendingCount}{' '}
                  {activePendingCount === 1 ? 'request waiting' : 'requests waiting'}
                </span>
              </div>
            )}
          </div>

          {/* PIN dot indicators (4-6 digits) */}
          <div
            aria-label={`${pinDraft.length} digits entered`}
            className="flex items-center justify-center gap-2.5 h-7"
          >
            {Array.from({ length: WALLET_PIN_MAX_LENGTH }).map((_, idx) => {
              const filled = idx < pinDraft.length;
              const isOptionalSlot = idx >= WALLET_PIN_MIN_LENGTH;
              return (
                <span
                  key={idx}
                  className={`w-3 h-3 rounded-full transition-all border ${
                    filled
                      ? 'bg-amber-300 border-amber-200 scale-110 shadow-[0_0_10px_rgba(252,211,77,0.45)]'
                      : isOptionalSlot
                        ? 'bg-white/[0.04] border-white/15'
                        : 'bg-white/10 border-white/30'
                  }`}
                />
              );
            })}
          </div>

          {pinError && (
            <div
              role="alert"
              className="px-3 py-1.5 rounded-xl bg-rose-500/18 border border-rose-400/35 text-[11px] font-medium text-rose-200 text-center"
            >
              {pinError}
            </div>
          )}

          {/* Glass numeric keypad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[236px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                data-wallet-pin-digit={digit}
                disabled={isVerifyingPin}
                onClick={() => {
                  soundEngine.playSoftTap();
                  appendPinDigit(digit);
                }}
                className="h-11 rounded-2xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 border border-white/15 text-base font-semibold font-mono text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              disabled={isVerifyingPin || pinDraft.length === 0}
              onClick={() => {
                soundEngine.playSoftTap();
                setPinDraft('');
                setPinError(null);
              }}
              className="h-11 rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] active:scale-95 border border-white/12 text-[11px] font-semibold text-white/70 hover:text-white transition-all cursor-pointer disabled:opacity-35"
            >
              Clear
            </button>
            <button
              type="button"
              data-wallet-pin-digit="0"
              disabled={isVerifyingPin}
              onClick={() => {
                soundEngine.playSoftTap();
                appendPinDigit('0');
              }}
              className="h-11 rounded-2xl bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 border border-white/15 text-base font-semibold font-mono text-white transition-all cursor-pointer disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={isVerifyingPin || pinDraft.length === 0}
              onClick={() => {
                soundEngine.playSoftTap();
                backspacePin();
              }}
              aria-label="Delete digit"
              className="h-11 rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] active:scale-95 border border-white/12 text-white/75 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-35"
            >
              <Delete className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            data-wallet-pin-submit="true"
            disabled={isVerifyingPin || pinDraft.length < WALLET_PIN_MIN_LENGTH}
            onClick={() => {
              soundEngine.playUiClick();
              void submitPinStep();
            }}
            className="w-full max-w-[236px] py-2.5 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/35 text-slate-950 font-semibold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isVerifyingPin
              ? 'Checking...'
              : pinStep === 'create'
                ? 'Continue'
                : pinStep === 'confirm'
                  ? 'Save PIN'
                  : 'Unlock Wallet'}
          </button>

          <p className="text-[10px] text-white/45 text-center max-w-[240px] leading-relaxed">
            Privacy screen lock stored only on this device. Locks again when you close the phone.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-personal-wallet-modal={embeddedInPhone ? 'true' : undefined} className={shellClass}>
      {/* Top tab bar */}
      <div
        className={`flex items-center justify-between gap-2 bg-transparent border-b border-white/12 shrink-0 ${
          embeddedInPhone ? 'px-3.5 py-2.5' : 'px-5 py-3.5'
        }`}
      >
        <div
          role="tablist"
          aria-label="Wallet Sections"
          className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/[0.07] border border-white/14"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'wallet'}
            data-wallet-tab="wallet"
            onClick={() => {
              soundEngine.playUiClick();
              onSelectTab('wallet');
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'wallet'
                ? 'bg-white/20 text-white shadow-xs'
                : 'text-white/65 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
            <span>Wallet</span>
            {activePendingCount > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {activePendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'exchange'}
            data-wallet-tab="exchange"
            onClick={() => {
              soundEngine.playUiClick();
              setExchangeFeedback(null);
              onSelectTab('exchange');
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'exchange'
                ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/35 shadow-xs'
                : 'text-white/65 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
            <span>Exchange</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            data-wallet-tab="history"
            onClick={() => {
              soundEngine.playUiClick();
              onSelectTab('history');
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white/20 text-white shadow-xs'
                : 'text-white/65 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <History className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
            <span>History</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onLock();
          }}
          aria-label="Lock Wallet"
          title="Lock Wallet"
          className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-white/75 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        {!embeddedInPhone && onClose && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiCancel();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-white/80 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close Wallet"
          >
            <X className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Main scrollable content */}
      <div
        className={`flex-1 overflow-y-auto no-scrollbar space-y-3 min-h-0 ${
          embeddedInPhone ? 'p-3.5' : 'p-4 sm:p-5'
        }`}
      >
        {activeTab === 'wallet' ? (
          <>
            {/* PENDING REQUESTS */}
            {pendingTxs.length > 0 && (
              <div data-wallet-pending-section="true" className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-200">
                    Waiting for Confirmation
                  </span>
                  <span className="text-[10.5px] font-semibold text-white/60">
                    {activePendingCount} active
                  </span>
                </div>

                {pendingTxs.map((tx) => {
                  const summary = formatPendingTxSummary(tx.request);
                  const expired = !canConfirmPendingTx(tx, nowMs);
                  const remainingSec = getPendingTxRemainingSeconds(tx, nowMs);
                  return (
                    <div
                      key={tx.id}
                      data-wallet-pending-tx-card={tx.id}
                      className={`rounded-2xl p-3 border space-y-2 ${
                        expired
                          ? 'bg-rose-500/10 border-rose-400/30'
                          : 'bg-amber-500/12 border-amber-300/35'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {summary.actionLabel}
                          </div>
                          <div className="text-[10.5px] text-white/65 truncate mt-0.5">
                            To: <span className="font-mono">{summary.recipientLabel}</span>
                          </div>
                        </div>
                        {summary.amountLabel && (
                          <span className="px-2 py-0.5 rounded-full bg-white/12 border border-white/15 text-[10.5px] font-mono font-semibold text-emerald-300 shrink-0">
                            {summary.amountLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                        <span
                          className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${
                            expired ? 'text-rose-200' : 'text-amber-200'
                          }`}
                        >
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {expired
                            ? 'Expired'
                            : `Expires in ${formatPendingTxCountdown(remainingSec)}`}
                        </span>

                        {expired ? (
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              onRejectPendingTx(tx.id);
                            }}
                            className="px-3 py-1 rounded-full bg-white/12 hover:bg-white/20 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            Dismiss
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-wallet-review-tx-btn={tx.id}
                            onClick={() => {
                              soundEngine.playUiClick();
                              setActiveReviewTxId(tx.id);
                            }}
                            className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BALANCES (clean dark-glass rows, RESPITE -> NEAR -> LUL -> CYON, masked by default) */}
            <div data-wallet-balances-section="true" className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold text-white/85">Balances</span>
                <button
                  type="button"
                  data-wallet-balance-visibility-toggle="true"
                  onClick={toggleBalancePeek}
                  aria-label={isBalanceVisible ? 'Hide balances' : 'Show balances briefly'}
                  title={isBalanceVisible ? 'Hide balances' : 'Peek balances'}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  {isBalanceVisible ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Peek</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-2xl bg-white/[0.06] border border-white/12 divide-y divide-white/10 overflow-hidden">
                {orderedBalances.map((row) => {
                  const style = CURRENCY_BADGE_STYLE[row.id];
                  return (
                    <div
                      key={row.id}
                      data-wallet-balance-row={row.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl bg-gradient-to-br ${style.gradient} text-white shadow-sm flex items-center justify-center shrink-0`}
                        >
                          {style.glyph}
                        </div>
                        <span className="text-xs font-semibold text-white/95 tracking-wide">
                          {row.label}
                        </span>
                      </div>
                      <span
                        data-wallet-balance-amount={row.id}
                        className="text-sm font-bold font-mono tabular-nums text-white shrink-0"
                      >
                        {isBalanceVisible ? row.formattedAmount : MASKED_BALANCE_TEXT}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* WALLET CONNECTION (Account session & Log Out moved to Settings -> Account) */}
            <div
              data-wallet-uid-and-username-card="true"
              className="rounded-2xl bg-white/[0.06] border border-white/12 p-3.5 space-y-2"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-medium text-white/55">Wallet</span>
                  {walletConnected && walletId && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isReadOnlyWallet
                          ? 'bg-amber-500/15 text-amber-200 border-amber-300/30'
                          : 'bg-emerald-500/15 text-emerald-200 border-emerald-300/30'
                      }`}
                    >
                      {isReadOnlyWallet ? 'View Only' : 'Connected'}
                    </span>
                  )}
                </div>

                {walletConnected && walletId ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        data-wallet-active-uid="true"
                        className="text-[11px] font-mono text-sky-300 break-all"
                      >
                        {walletId}
                      </div>
                      <button
                        type="button"
                        data-copy-wallet-address-btn="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          const addr = walletId || playerUid;
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            void navigator.clipboard.writeText(addr);
                          }
                          setCopiedAddress(true);
                          window.setTimeout(() => setCopiedAddress(false), 1800);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 font-semibold text-[10.5px] transition-colors cursor-pointer shrink-0"
                      >
                        {copiedAddress ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <button
                      type="button"
                      data-personal-wallet-switch-signer-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onOpenWalletSelector();
                      }}
                      className="w-full py-2 px-3 rounded-full bg-white/12 hover:bg-white/20 text-white border border-white/18 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      {isReadOnlyWallet ? 'Connect Wallet' : 'Manage Wallet'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span data-wallet-active-uid="true" className="text-xs text-white/60">
                      Not connected
                    </span>
                    <button
                      type="button"
                      data-personal-wallet-open-selector-btn="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onOpenWalletSelector();
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* SEND RESPITE (dark glass) */}
            <div
              data-wallet-send-respite-card="true"
              className="rounded-2xl bg-white/[0.06] border border-white/12 p-3.5 space-y-2.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
                <Send className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
                <span>Send RESPITE</span>
              </div>
              <input
                type="text"
                value={respiteTransferRecipient}
                onChange={(e) => onChangeRespiteTransferRecipient(e.target.value)}
                placeholder="Recipient username or wallet"
                className="w-full px-3 py-2 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder:text-white/40 font-mono text-xs focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-violet-400/45 focus:border-violet-300/60"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={respiteTransferAmount}
                  onChange={(e) => onChangeRespiteTransferAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-28 px-3 py-2 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder:text-white/40 font-mono tabular-nums font-semibold text-xs focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-violet-400/45 focus:border-violet-300/60"
                />
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    void onSendRespite();
                  }}
                  className="flex-1 px-4 py-2 rounded-full bg-violet-500 hover:bg-violet-400 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Send
                </button>
              </div>
              {respiteTransferStatus && (
                <div
                  className={`px-3 py-2 rounded-xl border text-xs font-medium ${
                    respiteTransferStatus.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                  }`}
                >
                  <div>{respiteTransferStatus.text}</div>
                  {respiteTransferStatus.txHash && (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${respiteTransferStatus.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-sky-300 break-all"
                    >
                      Receipt
                    </a>
                  )}
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'exchange' ? (
          <div data-wallet-exchange-panel="true" className="space-y-3">
            {/* LIVE BALANCES COMPACT BAR */}
            <div className="rounded-2xl bg-white/[0.06] border border-white/12 p-3 grid grid-cols-2 gap-2">
              <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-violet-300">RESPITE</span>
                <span className="text-xs font-bold font-mono tabular-nums text-white">
                  {respiteBalance.toLocaleString()}
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-emerald-300">NEAR</span>
                <span className="text-xs font-bold font-mono tabular-nums text-white">
                  {nearBalance.toFixed(2)}
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-amber-300">LUL</span>
                <span className="text-xs font-bold font-mono tabular-nums text-white">
                  {lulBalance.toLocaleString()}
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-sky-300">CYON</span>
                <span className="text-xs font-bold font-mono tabular-nums text-white">
                  {cyonBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {exchangeFeedback && (
              <div
                className={`px-3 py-2.5 rounded-2xl border text-xs font-medium ${
                  exchangeFeedback.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                }`}
              >
                <div>{exchangeFeedback.text}</div>
                {exchangeFeedback.txHash && (
                  <a
                    href={`https://testnet.nearblocks.io/txns/${exchangeFeedback.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-sky-300 text-[11px] break-all mt-1 inline-block"
                  >
                    View On-Chain Receipt ↗
                  </a>
                )}
              </div>
            )}

            {/* 1. STARTER WELCOME GRANT (IF UNCLAIMED) */}
            {!hanaWelcomeNearClaimed && onClaimHanaWelcomeNear && (
              <div
                data-wallet-starter-grant-card="true"
                className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/35 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                    <span>Citizen Welcome Grant</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 text-[10px] font-bold">
                    FREE
                  </span>
                </div>
                <p className="text-[11px] text-white/75 leading-snug">
                  Claim your one-time starter balance: <strong>+0.30 NEAR</strong>,{' '}
                  <strong>+100 LUL</strong>, and <strong>+20 CYON</strong>.
                </p>
                <button
                  type="button"
                  disabled={isClaimingGrant}
                  onClick={async () => {
                    soundEngine.playUiClick();
                    setIsClaimingGrant(true);
                    setExchangeFeedback(null);
                    try {
                      const res = await onClaimHanaWelcomeNear();
                      if (res.ok) {
                        setExchangeFeedback({
                          type: 'success',
                          text: 'Claimed Citizen Starter Grant (+0.30 NEAR, +100 LUL, +20 CYON)!',
                          txHash: res.txHash,
                        });
                      } else {
                        setExchangeFeedback({
                          type: 'error',
                          text: res.error || 'Could not claim starter grant right now.',
                        });
                      }
                    } finally {
                      setIsClaimingGrant(false);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  {isClaimingGrant ? 'Claiming Grant...' : 'Claim Starter Grant'}
                </button>
              </div>
            )}

            {/* 2. NEAR <-> RESPITE INSTANT SWAP */}
            <div
              data-wallet-near-respite-swap-card="true"
              className="rounded-2xl bg-white/[0.06] border border-white/12 p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                  <span>Swap NEAR ↔ RESPITE</span>
                </div>
                <span className="text-[10.5px] font-mono text-white/60">1 NEAR = 250 RS</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/[0.06] border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSwapDirection('near_to_respite');
                    setSwapAmountStr('0.20');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                    swapDirection === 'near_to_respite'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  NEAR → RESPITE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSwapDirection('respite_to_near');
                    setSwapAmountStr('50');
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                    swapDirection === 'respite_to_near'
                      ? 'bg-violet-500 text-white font-bold'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  RESPITE → NEAR
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {(swapDirection === 'near_to_respite'
                  ? ['0.10', '0.20', '0.50', '1.00']
                  : ['25', '50', '100', '250']
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setSwapAmountStr(preset);
                    }}
                    className={`flex-1 py-1 rounded-lg text-[10.5px] font-mono font-semibold border cursor-pointer transition-colors ${
                      swapAmountStr === preset
                        ? 'bg-white/20 border-white/40 text-white'
                        : 'bg-white/[0.05] border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  step={swapDirection === 'near_to_respite' ? '0.05' : '5'}
                  min={swapDirection === 'near_to_respite' ? 0.01 : 1}
                  value={swapAmountStr}
                  onChange={(e) => setSwapAmountStr(e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl bg-white/[0.08] border border-white/15 text-white font-mono tabular-nums font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/45"
                />
                <button
                  type="button"
                  disabled={isSwappingNear || !onSwapNearAndRespite}
                  onClick={async () => {
                    if (!onSwapNearAndRespite) return;
                    soundEngine.playUiClick();
                    const amt = Number(swapAmountStr);
                    if (!Number.isFinite(amt) || amt <= 0) {
                      setExchangeFeedback({
                        type: 'error',
                        text: 'Enter a valid swap amount.',
                      });
                      return;
                    }
                    setIsSwappingNear(true);
                    setExchangeFeedback(null);
                    try {
                      const res = await onSwapNearAndRespite(swapDirection, amt);
                      if (res.ok) {
                        setExchangeFeedback({
                          type: 'success',
                          text:
                            swapDirection === 'near_to_respite'
                              ? `Swapped ${amt} NEAR for +${res.amountOut} RESPITE.`
                              : `Swapped ${amt} RESPITE for +${res.amountOut.toFixed(3)} NEAR.`,
                          txHash: res.txHash,
                        });
                      } else {
                        setExchangeFeedback({
                          type: 'error',
                          text: res.error || 'Swap could not be completed.',
                        });
                      }
                    } finally {
                      setIsSwappingNear(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  {isSwappingNear
                    ? 'Swapping...'
                    : swapDirection === 'near_to_respite'
                      ? `Get +${Math.max(0, Math.round((Number(swapAmountStr) || 0) * 250))} RESPITE`
                      : `Get +${Math.max(0, (Number(swapAmountStr) || 0) / 250).toFixed(2)} NEAR`}
                </button>
              </div>
            </div>

            {/* 3. LUL -> CYON CURRENCY EXCHANGE */}
            <div
              data-wallet-lul-cyon-exchange-card="true"
              className="rounded-2xl bg-white/[0.06] border border-white/12 p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Coins className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  <span>Exchange LUL → CYON</span>
                </div>
                <span className="text-[10.5px] font-mono text-amber-200">
                  {lulCostFor10Cyon} LUL = +10 CYON
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {[1, 2, 5, 10].map((pkt) => (
                  <button
                    key={pkt}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setCyonPackets(pkt);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold border cursor-pointer transition-colors ${
                      cyonPackets === pkt
                        ? 'bg-amber-400/25 border-amber-300/60 text-amber-100'
                        : 'bg-white/[0.05] border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    +{pkt * 10} CY
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={
                  !onExchangeLulToCyon || lulBalance < cyonPackets * Math.max(1, lulCostFor10Cyon)
                }
                onClick={() => {
                  if (!onExchangeLulToCyon) return;
                  soundEngine.playUiClick();
                  const lulCost = cyonPackets * Math.max(1, lulCostFor10Cyon);
                  const cyonOut = cyonPackets * 10;
                  onExchangeLulToCyon(lulCost, cyonOut);
                  setExchangeFeedback({
                    type: 'success',
                    text: `Exchanged ${lulCost} LUL for +${cyonOut} CYON.`,
                  });
                }}
                className="w-full py-2 px-4 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                {lulBalance < cyonPackets * Math.max(1, lulCostFor10Cyon)
                  ? `Need ${cyonPackets * Math.max(1, lulCostFor10Cyon)} LUL (Have ${lulBalance})`
                  : `Exchange ${cyonPackets * Math.max(1, lulCostFor10Cyon)} LUL → +${cyonPackets * 10} CYON`}
              </button>
            </div>
          </div>
        ) : (
          <div data-wallet-history-panel="true" className="space-y-3">
            {/* HISTORY HEADER & FILTER PILLS (canonical order: RESPITE, NEAR, LUL, CYON) */}
            <div className="rounded-2xl bg-white/[0.06] border border-white/12 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-emerald-300">History</div>
                  <div className="text-xs font-medium text-white/80 truncate">
                    {walletId || playerUid || connectedGoogleEmail || 'Guest'}
                  </div>
                </div>
                <button
                  type="button"
                  data-wallet-refresh-history-btn="true"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onRefreshHistory();
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 font-semibold text-[11px] transition-colors cursor-pointer shrink-0"
                >
                  {isLoadingHistory ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-white/10">
                {(['ALL', 'RESPITE', 'NEAR', 'LUL', 'CYON'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    data-wallet-history-filter={filterKey.toLowerCase()}
                    onClick={() => {
                      soundEngine.playUiClick();
                      onChangeHistoryFilter(filterKey);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                      historyFilter === filterKey
                        ? 'bg-white text-slate-950'
                        : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/75 border border-white/12'
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingHistory && filteredHistory.length === 0 ? (
              <div className="p-5 rounded-2xl bg-white/[0.06] border border-white/12 text-center text-xs font-medium text-white/65">
                Loading history...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div
                data-wallet-history-empty="true"
                className="p-6 rounded-2xl bg-white/[0.06] border border-white/12 text-center space-y-1"
              >
                <div className="text-xs font-semibold text-white">No activity yet</div>
                <div className="text-[11px] text-white/55">
                  Exchanges, shop purchases, and transfers will appear here.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((tx) => {
                  const badgeTone =
                    tx.badgeCurrency === 'RESPITE'
                      ? 'bg-violet-500/20 text-violet-200 border-violet-300/30'
                      : tx.badgeCurrency === 'NEAR'
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30'
                        : tx.badgeCurrency === 'LUL'
                          ? 'bg-amber-500/20 text-amber-200 border-amber-300/30'
                          : 'bg-sky-500/20 text-sky-200 border-sky-300/30';
                  const formattedDate = (() => {
                    try {
                      const d = new Date(tx.created_at);
                      return Number.isNaN(d.getTime())
                        ? tx.created_at
                        : d.toLocaleString([], {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                    } catch {
                      return tx.created_at;
                    }
                  })();
                  return (
                    <div
                      key={tx.id}
                      data-wallet-tx-item="true"
                      className="p-3 rounded-2xl bg-white/[0.06] border border-white/12 text-white space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/14 text-white/85 text-[10px] font-semibold">
                              {tx.actionLabel}
                            </span>
                            <span className="text-[10.5px] text-white/50">{formattedDate}</span>
                          </div>
                          <div className="text-xs font-medium text-white/90 break-words">
                            {tx.reasoning_summary || tx.item_id || tx.actionLabel}
                          </div>
                        </div>
                        <div
                          className={`px-2.5 py-1 rounded-full border ${badgeTone} font-mono tabular-nums font-semibold text-[11px] shrink-0`}
                        >
                          {tx.amountText}
                        </div>
                      </div>
                      {tx.near_tx_hash && (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[10.5px] font-mono">
                          <span className="text-white/45 truncate">
                            Receipt: {tx.near_tx_hash}
                          </span>
                          <a
                            href={`https://testnet.nearblocks.io/txns/${tx.near_tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-sans font-semibold text-sky-300 hover:text-sky-200 hover:underline shrink-0"
                          >
                            View Receipt ↗
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* IN-PHONE CONFIRM / REJECT MODAL */}
      <InGameWalletConfirmModal
        pendingTx={reviewedTx}
        nowMs={nowMs}
        onConfirm={(txId) => {
          onConfirmPendingTx(txId);
          setActiveReviewTxId(null);
        }}
        onReject={(txId) => {
          onRejectPendingTx(txId);
          setActiveReviewTxId(null);
        }}
        onClose={() => setActiveReviewTxId(null)}
      />
    </div>
  );
};
