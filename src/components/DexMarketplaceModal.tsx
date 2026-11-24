import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Fish,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  MERCHANT_CATALOG_ITEMS,
  type MerchantAgentMarketState,
  type MerchantCatalogItem,
  evaluateMerchantItemQuote,
} from '../game/buddiesMerchantPricing';
import type {
  CaughtFishItem,
  FishNftMarketplaceListing,
} from '../game/buddiesFishingMarket';
import {
  type DbMarketTransactionRow,
  type FishNftMarketSalesStats,
  fetchMarketTransactionsFromSupabase,
  subscribeToMarketTransactions,
} from '../lib/supabaseClient';
import {
  RESPITE_NEP141_METADATA,
  getLastNearTransactionError,
  getNearBlocksTxUrl,
  isActiveWalletReadOnlyObserver,
  isCitizenSubAccountId,
  type NearRespiteSwapReceipt,
} from '../lib/nearClient';
import {
  Fish3dPreviewModal,
  Fish3dThumbnail,
  type Fish3dPreviewSpec,
} from './Fish3dPreviewModal';
import {
  Furniture3dPreviewModal,
  type Furniture3dPreviewSpec,
} from './Furniture3dPreviewModal';

type DexTopTab = 'chart' | 'marketplace' | 'portfolio';
type DexBottomTab = 'trades' | 'fish_nfts' | 'collector_nfts' | 'portfolio';
type DexPairId = 'nft_market' | 'respite_near';
type DexTimeframeId = '5m' | '15m' | '1H' | '1D' | 'All';

interface CandleDatum {
  index: number;
  label: string;
  timestampMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DexMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletConnected: boolean;
  playerNearAccount: string;
  nearTestnetBalance: number;
  respiteBalance: number;
  marketState: MerchantAgentMarketState;
  ownedItemIds: string[];
  caughtFishBucket: CaughtFishItem[];
  fishMarketListings: FishNftMarketplaceListing[];
  fishSalesStats?: FishNftMarketSalesStats | null;
  onConnectWallet: () => void;
  onSwapNearAndRespite: (
    direction: 'near_to_respite' | 'respite_to_near',
    inputAmount: number,
  ) => Promise<NearRespiteSwapReceipt | null>;
  onBuyMerchantItem: (
    item: MerchantCatalogItem,
    exactPricePaid: number,
  ) => Promise<{ ok: boolean; txHash?: string }>;
  onMintFishAsNft?: (fish: CaughtFishItem) => Promise<boolean>;
  onListFishNftOnMarket?: (
    fish: CaughtFishItem,
    priceRespite: number,
  ) => Promise<boolean>;
  onBuyFishNftFromMarket?: (
    listing: FishNftMarketplaceListing,
  ) => Promise<boolean>;
  onRefreshMarket?: () => void;
}

const NEAR_PER_RESPITE = 1 / RESPITE_NEP141_METADATA.rateRespitePerNear;

const TIMEFRAME_STEP_MS: Record<DexTimeframeId, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1H': 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  All: 72 * 60 * 60 * 1000,
};

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function formatCompactNumber(val: number): string {
  if (!Number.isFinite(val)) return '0';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 10_000) return `${(val / 1_000).toFixed(1)}K`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  if (val >= 100) return val.toFixed(1);
  if (val >= 1) return val.toFixed(2);
  return val.toFixed(4);
}

function formatPriceAxis(val: number, pair: DexPairId): string {
  if (pair === 'respite_near') {
    return val.toFixed(5);
  }
  if (val >= 100) return val.toFixed(1);
  return val.toFixed(2);
}

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function shortenAccount(account: string): string {
  const trimmed = account.trim();
  if (!trimmed) return 'citizen.testnet';
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 8)}..${trimmed.slice(-7)}`;
}

function formatCandleLabel(ms: number, tf: DexTimeframeId): string {
  const d = new Date(ms);
  if (tf === '1D' || tf === 'All') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isCryptoTransactionRow(row: DbMarketTransactionRow): boolean {
  if (row.currency === 'RESPITE' || row.currency === 'NEAR') return true;
  const action = row.action_type.toUpperCase();
  return (
    action === 'BUY_FISH_NFT' ||
    action === 'LIST_FISH_NFT' ||
    action === 'MINT_FISH_NFT'
  );
}

function getTradeDisplayInfo(row: DbMarketTransactionRow): {
  typeLabel: string;
  isPositive: boolean;
  assetLabel: string;
  priceDisplay: string;
  amountDisplay: string;
  totalRespite: number;
} {
  const action = row.action_type.toUpperCase();
  if (action === 'EXCHANGE' && row.currency === 'RESPITE') {
    const respiteAmt = Math.max(0, Number(row.amount || 0));
    const nearPaid =
      row.unit_price > 0
        ? Number(row.unit_price)
        : Number((respiteAmt / RESPITE_NEP141_METADATA.rateRespitePerNear).toFixed(4));
    return {
      typeLabel: 'Swap Buy',
      isPositive: true,
      assetLabel: 'RESPITE / NEAR',
      priceDisplay: `${NEAR_PER_RESPITE.toFixed(4)} NEAR`,
      amountDisplay: `${respiteAmt.toLocaleString()} R`,
      totalRespite: respiteAmt || nearPaid * RESPITE_NEP141_METADATA.rateRespitePerNear,
    };
  }
  if (action === 'BUY_FISH_NFT') {
    const price = Math.max(1, Number(row.unit_price || row.amount || 0));
    return {
      typeLabel: 'Buy NFT',
      isPositive: true,
      assetLabel: row.item_id ? `Fish: ${row.item_id.replace(/_/g, ' ')}` : 'Fish NFT',
      priceDisplay: `${price.toLocaleString()} R`,
      amountDisplay: '1 NFT',
      totalRespite: price,
    };
  }
  if (action === 'LIST_FISH_NFT') {
    const price = Math.max(1, Number(row.unit_price || row.amount || 0));
    return {
      typeLabel: 'List NFT',
      isPositive: false,
      assetLabel: row.item_id ? `Fish: ${row.item_id.replace(/_/g, ' ')}` : 'Fish NFT',
      priceDisplay: `${price.toLocaleString()} R`,
      amountDisplay: '1 NFT',
      totalRespite: price,
    };
  }
  if (action === 'UNLIST_FISH_NFT') {
    const price = Math.max(0, Number(row.unit_price || 0));
    return {
      typeLabel: 'Unlist NFT',
      isPositive: false,
      assetLabel: row.item_id ? `Fish: ${row.item_id.replace(/_/g, ' ')}` : 'Fish NFT',
      priceDisplay: `${price.toLocaleString()} R`,
      amountDisplay: '1 NFT',
      totalRespite: price,
    };
  }
  if (action === 'SELL_ITEM') {
    const refund = Math.max(1, Number(row.unit_price || 0));
    return {
      typeLabel: 'Sell NFT',
      isPositive: false,
      assetLabel: row.item_id ? row.item_id.replace(/_/g, ' ') : 'Collector NFT',
      priceDisplay: `${refund.toLocaleString()} R`,
      amountDisplay: `${Math.max(1, row.amount || 1)}`,
      totalRespite: refund,
    };
  }
  const unitPrice = Math.max(1, Number(row.unit_price || row.amount || 0));
  const qty = Math.max(1, Number(row.amount || 1));
  return {
    typeLabel: 'Buy NFT',
    isPositive: true,
    assetLabel: row.item_id ? row.item_id.replace(/_/g, ' ') : 'On-Chain Asset',
    priceDisplay: `${unitPrice.toLocaleString()} R`,
    amountDisplay: `${qty}`,
    totalRespite: unitPrice,
  };
}

export const DexMarketplaceModal: React.FC<DexMarketplaceModalProps> = ({
  isOpen,
  onClose,
  walletConnected,
  playerNearAccount,
  nearTestnetBalance,
  respiteBalance,
  marketState,
  ownedItemIds,
  caughtFishBucket,
  fishMarketListings,
  fishSalesStats,
  onConnectWallet,
  onSwapNearAndRespite,
  onBuyMerchantItem,
  onMintFishAsNft,
  onListFishNftOnMarket,
  onBuyFishNftFromMarket,
  onRefreshMarket,
}) => {
  const [topTab, setTopTab] = useState<DexTopTab>('chart');
  const [bottomTab, setBottomTab] = useState<DexBottomTab>('trades');
  const [activePair, setActivePair] = useState<DexPairId>('nft_market');
  const [timeframe, setTimeframe] = useState<DexTimeframeId>('1H');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');

  // Swap form state
  const [swapInputStr, setSwapInputStr] = useState<string>('0.03');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapErrorText, setSwapErrorText] = useState<string | null>(null);
  const [lastSwapReceipt, setLastSwapReceipt] =
    useState<NearRespiteSwapReceipt | null>(null);

  // Market transactions live feed
  const [rawTransactions, setRawTransactions] = useState<DbMarketTransactionRow[]>(
    [],
  );
  const [isRefreshingFeed, setIsRefreshingFeed] = useState<boolean>(false);
  const [copiedContract, setCopiedContract] = useState<boolean>(false);

  // Marketplace interaction state
  const [marketSearch, setMarketSearch] = useState<string>('');
  const [rarityFilter, setRarityFilter] = useState<string>('All');
  const [listingPriceByFishId, setListingPriceByFishId] = useState<
    Record<string, string>
  >({});
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [marketFeedback, setMarketFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Chart hover state
  const [hoveredCandleIdx, setHoveredCandleIdx] = useState<number | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);

  // 3D modal previews
  const [preview3dFish, setPreview3dFish] = useState<Fish3dPreviewSpec | null>(
    null,
  );
  const [preview3dFurniture, setPreview3dFurniture] =
    useState<Furniture3dPreviewSpec | null>(null);

  // Load & subscribe to real on-chain/Supabase transactions
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const unsub = subscribeToMarketTransactions((rows) => {
      if (!active) return;
      setRawTransactions(rows);
    });
    void fetchMarketTransactionsFromSupabase(
      playerNearAccount || null,
      40,
    ).then((rows) => {
      if (!active || rows.length === 0) return;
      setRawTransactions((prev) => {
        const seen = new Set(prev.map((r) => r.near_tx_hash || r.id));
        const merged = [...prev];
        for (const r of rows) {
          const key = r.near_tx_hash || r.id;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(r);
          }
        }
        return merged.sort(
          (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
        );
      });
    });
    return () => {
      active = false;
      unsub();
    };
  }, [isOpen, playerNearAccount]);

  const cryptoTrades = useMemo(
    () => rawTransactions.filter(isCryptoTransactionRow),
    [rawTransactions],
  );

  // Strictly RESPITE-only NFT catalog (zero LUL / zero CYON items)
  const collectorNftItems = useMemo(
    () =>
      MERCHANT_CATALOG_ITEMS.filter(
        (item) => item.currency === 'RESPITE' && item.isNft,
      ),
    [],
  );

  const filteredFishListings = useMemo(() => {
    const q = marketSearch.trim().toLowerCase();
    return fishMarketListings.filter((listing) => {
      if (rarityFilter !== 'All' && listing.rarity !== rarityFilter) {
        return false;
      }
      if (!q) return true;
      return (
        listing.speciesName.toLowerCase().includes(q) ||
        listing.rarity.toLowerCase().includes(q) ||
        listing.sellerNearAccount.toLowerCase().includes(q) ||
        listing.waterZoneLabel.toLowerCase().includes(q)
      );
    });
  }, [fishMarketListings, marketSearch, rarityFilter]);

  const filteredCollectorNfts = useMemo(() => {
    const q = marketSearch.trim().toLowerCase();
    return collectorNftItems.filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [collectorNftItems, marketSearch]);

  // Compute real baseline metrics for the selected pair
  const marketMetrics = useMemo(() => {
    const listingPrices = fishMarketListings
      .map((l) => Math.max(1, l.priceRespite || l.priceLul || 0))
      .filter((p) => p > 0);
    const floorRespite =
      listingPrices.length > 0 ? Math.min(...listingPrices) : 14;
    const avgListingRespite =
      listingPrices.length > 0
        ? listingPrices.reduce((s, v) => s + v, 0) / listingPrices.length
        : 24;
    const recentSalePrice = fishSalesStats?.recentSale?.priceRespite ?? null;
    const activeNftPriceRespite = recentSalePrice ?? avgListingRespite;

    const totalRespiteSwapVol = cryptoTrades
      .filter((t) => t.action_type.toUpperCase() === 'EXCHANGE')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalNftTradeVol = cryptoTrades
      .filter((t) => t.action_type.toUpperCase() !== 'EXCHANGE')
      .reduce((sum, t) => sum + Number(t.unit_price || t.amount || 0), 0);

    const listingDepthRespite = listingPrices.reduce((s, v) => s + v, 0);
    const swapBuyCount = cryptoTrades.filter(
      (t) => t.action_type.toUpperCase() === 'EXCHANGE',
    ).length;
    const nftTradeCount = cryptoTrades.length - swapBuyCount;

    return {
      floorRespite,
      activeNftPriceRespite,
      totalRespiteSwapVol,
      totalNftTradeVol,
      listingDepthRespite,
      swapBuyCount,
      nftTradeCount,
    };
  }, [fishMarketListings, fishSalesStats, cryptoTrades]);

  // Construct 44 OHLCV candles blended cleanly with live DB & on-chain trades
  const candles = useMemo<CandleDatum[]>(() => {
    const count = 44;
    const stepMs = TIMEFRAME_STEP_MS[timeframe];
    const now = Date.now();
    const anchor =
      activePair === 'respite_near'
        ? NEAR_PER_RESPITE // 0.0025 NEAR per RESPITE
        : Math.max(8, marketMetrics.activeNftPriceRespite);

    const tfSeedOffset =
      timeframe === '5m'
        ? 11
        : timeframe === '15m'
          ? 27
          : timeframe === '1H'
            ? 43
            : timeframe === '1D'
              ? 67
              : 91;
    const pairSeed = activePair === 'respite_near' ? 103 : 211;
    const volatility = activePair === 'respite_near' ? 0.009 : 0.065;

    const result: CandleDatum[] = [];
    let prevClose =
      anchor * (activePair === 'respite_near' ? 0.985 : 0.84);

    for (let i = 0; i < count; i++) {
      const ts = now - (count - 1 - i) * stepMs;
      const n1 = seededNoise(pairSeed + tfSeedOffset + i * 3.17);
      const n2 = seededNoise(pairSeed + tfSeedOffset + i * 7.41 + 19);
      const n3 = seededNoise(pairSeed + tfSeedOffset + i * 5.29 + 53);

      // Drift gently toward current real market anchor
      const progress = i / (count - 1);
      const driftTowardAnchor =
        (anchor - prevClose) * (0.08 + progress * 0.14);
      const wave =
        Math.sin(i * 0.34 + tfSeedOffset) * anchor * volatility * 0.42;
      const delta =
        (n1 - 0.47) * anchor * volatility + driftTowardAnchor + wave * 0.25;

      const open = prevClose;
      let close = Math.max(
        activePair === 'respite_near' ? 0.0018 : 2,
        open + delta,
      );
      if (i === count - 1) {
        close = anchor;
      }

      const wickUp = n2 * anchor * volatility * 0.65;
      const wickDown = n3 * anchor * volatility * 0.62;
      const high = Math.max(open, close) + wickUp;
      const low = Math.max(
        activePair === 'respite_near' ? 0.0015 : 1,
        Math.min(open, close) - wickDown,
      );

      let volume =
        activePair === 'respite_near'
          ? Math.round(140 + n2 * 620 + (i > count - 4 ? marketMetrics.totalRespiteSwapVol * 0.25 : 0))
          : Math.round(18 + n2 * 85 + (i > count - 4 ? marketMetrics.totalNftTradeVol * 0.3 : 0));

      // Blend real matching transactions from recent buckets into candle close/volume
      for (const tx of cryptoTrades) {
        const txMs = Date.parse(tx.created_at);
        if (!Number.isFinite(txMs)) continue;
        if (Math.abs(ts - txMs) <= stepMs * 0.6) {
          const txVol = Number(tx.unit_price || tx.amount || 0);
          volume += Math.max(10, Math.round(txVol));
          if (activePair === 'nft_market' && tx.action_type.toUpperCase() === 'BUY_FISH_NFT') {
            const p = Number(tx.unit_price || tx.amount || close);
            if (p > 0) {
              close = Number(((close + p) / 2).toFixed(2));
            }
          }
        }
      }

      result.push({
        index: i,
        label: formatCandleLabel(ts, timeframe),
        timestampMs: ts,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        volume,
      });
      prevClose = close;
    }

    return result;
  }, [activePair, timeframe, marketMetrics, cryptoTrades]);

  const chartStats = useMemo(() => {
    const first = candles[0];
    const last = candles[candles.length - 1];
    const highest = candles.reduce((m, c) => (c.high > m ? c.high : m), -Infinity);
    const lowest = candles.reduce((m, c) => (c.low < m ? c.low : m), Infinity);
    const maxVol = candles.reduce((m, c) => (c.volume > m ? c.volume : m), 1);
    const pct24h =
      first && first.open > 0
        ? ((last.close - first.open) / first.open) * 100
        : 0;
    const c5m = candles[Math.max(0, candles.length - 2)];
    const c1h = candles[Math.max(0, candles.length - 7)];
    const pct5m = c5m && c5m.open > 0 ? ((last.close - c5m.open) / c5m.open) * 100 : 0;
    const pct1h = c1h && c1h.open > 0 ? ((last.close - c1h.open) / c1h.open) * 100 : 0;
    return {
      currentPrice: last?.close ?? 0,
      highest,
      lowest,
      maxVol,
      pct24h,
      pct5m,
      pct1h,
    };
  }, [candles]);

  const inspectedCandle =
    hoveredCandleIdx !== null && candles[hoveredCandleIdx]
      ? candles[hoveredCandleIdx]
      : candles[candles.length - 1];

  const isInspectedBull =
    inspectedCandle.close >= inspectedCandle.open;

  if (!isOpen) return null;

  // Swap calculations (NEAR Testnet -> RESPITE NEP-141, 1 NEAR = 400 RESPITE)
  const respiteRatePerNear = RESPITE_NEP141_METADATA.rateRespitePerNear;
  const parsedSwapInput = Math.max(0, Number(swapInputStr) || 0);
  const estimatedRespiteOutput = Math.floor(parsedSwapInput * respiteRatePerNear);
  const isReadOnlyWallet =
    walletConnected &&
    isActiveWalletReadOnlyObserver() &&
    !isCitizenSubAccountId(playerNearAccount);
  const exceedsKnownNearBalance =
    walletConnected &&
    !isReadOnlyWallet &&
    nearTestnetBalance > 0 &&
    parsedSwapInput > nearTestnetBalance;
  const canExecuteSwap =
    walletConnected &&
    tradeSide === 'buy' &&
    !isSwapping &&
    parsedSwapInput >= 0.0025 &&
    estimatedRespiteOutput >= 1 &&
    !exceedsKnownNearBalance;

  const ownListings = fishMarketListings.filter(
    (l) =>
      playerNearAccount &&
      l.sellerNearAccount.toLowerCase() === playerNearAccount.toLowerCase(),
  );
  const mintedBucketFish = caughtFishBucket.filter((f) => f.isMintedNft);
  const ownedNftItems = collectorNftItems.filter((item) =>
    ownedItemIds.includes(item.id),
  );

  // SVG chart coordinate math
  const svgW = 760;
  const svgH = 310;
  const padLeft = 14;
  const padRight = 68;
  const padTop = 18;
  const pricePlotH = 205;
  const volTop = 236;
  const volPlotH = 52;
  const plotW = svgW - padLeft - padRight;

  const rawRange = Math.max(1e-6, chartStats.highest - chartStats.lowest);
  const minPrice = chartStats.lowest - rawRange * 0.09;
  const maxPrice = chartStats.highest + rawRange * 0.09;
  const priceSpan = Math.max(1e-6, maxPrice - minPrice);

  const priceToY = (price: number) =>
    padTop + ((maxPrice - price) / priceSpan) * pricePlotH;

  const stepX = plotW / Math.max(1, candles.length);
  const candleBodyW = Math.max(4, Math.min(11, stepX * 0.62));

  const highCandle = candles.reduce(
    (best, c) => (c.high > best.high ? c : best),
    candles[0],
  );
  const lowCandle = candles.reduce(
    (best, c) => (c.low < best.low ? c : best),
    candles[0],
  );

  const currentPriceY = priceToY(chartStats.currentPrice);
  const isOverallPositive = chartStats.pct24h >= 0;

  // Mini sparkline path for Right Panel "24h Net Trend"
  const sparkW = 280;
  const sparkH = 62;
  const sparkSlice = candles.slice(-24);
  const sparkMin = Math.min(...sparkSlice.map((c) => c.close));
  const sparkMax = Math.max(...sparkSlice.map((c) => c.close));
  const sparkSpan = Math.max(1e-6, sparkMax - sparkMin);
  const sparkPoints = sparkSlice.map((c, idx) => {
    const x = (idx / Math.max(1, sparkSlice.length - 1)) * sparkW;
    const y = 8 + ((sparkMax - c.close) / sparkSpan) * (sparkH - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const sparkLinePath =
    sparkPoints.length > 0 ? `M ${sparkPoints.join(' L ')}` : '';
  const sparkAreaPath =
    sparkPoints.length > 0
      ? `${sparkLinePath} L ${sparkW},${sparkH} L 0,${sparkH} Z`
      : '';

  const totalTxCount = cryptoTrades.length;
  const buyPct =
    totalTxCount > 0
      ? Math.round(
          ((marketMetrics.swapBuyCount +
            cryptoTrades.filter(
              (t) => t.action_type.toUpperCase() === 'BUY_FISH_NFT',
            ).length) /
            totalTxCount) *
            100,
        )
      : 68;

  const handleCopyContract = () => {
    soundEngine.playUiClick();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(RESPITE_NEP141_METADATA.contractId);
      setCopiedContract(true);
      window.setTimeout(() => setCopiedContract(false), 1600);
    }
  };

  const handleTriggerRefresh = () => {
    soundEngine.playUiClick();
    setIsRefreshingFeed(true);
    onRefreshMarket?.();
    void fetchMarketTransactionsFromSupabase(
      playerNearAccount || null,
      40,
    ).then((rows) => {
      if (rows.length > 0) setRawTransactions(rows);
    });
    window.setTimeout(() => setIsRefreshingFeed(false), 600);
  };

  const handleChartPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relX = ((e.clientX - rect.left) / rect.width) * svgW;
    const idx = Math.floor((relX - padLeft) / stepX);
    if (idx >= 0 && idx < candles.length) {
      setHoveredCandleIdx(idx);
    } else {
      setHoveredCandleIdx(null);
    }
  };

  const switchTopTab = (next: DexTopTab) => {
    soundEngine.playUiClick();
    setTopTab(next);
    if (next === 'marketplace') {
      setBottomTab('fish_nfts');
    } else if (next === 'portfolio') {
      setBottomTab('portfolio');
    }
  };

  const renderMarketplaceSection = (isExpanded: boolean) => (
    <div className="space-y-4">
      {/* Sub-filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-dex-subtab="fish_nfts"
            onClick={() => {
              soundEngine.playUiClick();
              setBottomTab('fish_nfts');
            }}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              bottomTab !== 'collector_nfts'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                : 'text-white/65 hover:text-white hover:bg-white/8 border border-transparent'
            }`}
          >
            Fish NFTs ({fishMarketListings.length})
          </button>
          <button
            type="button"
            data-dex-subtab="collector_nfts"
            onClick={() => {
              soundEngine.playUiClick();
              setBottomTab('collector_nfts');
            }}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              bottomTab === 'collector_nfts'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                : 'text-white/65 hover:text-white hover:bg-white/8 border border-transparent'
            }`}
          >
            Collector NFTs ({collectorNftItems.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {bottomTab !== 'collector_nfts' && (
            <div className="flex items-center gap-1">
              {(['All', 'Common', 'Uncommon', 'Rare', 'Mythic'] as const).map(
                (rar) => (
                  <button
                    key={rar}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setRarityFilter(rar);
                    }}
                    className={`px-2 py-1 rounded-md text-[10.5px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      rarityFilter === rar
                        ? 'bg-white/15 text-white'
                        : 'text-white/55 hover:text-white/85'
                    }`}
                  >
                    {rar}
                  </button>
                ),
              )}
            </div>
          )}
          <input
            type="text"
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
            placeholder="Filter species, seller, item..."
            aria-label="Filter NFT marketplace"
            className="h-8 w-44 px-3 rounded-lg bg-white/[0.06] border border-white/14 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-emerald-400/60"
          />
        </div>
      </div>

      {marketFeedback && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
            marketFeedback.ok
              ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
              : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
          }`}
        >
          {marketFeedback.text}
        </div>
      )}

      {bottomTab === 'collector_nfts' ? (
        <div
          className={`grid grid-cols-1 ${
            isExpanded ? 'md:grid-cols-2' : 'md:grid-cols-2'
          } gap-2.5`}
        >
          {filteredCollectorNfts.map((item) => {
            const quote = evaluateMerchantItemQuote(marketState, item);
            const isOwned = ownedItemIds.includes(item.id);
            const canBuy =
              walletConnected &&
              !isOwned &&
              quote.stock > 0 &&
              respiteBalance >= quote.buyPrice &&
              busyActionId === null;
            const has3dModel =
              item.category === 'nft_collector_furniture' ||
              Boolean(item.interiorSlot);

            return (
              <div
                key={item.id}
                data-dex-collector-nft={item.id}
                className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/12 flex flex-col justify-between gap-2.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {item.name}
                    </div>
                    <div className="text-[10.5px] text-white/50 mt-0.5 tabular-nums">
                      NEP-245 · Stock {quote.stock}/{item.targetStock}
                    </div>
                    <p className="text-[11px] text-white/65 mt-1 line-clamp-2 leading-snug">
                      {item.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div className="text-xs font-bold text-emerald-300">
                      {quote.buyPrice} RESPITE
                    </div>
                    <div className="text-[10px] text-white/45">
                      ≈ {(quote.buyPrice * NEAR_PER_RESPITE).toFixed(4)} NEAR
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  {has3dModel ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setPreview3dFurniture({
                          catalogId: item.id,
                          name: item.name,
                          description: item.description,
                          isNft: true,
                          currency: 'RESPITE',
                          priceLabel: `${quote.buyPrice} RESPITE`,
                          stock: quote.stock,
                          isOwned,
                          canBuy,
                          onBuy: () => {
                            if (!canBuy) return;
                            void onBuyMerchantItem(item, quote.buyPrice);
                          },
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-white/80 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3 h-3" aria-hidden="true" />
                      <span>3D View</span>
                    </button>
                  ) : (
                    <span className="text-[10.5px] text-white/45 font-mono truncate">
                      {item.tokenId}
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={async () => {
                      if (!canBuy) return;
                      soundEngine.playPickup();
                      setMarketFeedback(null);
                      setBusyActionId(item.id);
                      try {
                        const res = await onBuyMerchantItem(item, quote.buyPrice);
                        if (res.ok) {
                          setMarketFeedback({
                            ok: true,
                            text: `Acquired ${item.name} for ${quote.buyPrice} RESPITE.`,
                          });
                        } else {
                          setMarketFeedback({
                            ok: false,
                            text:
                              getLastNearTransactionError() ||
                              'NFT purchase failed. Check your RESPITE balance.',
                          });
                        }
                      } finally {
                        setBusyActionId(null);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      isOwned
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 cursor-default'
                        : canBuy
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-white/8 text-white/35 cursor-not-allowed'
                    }`}
                  >
                    {busyActionId === item.id
                      ? 'Minting...'
                      : isOwned
                        ? 'Owned NFT'
                        : `Buy · ${quote.buyPrice} R`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Player Caught Fish Mint/List Quick Strip */}
          {caughtFishBucket.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/12 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-white/90 inline-flex items-center gap-1.5">
                  <Fish className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Your Fish Bucket · Mint &amp; List as NFT ({caughtFishBucket.length})</span>
                </div>
                <span className="text-[10.5px] text-white/50">
                  Settled on-chain in RESPITE
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {caughtFishBucket.slice(0, isExpanded ? 12 : 4).map((fish) => {
                  const suggested = Math.max(
                    1,
                    fish.suggestedRespitePrice ||
                      Math.round((fish.sellValueLul || 25) / 10),
                  );
                  const priceInput =
                    listingPriceByFishId[fish.id] ?? String(suggested);
                  const parsedPrice = Math.max(
                    1,
                    Math.floor(Number(priceInput) || suggested),
                  );
                  return (
                    <div
                      key={fish.id}
                      className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {fish.speciesName}
                          <span className="ml-1.5 text-[10.5px] font-normal text-white/55 tabular-nums">
                            {fish.weightKg.toFixed(2)} kg · {fish.rarity}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/45 truncate">
                          {fish.isMintedNft
                            ? `NFT Ready · ${fish.nftTokenId}`
                            : 'Raw catch · Mint on NEAR before listing'}
                        </div>
                      </div>

                      {!fish.isMintedNft ? (
                        <button
                          type="button"
                          disabled={!walletConnected || busyActionId !== null}
                          onClick={async () => {
                            soundEngine.playUiClick();
                            setMarketFeedback(null);
                            setBusyActionId(fish.id);
                            try {
                              const ok = await onMintFishAsNft?.(fish);
                              setMarketFeedback({
                                ok: Boolean(ok),
                                text: ok
                                  ? `Minted ${fish.speciesName} NFT. Set your RESPITE price to list.`
                                  : getLastNearTransactionError() ||
                                    'Could not mint Fish NFT.',
                              });
                            } finally {
                              setBusyActionId(null);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-violet-500/25 hover:bg-violet-500/40 disabled:opacity-40 text-violet-200 border border-violet-400/35 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                        >
                          {busyActionId === fish.id ? 'Minting...' : 'Mint NFT'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={priceInput}
                            onChange={(e) =>
                              setListingPriceByFishId((prev) => ({
                                ...prev,
                                [fish.id]: e.target.value,
                              }))
                            }
                            aria-label="Listing price in RESPITE"
                            className="w-16 h-7 px-2 rounded-md bg-black/35 border border-white/15 text-xs font-semibold text-white tabular-nums focus:outline-none focus:border-emerald-400"
                          />
                          <button
                            type="button"
                            disabled={!walletConnected || busyActionId !== null}
                            onClick={async () => {
                              soundEngine.playUiClick();
                              setMarketFeedback(null);
                              setBusyActionId(fish.id);
                              try {
                                const ok = await onListFishNftOnMarket?.(
                                  fish,
                                  parsedPrice,
                                );
                                setMarketFeedback({
                                  ok: Boolean(ok),
                                  text: ok
                                    ? `Listed ${fish.speciesName} NFT on DEX for ${parsedPrice} RESPITE.`
                                    : getLastNearTransactionError() ||
                                      'Could not list Fish NFT.',
                                });
                              } finally {
                                setBusyActionId(null);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                          >
                            {busyActionId === fish.id
                              ? 'Listing...'
                              : `List ${parsedPrice} R`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active P2P Fish NFT Listings */}
          {filteredFishListings.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-white/15 text-xs text-white/50">
              No active P2P Fish NFT listings match your filter. Catch &amp; mint fish at East Beach or Oasis Lake to list them here for RESPITE.
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 ${
                isExpanded ? 'md:grid-cols-2' : 'md:grid-cols-2'
              } gap-2.5`}
            >
              {filteredFishListings.map((listing) => {
                const isOwn =
                  Boolean(playerNearAccount) &&
                  listing.sellerNearAccount.toLowerCase() ===
                    playerNearAccount.toLowerCase();
                const priceRespite = Math.max(
                  1,
                  listing.priceRespite || listing.priceLul || 1,
                );
                const canAct =
                  walletConnected &&
                  busyActionId === null &&
                  (isOwn || respiteBalance >= priceRespite);

                const openFish3d = () => {
                  setPreview3dFish({
                    speciesId: listing.speciesId,
                    speciesName: listing.speciesName,
                    rarity: listing.rarity,
                    weightKg: listing.weightKg,
                    lengthCm: listing.lengthCm,
                    waterZoneLabel: listing.waterZoneLabel,
                    colorHex: listing.colorHex,
                    isTrophy: listing.isTrophy,
                    isMintedNft: true,
                    nftTokenId: listing.nftTokenId,
                    valueLabel: `${priceRespite.toLocaleString()} RESPITE`,
                    ownerOrSellerLabel: `Seller: ${listing.sellerNearAccount}`,
                  });
                };

                return (
                  <div
                    key={listing.listingId}
                    data-dex-fish-listing={listing.listingId}
                    className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/12 flex items-center justify-between gap-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Fish3dThumbnail
                        speciesId={listing.speciesId}
                        speciesName={listing.speciesName}
                        colorHex={listing.colorHex}
                        variant="compact"
                        onInspect={openFish3d}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {listing.speciesName}
                          {listing.isTrophy && (
                            <span className="ml-1.5 text-[10px] font-semibold text-amber-300">
                              Trophy
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-white/55 tabular-nums truncate">
                          {listing.rarity} · {listing.weightKg.toFixed(2)} kg
                          {listing.lengthCm ? ` · ${listing.lengthCm} cm` : ''}
                        </div>
                        <div className="text-[10px] text-white/40 truncate">
                          Seller: {shortenAccount(listing.sellerNearAccount)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="text-xs font-bold text-emerald-300 tabular-nums">
                        {priceRespite.toLocaleString()} RESPITE
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            openFish3d();
                          }}
                          className="px-2 py-1 rounded-md bg-white/8 hover:bg-white/15 text-white/75 text-[10.5px] font-medium cursor-pointer transition-colors"
                        >
                          3D
                        </button>
                        <button
                          type="button"
                          disabled={!canAct}
                          onClick={async () => {
                            if (!canAct) return;
                            soundEngine.playUiClick();
                            setMarketFeedback(null);
                            setBusyActionId(listing.listingId);
                            try {
                              const ok = await onBuyFishNftFromMarket?.({
                                ...listing,
                                priceRespite,
                                priceLul: priceRespite,
                              });
                              setMarketFeedback({
                                ok: Boolean(ok),
                                text: ok
                                  ? isOwn
                                    ? `Removed ${listing.speciesName} NFT listing.`
                                    : `Purchased ${listing.speciesName} NFT for ${priceRespite} RESPITE.`
                                  : getLastNearTransactionError() ||
                                    'Order failed. Check your RESPITE balance.',
                              });
                            } finally {
                              setBusyActionId(null);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
                            isOwn
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                              : canAct
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                                : 'bg-white/8 text-white/35 cursor-not-allowed'
                          }`}
                        >
                          {busyActionId === listing.listingId
                            ? '...'
                            : isOwn
                              ? 'Unlist'
                              : 'Buy NFT'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderPortfolioSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12">
          <div className="text-[10.5px] text-white/50">NEAR Balance</div>
          <div className="text-base font-bold text-white mt-0.5 tabular-nums">
            {nearTestnetBalance.toFixed(4)} NEAR
          </div>
          <div className="text-[10px] text-white/45 mt-0.5 tabular-nums">
            ≈ {Math.floor(nearTestnetBalance * respiteRatePerNear).toLocaleString()} R power
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12">
          <div className="text-[10.5px] text-white/50">RESPITE Balance</div>
          <div className="text-base font-bold text-emerald-300 mt-0.5 tabular-nums">
            {respiteBalance.toLocaleString()} R
          </div>
          <div className="text-[10px] text-white/45 mt-0.5 tabular-nums">
            ≈ {(respiteBalance * NEAR_PER_RESPITE).toFixed(4)} NEAR
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12">
          <div className="text-[10.5px] text-white/50">Owned NFTs</div>
          <div className="text-base font-bold text-white mt-0.5 tabular-nums">
            {ownedNftItems.length + mintedBucketFish.length}
          </div>
          <div className="text-[10px] text-white/45 mt-0.5">
            {mintedBucketFish.length} Fish · {ownedNftItems.length} Collector
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12">
          <div className="text-[10.5px] text-white/50">Active Listings</div>
          <div className="text-base font-bold text-white mt-0.5 tabular-nums">
            {ownListings.length}
          </div>
          <div className="text-[10px] text-white/45 mt-0.5 tabular-nums">
            {ownListings
              .reduce((s, l) => s + Math.max(1, l.priceRespite || 0), 0)
              .toLocaleString()}{' '}
            R listed value
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/12 overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-semibold text-white/85">
          <span>Your On-Chain Assets</span>
          <span className="text-[10.5px] font-mono text-white/45">
            {walletConnected ? shortenAccount(playerNearAccount) : 'Not connected'}
          </span>
        </div>
        {ownedNftItems.length === 0 &&
        mintedBucketFish.length === 0 &&
        ownListings.length === 0 ? (
          <div className="py-8 text-center text-xs text-white/45">
            {walletConnected
              ? 'No NFTs in your DEX portfolio yet. Swap NEAR to RESPITE or mint & trade NFTs in the Marketplace.'
              : 'Connect your NEAR wallet to inspect balances, active listings, and owned NFTs.'}
          </div>
        ) : (
          <div className="divide-y divide-white/8">
            {ownListings.map((l) => (
              <div
                key={l.listingId}
                className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-white">{l.speciesName} NFT</span>
                  <span className="ml-2 text-[10.5px] text-amber-300">
                    Listed · {l.weightKg.toFixed(2)} kg
                  </span>
                </div>
                <span className="font-semibold text-emerald-300 tabular-nums shrink-0">
                  {l.priceRespite} RESPITE
                </span>
              </div>
            ))}
            {mintedBucketFish.map((f) => (
              <div
                key={f.id}
                className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-white">{f.speciesName} NFT</span>
                  <span className="ml-2 text-[10.5px] text-white/50">
                    In Bucket · {f.weightKg.toFixed(2)} kg
                  </span>
                </div>
                <span className="text-[10.5px] font-mono text-white/45 shrink-0">
                  {f.nftTokenId}
                </span>
              </div>
            ))}
            {ownedNftItems.map((item) => (
              <div
                key={item.id}
                className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="ml-2 text-[10.5px] text-white/50">
                    Collector NFT
                  </span>
                </div>
                <span className="text-[10.5px] font-mono text-emerald-300/80 shrink-0">
                  {item.tokenId}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTradesTable = () => {
    const maxTotal = Math.max(
      1,
      ...cryptoTrades.map((t) => getTradeDisplayInfo(t).totalRespite),
    );

    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-white/10 text-[11px] font-medium text-white/45">
              <th className="py-2 pr-3 font-medium">Age / Time</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">Pair / Asset</th>
              <th className="py-2 px-3 font-medium">Price</th>
              <th className="py-2 px-3 font-medium">Amount</th>
              <th className="py-2 px-3 font-medium">Total (R)</th>
              <th className="py-2 pl-3 text-right font-medium">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {cryptoTrades.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-xs text-white/45"
                >
                  No on-chain RESPITE / NEAR swaps or NFT trades recorded in this session yet. Execute a swap on the right panel to record live telemetry.
                </td>
              </tr>
            ) : (
              cryptoTrades.slice(0, 24).map((row) => {
                const info = getTradeDisplayInfo(row);
                const depthPct = Math.min(
                  100,
                  Math.max(8, Math.round((info.totalRespite / maxTotal) * 100)),
                );
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="py-2 pr-3 text-white/55 whitespace-nowrap">
                      {formatRelativeTime(row.created_at)}
                    </td>
                    <td
                      className={`py-2 px-3 font-semibold whitespace-nowrap ${
                        info.isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {info.typeLabel}
                    </td>
                    <td className="py-2 px-3 text-white/85 whitespace-nowrap">
                      {info.assetLabel}
                    </td>
                    <td className="py-2 px-3 text-white/80 whitespace-nowrap">
                      {info.priceDisplay}
                    </td>
                    <td className="py-2 px-3 text-white whitespace-nowrap">
                      {info.amountDisplay}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="relative inline-flex items-center px-2 py-0.5 rounded min-w-[82px] overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 ${
                            info.isPositive
                              ? 'bg-emerald-500/20'
                              : 'bg-rose-500/20'
                          }`}
                          style={{ width: `${depthPct}%` }}
                        />
                        <span
                          className={`relative z-10 font-semibold ${
                            info.isPositive
                              ? 'text-emerald-300'
                              : 'text-rose-300'
                          }`}
                        >
                          {info.totalRespite.toLocaleString()} R
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pl-3 text-right whitespace-nowrap font-mono text-[11px] text-white/60">
                      {row.near_tx_hash ? (
                        <a
                          href={getNearBlocksTxUrl(row.near_tx_hash, 'testnet')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors"
                          title={`View Tx ${row.near_tx_hash}`}
                        >
                          <span>{shortenAccount(row.actor_near_account)}</span>
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      ) : (
                        <span>{shortenAccount(row.actor_near_account)}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="DEX & Marketplace Terminal"
        data-dex-marketplace-modal="true"
        className="fixed inset-0 z-[115] flex items-center justify-center p-2 sm:p-4 bg-black/35 pointer-events-auto select-none"
        onClick={() => {
          soundEngine.playUiClick();
          onClose();
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[1160px] h-[min(760px,92vh)] rounded-[24px] bg-gradient-to-b from-[#171d2c]/88 via-[#111622]/86 to-[#0c101a]/90 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.62)] text-white flex flex-col overflow-hidden"
        >
          {/* =================================================================
              1. TOP HEADER BAR
             ================================================================= */}
          <header className="shrink-0 h-13 px-4 border-b border-white/12 flex items-center justify-between gap-3">
            <div className="flex items-center gap-5 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <TrendingUp
                    className="w-4 h-4 text-emerald-400"
                    aria-hidden="true"
                  />
                </div>
                <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                  DEX &amp; MARKETPLACE
                </span>
              </div>

              <nav
                aria-label="DEX navigation"
                className="flex items-center gap-1"
              >
                {(
                  [
                    { id: 'chart', label: 'Chart' },
                    { id: 'marketplace', label: 'Marketplace' },
                    { id: 'portfolio', label: 'Portfolio' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-dex-top-tab={item.id}
                    onClick={() => switchTopTab(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      topTab === item.id
                        ? 'bg-white/12 text-white'
                        : 'text-white/55 hover:text-white hover:bg-white/6'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTriggerRefresh}
                aria-label="Refresh market feed"
                className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-white/75 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Refresh market data"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshingFeed ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/12 text-xs font-semibold tabular-nums whitespace-nowrap">
                <span className="text-sky-300">
                  {nearTestnetBalance.toFixed(2)} NEAR
                </span>
                <span className="text-white/25">·</span>
                <span className="text-emerald-300">
                  {respiteBalance.toLocaleString()} RESPITE
                </span>
              </div>

              <button
                type="button"
                data-dex-wallet-btn="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  onConnectWallet();
                }}
                className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  walletConnected
                    ? 'bg-white/10 hover:bg-white/18 text-white border border-white/15'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {walletConnected
                    ? shortenAccount(playerNearAccount)
                    : 'Connect Wallet'}
                </span>
              </button>

              <button
                type="button"
                data-dex-close-btn="true"
                aria-label="Close DEX & Marketplace"
                onClick={() => {
                  soundEngine.playUiClick();
                  onClose();
                }}
                className="w-8 h-8 rounded-lg bg-white/[0.08] hover:bg-rose-500/30 border border-white/15 text-white/80 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* =================================================================
              2. PAIR & LIVE TELEMETRY STRIP
             ================================================================= */}
          <div className="shrink-0 px-4 py-2.5 border-b border-white/10 bg-black/20 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Pair Selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/12">
                <button
                  type="button"
                  data-dex-pair="nft_market"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setActivePair('nft_market');
                    setHoveredCandleIdx(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activePair === 'nft_market'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  NFT INDEX / RESPITE
                </button>
                <button
                  type="button"
                  data-dex-pair="respite_near"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setActivePair('respite_near');
                    setHoveredCandleIdx(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activePair === 'respite_near'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  RESPITE / NEAR
                </button>
              </div>

              {/* Key Metrics */}
              <div className="flex items-center gap-5 flex-wrap tabular-nums">
                <div>
                  <div className="text-[10px] text-white/45">
                    {activePair === 'respite_near' ? 'Spot Price' : 'Avg NFT Price'}
                  </div>
                  <div className="text-xs font-bold text-white">
                    {activePair === 'respite_near'
                      ? `${NEAR_PER_RESPITE.toFixed(4)} NEAR`
                      : `${chartStats.currentPrice.toFixed(1)} RESPITE`}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-white/45">24h Change</div>
                  <div
                    className={`text-xs font-bold ${
                      isOverallPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isOverallPositive ? '+' : ''}
                    {chartStats.pct24h.toFixed(2)}%
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-white/45">
                    {activePair === 'respite_near' ? 'Swap Rate' : 'Floor Price'}
                  </div>
                  <div className="text-xs font-semibold text-white/90">
                    {activePair === 'respite_near'
                      ? `1 NEAR = ${respiteRatePerNear} R`
                      : `${marketMetrics.floorRespite.toLocaleString()} R`}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-white/45">Active Listings</div>
                  <div className="text-xs font-semibold text-white/90">
                    {fishMarketListings.length} Fish · {collectorNftItems.length} NFTs
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-white/45">Contract</div>
                  <div className="flex items-center gap-1 text-xs font-mono text-white/80">
                    <a
                      href={`https://testnet.nearblocks.io/address/${RESPITE_NEP141_METADATA.contractId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-emerald-300 transition-colors"
                    >
                      {RESPITE_NEP141_METADATA.contractId}
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyContract}
                      aria-label="Copy contract ID"
                      className="p-0.5 text-white/45 hover:text-white cursor-pointer"
                    >
                      {copiedContract ? (
                        <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3 h-3" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>NEAR Testnet · On-Chain Crypto &amp; NFT Only</span>
            </div>
          </div>

          {/* =================================================================
              3. MAIN TERMINAL SPLIT (LEFT: CHART + TABLES | RIGHT: SWAP PANEL)
             ================================================================= */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px]">
            {/* LEFT WORKSPACE */}
            <div className="min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto">
              {topTab === 'chart' && (
                <>
                  {/* Candlestick Chart Section */}
                  <section className="shrink-0 p-3.5 border-b border-white/10 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] tabular-nums">
                        <span className="font-semibold text-white">
                          {activePair === 'respite_near'
                            ? 'RESPITE/NEAR · NEAR Testnet NEP-141'
                            : 'FISH & COLLECTOR NFT INDEX · RESPITE'}
                        </span>
                        <span className="text-white/35">·</span>
                        <span className="text-white/55">
                          O{' '}
                          <span
                            className={
                              isInspectedBull
                                ? 'text-emerald-400 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {formatPriceAxis(inspectedCandle.open, activePair)}
                          </span>
                        </span>
                        <span className="text-white/55">
                          H{' '}
                          <span
                            className={
                              isInspectedBull
                                ? 'text-emerald-400 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {formatPriceAxis(inspectedCandle.high, activePair)}
                          </span>
                        </span>
                        <span className="text-white/55">
                          L{' '}
                          <span
                            className={
                              isInspectedBull
                                ? 'text-emerald-400 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {formatPriceAxis(inspectedCandle.low, activePair)}
                          </span>
                        </span>
                        <span className="text-white/55">
                          C{' '}
                          <span
                            className={
                              isInspectedBull
                                ? 'text-emerald-400 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {formatPriceAxis(inspectedCandle.close, activePair)}
                          </span>
                        </span>
                        <span className="text-white/55">
                          Vol{' '}
                          <span className="text-white/85 font-semibold">
                            {formatCompactNumber(inspectedCandle.volume)}
                          </span>
                        </span>
                      </div>

                      {/* Timeframe Switcher */}
                      <div className="flex items-center gap-1">
                        {(['5m', '15m', '1H', '1D', 'All'] as const).map((tf) => (
                          <button
                            key={tf}
                            type="button"
                            data-dex-tf={tf}
                            onClick={() => {
                              soundEngine.playUiClick();
                              setTimeframe(tf);
                              setHoveredCandleIdx(null);
                            }}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              timeframe === tf
                                ? 'bg-white/14 text-white'
                                : 'text-white/50 hover:text-white hover:bg-white/6'
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Candlestick + Volume Histogram SVG */}
                    <div className="relative rounded-xl bg-[#0a0e17]/75 border border-white/10 overflow-hidden">
                      <svg
                        ref={chartSvgRef}
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        onMouseMove={handleChartPointerMove}
                        onMouseLeave={() => setHoveredCandleIdx(null)}
                        className="w-full h-[250px] sm:h-[285px] block select-none cursor-crosshair"
                      >
                        {/* Horizontal Price Gridlines & Right Y-Axis Labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                          const y = padTop + frac * pricePlotH;
                          const val = maxPrice - frac * priceSpan;
                          return (
                            <g key={frac}>
                              <line
                                x1={padLeft}
                                y1={y}
                                x2={svgW - padRight}
                                y2={y}
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="1"
                              />
                              <text
                                x={svgW - padRight + 8}
                                y={y + 3.5}
                                fill="rgba(255,255,255,0.45)"
                                fontSize="10"
                                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                              >
                                {formatPriceAxis(val, activePair)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Vertical Time Gridlines & Bottom X-Axis Labels */}
                        {candles
                          .filter((_, idx) => idx % 8 === 0 || idx === candles.length - 1)
                          .map((c) => {
                            const cx = padLeft + (c.index + 0.5) * stepX;
                            return (
                              <g key={c.index}>
                                <line
                                  x1={cx}
                                  y1={padTop}
                                  x2={cx}
                                  y2={volTop + volPlotH}
                                  stroke="rgba(255,255,255,0.04)"
                                  strokeWidth="1"
                                />
                                <text
                                  x={cx}
                                  y={svgH - 6}
                                  textAnchor="middle"
                                  fill="rgba(255,255,255,0.42)"
                                  fontSize="9.5"
                                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                >
                                  {c.label}
                                </text>
                              </g>
                            );
                          })}

                        {/* Volume Separator Line */}
                        <line
                          x1={padLeft}
                          y1={volTop - 6}
                          x2={svgW - padRight}
                          y2={volTop - 6}
                          stroke="rgba(255,255,255,0.07)"
                          strokeWidth="1"
                        />

                        {/* Candles + Volume Bars */}
                        {candles.map((c) => {
                          const cx = padLeft + (c.index + 0.5) * stepX;
                          const isBull = c.close >= c.open;
                          const color = isBull ? '#10b981' : '#f43f5e';
                          const volColor = isBull
                            ? 'rgba(16,185,129,0.34)'
                            : 'rgba(244,63,94,0.34)';

                          const yHigh = priceToY(c.high);
                          const yLow = priceToY(c.low);
                          const yOpen = priceToY(c.open);
                          const yClose = priceToY(c.close);
                          const bodyTop = Math.min(yOpen, yClose);
                          const bodyH = Math.max(2, Math.abs(yClose - yOpen));

                          const volBarH = Math.max(
                            3,
                            (c.volume / Math.max(1, chartStats.maxVol)) * volPlotH,
                          );
                          const isHovered = hoveredCandleIdx === c.index;

                          return (
                            <g key={c.index}>
                              {isHovered && (
                                <rect
                                  x={cx - stepX / 2}
                                  y={padTop}
                                  width={stepX}
                                  height={volTop + volPlotH - padTop}
                                  fill="rgba(255,255,255,0.04)"
                                />
                              )}
                              <line
                                x1={cx}
                                y1={yHigh}
                                x2={cx}
                                y2={yLow}
                                stroke={color}
                                strokeWidth="1.4"
                              />
                              <rect
                                x={cx - candleBodyW / 2}
                                y={bodyTop}
                                width={candleBodyW}
                                height={bodyH}
                                rx="1"
                                fill={color}
                              />
                              <rect
                                x={cx - candleBodyW / 2}
                                y={volTop + volPlotH - volBarH}
                                width={candleBodyW}
                                height={volBarH}
                                rx="1"
                                fill={volColor}
                              />
                            </g>
                          );
                        })}

                        {/* Peak High Callout Tag */}
                        {highCandle && (
                          <g>
                            <rect
                              x={Math.min(
                                svgW - padRight - 84,
                                Math.max(
                                  padLeft,
                                  padLeft + (highCandle.index + 0.5) * stepX - 38,
                                ),
                              )}
                              y={Math.max(4, priceToY(highCandle.high) - 18)}
                              width="78"
                              height="15"
                              rx="3"
                              fill="rgba(30,41,59,0.9)"
                              stroke="rgba(148,163,184,0.35)"
                            />
                            <text
                              x={
                                Math.min(
                                  svgW - padRight - 84,
                                  Math.max(
                                    padLeft,
                                    padLeft + (highCandle.index + 0.5) * stepX - 38,
                                  ),
                                ) + 39
                              }
                              y={Math.max(4, priceToY(highCandle.high) - 18) + 10.5}
                              textAnchor="middle"
                              fill="#cbd5e1"
                              fontSize="9"
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                            >
                              H {formatPriceAxis(highCandle.high, activePair)}
                            </text>
                          </g>
                        )}

                        {/* Trough Low Callout Tag */}
                        {lowCandle && (
                          <g>
                            <rect
                              x={Math.min(
                                svgW - padRight - 84,
                                Math.max(
                                  padLeft,
                                  padLeft + (lowCandle.index + 0.5) * stepX - 38,
                                ),
                              )}
                              y={Math.min(
                                volTop - 22,
                                priceToY(lowCandle.low) + 4,
                              )}
                              width="78"
                              height="15"
                              rx="3"
                              fill="rgba(30,41,59,0.9)"
                              stroke="rgba(148,163,184,0.35)"
                            />
                            <text
                              x={
                                Math.min(
                                  svgW - padRight - 84,
                                  Math.max(
                                    padLeft,
                                    padLeft + (lowCandle.index + 0.5) * stepX - 38,
                                  ),
                                ) + 39
                              }
                              y={
                                Math.min(
                                  volTop - 22,
                                  priceToY(lowCandle.low) + 4,
                                ) + 10.5
                              }
                              textAnchor="middle"
                              fill="#cbd5e1"
                              fontSize="9"
                              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                            >
                              L {formatPriceAxis(lowCandle.low, activePair)}
                            </text>
                          </g>
                        )}

                        {/* Active Current Price Horizontal Dashed Line & Y-Axis Tag */}
                        <line
                          x1={padLeft}
                          y1={currentPriceY}
                          x2={svgW - padRight}
                          y2={currentPriceY}
                          stroke={isOverallPositive ? '#10b981' : '#f43f5e'}
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <rect
                          x={svgW - padRight + 2}
                          y={currentPriceY - 9}
                          width={padRight - 6}
                          height="18"
                          rx="4"
                          fill={isOverallPositive ? '#10b981' : '#f43f5e'}
                        />
                        <text
                          x={svgW - padRight + (padRight - 2) / 2}
                          y={currentPriceY + 3.5}
                          textAnchor="middle"
                          fill="#052e16"
                          fontSize="9.5"
                          fontWeight="700"
                          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        >
                          {formatPriceAxis(chartStats.currentPrice, activePair)}
                        </text>

                        {/* Hover Crosshair */}
                        {hoveredCandleIdx !== null && candles[hoveredCandleIdx] && (
                          <g pointerEvents="none">
                            <line
                              x1={
                                padLeft +
                                (candles[hoveredCandleIdx].index + 0.5) * stepX
                              }
                              y1={padTop}
                              x2={
                                padLeft +
                                (candles[hoveredCandleIdx].index + 0.5) * stepX
                              }
                              y2={volTop + volPlotH}
                              stroke="rgba(255,255,255,0.28)"
                              strokeDasharray="2 2"
                            />
                          </g>
                        )}
                      </svg>
                    </div>
                  </section>

                  {/* Lower Tabbed Ledger (Trades | Fish NFTs | Collector NFTs | Portfolio) */}
                  <section className="flex-1 min-h-0 flex flex-col">
                    <div className="shrink-0 px-4 border-b border-white/10 flex items-center gap-1 overflow-x-auto">
                      {(
                        [
                          {
                            id: 'trades',
                            label: `Trades (${cryptoTrades.length})`,
                          },
                          {
                            id: 'fish_nfts',
                            label: `Fish NFT Market (${fishMarketListings.length})`,
                          },
                          {
                            id: 'collector_nfts',
                            label: `Collector NFTs (${collectorNftItems.length})`,
                          },
                          {
                            id: 'portfolio',
                            label: 'Portfolio',
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          data-dex-bottom-tab={tab.id}
                          onClick={() => {
                            soundEngine.playUiClick();
                            setBottomTab(tab.id);
                          }}
                          className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            bottomTab === tab.id
                              ? 'border-emerald-400 text-white'
                              : 'border-transparent text-white/50 hover:text-white/85'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto">
                      {bottomTab === 'trades' && renderTradesTable()}
                      {(bottomTab === 'fish_nfts' ||
                        bottomTab === 'collector_nfts') &&
                        renderMarketplaceSection(false)}
                      {bottomTab === 'portfolio' && renderPortfolioSection()}
                    </div>
                  </section>
                </>
              )}

              {topTab === 'marketplace' && (
                <div className="flex-1 p-4 overflow-y-auto">
                  {renderMarketplaceSection(true)}
                </div>
              )}

              {topTab === 'portfolio' && (
                <div className="flex-1 p-4 overflow-y-auto">
                  {renderPortfolioSection()}
                </div>
              )}
            </div>

            {/* RIGHT EXECUTION & METRICS PANEL */}
            <aside className="min-h-0 overflow-y-auto p-3.5 space-y-3.5 bg-black/15">
              {/* 5m / 1h / 24h Change Row */}
              <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl bg-white/[0.04] border border-white/12 py-2 text-center tabular-nums">
                <div>
                  <div className="text-[10px] text-white/45">5m</div>
                  <div
                    className={`text-xs font-bold mt-0.5 ${
                      chartStats.pct5m >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {chartStats.pct5m >= 0 ? '+' : ''}
                    {chartStats.pct5m.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-white/45">1h</div>
                  <div
                    className={`text-xs font-bold mt-0.5 ${
                      chartStats.pct1h >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {chartStats.pct1h >= 0 ? '+' : ''}
                    {chartStats.pct1h.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-white/45">24h</div>
                  <div
                    className={`text-xs font-bold mt-0.5 ${
                      chartStats.pct24h >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {chartStats.pct24h >= 0 ? '+' : ''}
                    {chartStats.pct24h.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Volume Ratio + 24h Net Buy Trend Sparkline */}
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12 space-y-2.5 tabular-nums">
                <div className="flex items-center justify-between text-[11px]">
                  <div>
                    <div className="text-white/45">24h Crypto Vol</div>
                    <div className="font-bold text-white mt-0.5">
                      {(
                        marketMetrics.totalRespiteSwapVol +
                        marketMetrics.totalNftTradeVol
                      ).toLocaleString()}{' '}
                      RESPITE
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/45">Buy Pressure</div>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      {buyPct}% Buy
                    </div>
                  </div>
                </div>

                <div className="h-1.5 w-full rounded-full bg-rose-500/35 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${buyPct}%` }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-white/45 mb-1">
                    <span>24h Market Trend</span>
                    <span className="font-mono">
                      {activePair === 'respite_near' ? 'RESPITE/NEAR' : 'NFT IDX'}
                    </span>
                  </div>
                  <svg
                    viewBox={`0 0 ${sparkW} ${sparkH}`}
                    className="w-full h-14 overflow-visible"
                  >
                    <defs>
                      <linearGradient id="dexSparkFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={isOverallPositive ? '#10b981' : '#f43f5e'}
                          stopOpacity="0.28"
                        />
                        <stop
                          offset="100%"
                          stopColor={isOverallPositive ? '#10b981' : '#f43f5e'}
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    {sparkAreaPath && (
                      <path d={sparkAreaPath} fill="url(#dexSparkFill)" />
                    )}
                    {sparkLinePath && (
                      <path
                        d={sparkLinePath}
                        fill="none"
                        stroke={isOverallPositive ? '#10b981' : '#f43f5e'}
                        strokeWidth="1.75"
                      />
                    )}
                  </svg>
                </div>
              </div>

              {/* Buy / Sell Terminal Form (NEAR <-> RESPITE) */}
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/14 space-y-3">
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/30 border border-white/10">
                  <button
                    type="button"
                    data-dex-trade-side="buy"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setTradeSide('buy');
                      setSwapErrorText(null);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      tradeSide === 'buy'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Buy RESPITE
                  </button>
                  <button
                    type="button"
                    data-dex-trade-side="sell"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setTradeSide('sell');
                      setSwapErrorText(null);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      tradeSide === 'sell'
                        ? 'bg-rose-500/25 text-rose-200 border border-rose-400/35'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                {tradeSide === 'buy' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-white/55 tabular-nums">
                      <span>Pay (NEAR Testnet)</span>
                      <span>
                        Avail: {nearTestnetBalance.toFixed(4)} NEAR
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={0.0025}
                        step={0.01}
                        data-dex-swap-input="true"
                        value={swapInputStr}
                        onChange={(e) => {
                          setSwapInputStr(e.target.value);
                          setSwapErrorText(null);
                          setLastSwapReceipt(null);
                        }}
                        aria-label="NEAR deposit amount"
                        className="w-full h-10 pl-3 pr-16 rounded-xl bg-black/35 border border-white/15 focus:border-emerald-400/70 text-sm font-bold text-white tabular-nums focus:outline-none"
                      />
                      <span className="absolute right-3 text-xs font-bold text-sky-300 pointer-events-none">
                        NEAR
                      </span>
                    </div>

                    {/* Quick Amount Presets */}
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          { label: '0.01', val: '0.01' },
                          { label: '0.03', val: '0.03' },
                          { label: '0.25', val: '0.25' },
                          { label: '0.5', val: '0.5' },
                          {
                            label: 'MAX',
                            val: String(
                              Math.max(
                                0,
                                Number(
                                  Math.max(0, nearTestnetBalance - 0.01).toFixed(4),
                                ),
                              ),
                            ),
                          },
                        ] as const
                      ).map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setSwapInputStr(preset.val);
                            setSwapErrorText(null);
                            setLastSwapReceipt(null);
                          }}
                          className="py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-[10.5px] font-semibold text-white/80 tabular-nums cursor-pointer transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Receive Readout */}
                    <div className="px-3 py-2.5 rounded-xl bg-black/25 border border-white/10 flex items-center justify-between text-xs tabular-nums">
                      <span className="text-white/55">Receive</span>
                      <span
                        data-dex-swap-output="true"
                        className="font-bold text-emerald-300"
                      >
                        +{estimatedRespiteOutput.toLocaleString()} RESPITE
                      </span>
                    </div>

                    {!walletConnected && (
                      <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                        <span>Connect NEAR wallet to swap.</span>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onConnectWallet();
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-semibold cursor-pointer shrink-0"
                        >
                          Sign in
                        </button>
                      </div>
                    )}

                    {isReadOnlyWallet && (
                      <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-[11px] text-amber-200">
                        View-only mode ({shortenAccount(playerNearAccount)}). Switch to an owned wallet to sign transactions.
                      </div>
                    )}

                    {exceedsKnownNearBalance && (
                      <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] text-rose-200">
                        Insufficient NEAR ({nearTestnetBalance.toFixed(4)} NEAR available).
                      </div>
                    )}

                    {swapErrorText && (
                      <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] text-rose-200">
                        {swapErrorText}
                      </div>
                    )}

                    <button
                      type="button"
                      data-dex-swap-submit-btn="true"
                      disabled={!canExecuteSwap}
                      onClick={async () => {
                        if (!canExecuteSwap) return;
                        soundEngine.playUiClick();
                        setSwapErrorText(null);
                        setLastSwapReceipt(null);
                        setIsSwapping(true);
                        try {
                          const receipt = await onSwapNearAndRespite(
                            'near_to_respite',
                            parsedSwapInput,
                          );
                          if (receipt) {
                            soundEngine.playPickup();
                            setLastSwapReceipt(receipt);
                          } else {
                            soundEngine.playHit();
                            setSwapErrorText(
                              getLastNearTransactionError() ||
                                'Swap failed or was cancelled.',
                            );
                          }
                        } finally {
                          setIsSwapping(false);
                        }
                      }}
                      className={`w-full h-10 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all ${
                        canExecuteSwap
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer active:scale-[0.99]'
                          : 'bg-white/10 text-white/35 cursor-not-allowed'
                      }`}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {isSwapping
                          ? 'Confirming on NEAR...'
                          : `Buy ${estimatedRespiteOutput.toLocaleString()} RESPITE`}
                      </span>
                    </button>

                    {lastSwapReceipt && (
                      <div
                        data-dex-swap-receipt="true"
                        className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-[11px] text-emerald-200 space-y-1"
                      >
                        <div className="font-semibold">
                          Swapped {lastSwapReceipt.nearAmount} NEAR &rarr; +
                          {lastSwapReceipt.respiteAmount.toLocaleString()} RESPITE
                        </div>
                        {lastSwapReceipt.txHash && (
                          <a
                            href={getNearBlocksTxUrl(
                              lastSwapReceipt.txHash,
                              'testnet',
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline font-mono"
                          >
                            <span>View Tx on NearBlocks</span>
                            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-black/25 border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-rose-300">
                      <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>One-Way Smart Contract Firewall</span>
                    </div>
                    <p className="text-[11px] text-white/65 leading-relaxed">
                      <span className="font-mono text-white/85">
                        swap_near_for_respite
                      </span>{' '}
                      on{' '}
                      <span className="font-mono text-white/85">
                        {RESPITE_NEP141_METADATA.contractId}
                      </span>{' '}
                      only accepts one-way{' '}
                      <span className="text-emerald-300 font-semibold">
                        NEAR &rarr; RESPITE
                      </span>{' '}
                      deposits to protect city liquidity against drain bots.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        switchTopTab('marketplace');
                      }}
                      className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/16 text-white text-[11px] font-semibold cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Browse RESPITE NFT Marketplace</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Token & Contract Summary Footer */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-[11px] tabular-nums">
                <div className="flex items-center justify-between text-white/75 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Token Info</span>
                  </span>
                  <span className="text-white/45 font-mono">NEP-141</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-white/60">
                  <span>Swap Rate</span>
                  <span className="text-right font-semibold text-white">
                    1 NEAR = {respiteRatePerNear} R
                  </span>
                  <span>Min Deposit</span>
                  <span className="text-right font-semibold text-white">
                    0.0025 NEAR
                  </span>
                  <span>NFT Floor</span>
                  <span className="text-right font-semibold text-emerald-300">
                    {marketMetrics.floorRespite.toLocaleString()} RESPITE
                  </span>
                  <span>Total Trades</span>
                  <span className="text-right font-semibold text-white">
                    {cryptoTrades.length}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Fish3dPreviewModal
        fish={preview3dFish}
        onClose={() => setPreview3dFish(null)}
      />
      <Furniture3dPreviewModal
        item={preview3dFurniture}
        onClose={() => setPreview3dFurniture(null)}
      />
    </>
  );
};
