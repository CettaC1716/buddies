import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Coins,
  Sparkles,
  Star,
  Wallet,
  X,
} from 'lucide-react';
import type { CafeMenuItemSpec } from '../game/buddiesCafeRules';
import { CafeMenuItemArtwork } from './GlasshouseCafeMenuArtwork';

// Cafe modal family — cream / pastel palette (matches the cafe menu reference:
// warm cream background, white cards, terracotta accent; no black panels).
const CREAM = {
  bg: '#FBF7EF',
  card: '#FFFFFF',
  border: '#EFE6D8',
  ink: '#3E2F26',
  muted: '#8A7A6D',
  accent: '#D96C4F',
  accentDark: '#C85A3E',
  chip: '#F3EAD9',
  selectedBg: '#FDECEA',
  selectedBorder: '#E07856',
};

function CafeModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#3E2F26]/45 backdrop-blur-[2px]"
        onClick={props.onClose}
      />
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-[24px] border shadow-[0_24px_60px_rgba(62,47,38,0.35)] ${
          props.wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
        style={{ backgroundColor: CREAM.bg, borderColor: CREAM.border, color: CREAM.ink }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: CREAM.border, backgroundColor: CREAM.card }}
        >
          <div className="min-w-0">
            <div className="truncate text-lg font-black tracking-wide sm:text-xl">{props.title}</div>
            {props.subtitle ? (
              <div className="mt-0.5 text-xs font-semibold" style={{ color: CREAM.muted }}>
                {props.subtitle}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="shrink-0 rounded-full border p-2 transition hover:rotate-90"
            style={{ borderColor: CREAM.border, backgroundColor: CREAM.bg, color: CREAM.ink }}
            aria-label="Close cafe menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{props.children}</div>
      </div>
    </div>
  );
}

function CafeItemTile(props: {
  item: CafeMenuItemSpec;
  selected: boolean;
  dimmed?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  const { item } = props;
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="relative flex flex-col items-center gap-1 rounded-[18px] border-2 px-2 py-3 text-center transition"
      style={{
        backgroundColor: props.selected ? CREAM.selectedBg : CREAM.card,
        borderColor: props.selected ? CREAM.selectedBorder : CREAM.border,
        opacity: props.dimmed ? 0.45 : 1,
      }}
    >
      {props.badge ? (
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider text-white"
          style={{ backgroundColor: CREAM.accent }}
        >
          {props.badge}
        </span>
      ) : null}
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: `${item.accentHex}26` }}
      >
        <CafeMenuItemArtwork itemId={item.id} className="h-10 w-10" />
      </span>
      <span className="text-[11px] font-black leading-tight">{item.name}</span>
      <span className="text-[10px] font-bold" style={{ color: CREAM.accent }}>
        {item.priceLul} LUL
      </span>
    </button>
  );
}

function CafeItemDetail(props: { item: CafeMenuItemSpec; children: React.ReactNode }) {
  const { item } = props;
  return (
    <div
      className="flex flex-col items-center rounded-[20px] border px-4 py-4 text-center"
      style={{ backgroundColor: CREAM.card, borderColor: CREAM.border }}
    >
      <span
        className="flex h-20 w-20 items-center justify-center rounded-[18px]"
        style={{ backgroundColor: `${item.accentHex}26` }}
      >
        <CafeMenuItemArtwork itemId={item.id} className="h-16 w-16" />
      </span>
      <div className="mt-2 text-base font-black">{item.name}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider"
          style={{ backgroundColor: CREAM.chip, color: CREAM.muted }}
        >
          {item.category === 'drink' ? 'FRESH BREW' : 'FRESH BAKE'}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider"
          style={{ backgroundColor: CREAM.chip, color: CREAM.muted }}
        >
          +{item.xpReward} XP
        </span>
      </div>
      <p className="mt-2 text-xs font-medium leading-relaxed" style={{ color: CREAM.muted }}>
        {item.prepHint}
      </p>
      <div className="mt-3 w-full">{props.children}</div>
    </div>
  );
}

export function GlasshouseCafeOrderModal(props: {
  isOpen: boolean;
  onClose: () => void;
  items: CafeMenuItemSpec[];
  workerName: string | null;
  lulBalance: number;
  cyonBalance: number;
  onBuyLul: (item: CafeMenuItemSpec) => { ok: boolean; message: string };
  onBuyCyon: (item: CafeMenuItemSpec) => { ok: boolean; message: string };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (props.isOpen) {
      setSelectedId(props.items[0]?.id ?? null);
      setFeedback(null);
    }
  }, [props.isOpen, props.items]);

  const selected = useMemo(
    () => props.items.find((it) => it.id === selectedId) ?? props.items[0] ?? null,
    [props.items, selectedId],
  );

  if (!props.isOpen) return null;

  return (
    <CafeModalShell
      title={props.workerName ? `ORDER FROM ${props.workerName.toUpperCase()}` : 'CAFE MENU'}
      subtitle="Pick an item — the barista on shift will prepare it for you."
      onClose={props.onClose}
      wide
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ backgroundColor: CREAM.chip }}
        >
          <Coins className="h-3.5 w-3.5" style={{ color: CREAM.accent }} /> {props.lulBalance} LUL
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ backgroundColor: CREAM.chip }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: CREAM.accent }} /> {props.cyonBalance} CYON
        </span>
        <span style={{ color: CREAM.muted }}>CYON orders earn 2.5x XP</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <div className="grid grid-cols-3 content-start gap-2">
          {props.items.map((item) => (
            <CafeItemTile
              key={item.id}
              item={item}
              selected={selected?.id === item.id}
              onClick={() => {
                setSelectedId(item.id);
                setFeedback(null);
              }}
            />
          ))}
        </div>
        {selected ? (
          <CafeItemDetail item={selected}>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-full py-2.5 text-sm font-black text-white transition"
                style={{ backgroundColor: CREAM.accent }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = CREAM.accentDark)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = CREAM.accent)}
                onClick={() => setFeedback(props.onBuyLul(selected))}
              >
                ORDER · {selected.priceLul} LUL
              </button>
              <button
                type="button"
                className="w-full rounded-full border-2 py-2.5 text-sm font-black transition"
                style={{ borderColor: CREAM.selectedBorder, color: CREAM.accentDark, backgroundColor: CREAM.selectedBg }}
                onClick={() => setFeedback(props.onBuyCyon(selected))}
              >
                ORDER · {selected.priceCyon} CYON · 2.5X XP
              </button>
              {feedback ? (
                <div
                  className="rounded-[14px] px-3 py-2 text-xs font-bold"
                  style={{
                    backgroundColor: feedback.ok ? '#EAF7EE' : '#FDECEA',
                    color: feedback.ok ? '#1E7A3C' : '#B3402A',
                  }}
                >
                  {feedback.message}
                </div>
              ) : null}
            </div>
          </CafeItemDetail>
        ) : null}
      </div>
    </CafeModalShell>
  );
}

export function GlasshouseCafePrepareModal(props: {
  isOpen: boolean;
  onClose: () => void;
  items: CafeMenuItemSpec[];
  category: 'drink' | 'pastry';
  orderedItemId: string | null;
  customerName: string;
  onPrepare: (item: CafeMenuItemSpec) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (props.isOpen) setSelectedId(props.orderedItemId);
  }, [props.isOpen, props.orderedItemId]);

  const selected = useMemo(
    () => props.items.find((it) => it.id === selectedId) ?? null,
    [props.items, selectedId],
  );

  if (!props.isOpen) return null;
  const stationLabel = props.category === 'drink' ? 'COFFEE MACHINE' : 'FOOD DISPLAY';

  return (
    <CafeModalShell
      title={`PREPARE AT ${stationLabel}`}
      subtitle={`Order from ${props.customerName} — pick the highlighted item to prepare it.`}
      onClose={props.onClose}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <div className="grid grid-cols-3 content-start gap-2">
          {props.items.map((item) => (
            <CafeItemTile
              key={item.id}
              item={item}
              selected={selected?.id === item.id}
              dimmed={item.id !== props.orderedItemId}
              badge={item.id === props.orderedItemId ? 'ORDERED' : undefined}
              onClick={() => setSelectedId(item.id)}
            />
          ))}
        </div>
        {selected ? (
          <CafeItemDetail item={selected}>
            {selected.id === props.orderedItemId ? (
              <button
                type="button"
                className="w-full rounded-full py-2.5 text-sm font-black text-white transition"
                style={{ backgroundColor: CREAM.accent }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = CREAM.accentDark)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = CREAM.accent)}
                onClick={() => props.onPrepare(selected)}
              >
                PREPARE
              </button>
            ) : (
              <div
                className="rounded-[14px] px-3 py-2 text-xs font-bold"
                style={{ backgroundColor: CREAM.chip, color: CREAM.muted }}
              >
                Not part of this order — the ordered item is highlighted.
              </div>
            )}
          </CafeItemDetail>
        ) : null}
      </div>
    </CafeModalShell>
  );
}

export function GlasshouseCafeAtmModal(props: {
  isOpen: boolean;
  onClose: () => void;
  lulBalance: number;
  cyonBalance: number;
  /** LUL charged for one 10-CYON packet at today's merchant rate. */
  lulCostFor10Cyon: number;
  treasuryCyon: number;
  onExchangePackets: (packets: number) => { ok: boolean; message: string };
}) {
  const [amountText, setAmountText] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (props.isOpen) {
      setAmountText('');
      setFeedback(null);
    }
  }, [props.isOpen]);

  if (!props.isOpen) return null;

  const rate = Math.max(1, Math.floor(props.lulCostFor10Cyon));
  const amount = Math.max(0, Math.floor(Number(amountText) || 0));
  const maxPackets = Math.max(
    0,
    Math.min(Math.floor(props.lulBalance / rate), Math.floor(props.treasuryCyon / 10)),
  );
  const packets = Math.max(0, Math.min(Math.floor(amount / rate), maxPackets));
  const receiveCyon = packets * 10;
  const costLul = packets * rate;

  return (
    <CafeModalShell
      title="CAFE ATM · EXCHANGE"
      subtitle={`Today's rate: ${rate} LUL = 10 CYON`}
      onClose={props.onClose}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-black">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ backgroundColor: CREAM.chip }}
        >
          <Wallet className="h-3.5 w-3.5" style={{ color: CREAM.accent }} /> You have {props.lulBalance} LUL ·{' '}
          {props.cyonBalance} CYON
        </span>
        <span style={{ color: CREAM.muted }}>Shop stock: {props.treasuryCyon} CYON</span>
      </div>

      <label className="text-xs font-black tracking-wide" style={{ color: CREAM.muted }}>
        YOU PAY (LUL)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value.replace(/[^0-9]/g, ''));
            setFeedback(null);
          }}
          placeholder="0"
          className="min-w-0 flex-1 rounded-[16px] border-2 px-4 py-3 text-lg font-black outline-none"
          style={{ borderColor: CREAM.border, backgroundColor: CREAM.card, color: CREAM.ink }}
        />
        <button
          type="button"
          className="shrink-0 rounded-full px-4 text-sm font-black"
          style={{ backgroundColor: CREAM.chip, color: CREAM.accentDark }}
          onClick={() => {
            setAmountText(String(maxPackets * rate));
            setFeedback(null);
          }}
        >
          MAX
        </button>
      </div>

      <div
        className="mt-3 flex items-center justify-between rounded-[16px] border px-4 py-3"
        style={{ borderColor: CREAM.border, backgroundColor: CREAM.card }}
      >
        <span className="text-xs font-black tracking-wide" style={{ color: CREAM.muted }}>
          YOU RECEIVE
        </span>
        <span className="text-lg font-black" style={{ color: CREAM.accent }}>
          {receiveCyon} CYON
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold" style={{ color: CREAM.muted }}>
        {packets > 0
          ? `${packets} packet${packets > 1 ? 's' : ''} × ${rate} LUL — exactly ${costLul} LUL will be charged, the rest stays in your balance.`
          : `Enter at least ${rate} LUL to exchange one packet.`}
      </p>

      <button
        type="button"
        disabled={packets < 1}
        className="mt-4 w-full rounded-full py-3 text-sm font-black text-white transition disabled:opacity-40"
        style={{ backgroundColor: CREAM.accent }}
        onClick={() => setFeedback(props.onExchangePackets(packets))}
      >
        EXCHANGE
      </button>
      {feedback ? (
        <div
          className="mt-3 rounded-[14px] px-3 py-2 text-center text-xs font-bold"
          style={{
            backgroundColor: feedback.ok ? '#EAF7EE' : '#FDECEA',
            color: feedback.ok ? '#1E7A3C' : '#B3402A',
          }}
        >
          {feedback.message}
        </div>
      ) : null}
    </CafeModalShell>
  );
}

export type CafeWorkerOrderCard = {
  key: string;
  customerName: string;
  itemName: string;
  itemId: CafeMenuItemSpec['id'];
  description: string;
  status: 'prepare' | 'ready';
  statusText: string;
  isActive: boolean;
};

export function GlasshouseCafeOrdersModal(props: {
  isOpen: boolean;
  onClose: () => void;
  orders: CafeWorkerOrderCard[];
  onServeActive: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (props.isOpen) setIndex(0);
  }, [props.isOpen]);
  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(0, props.orders.length - 1)));
  }, [props.orders.length]);

  if (!props.isOpen || props.orders.length === 0) return null;
  const order = props.orders[Math.min(index, props.orders.length - 1)];

  return (
    <CafeModalShell
      title="YOU RECEIVED AN ORDER FROM"
      subtitle={order.customerName}
      onClose={props.onClose}
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-[20px] bg-[#F3EAD9]">
          <CafeMenuItemArtwork itemId={order.itemId} className="h-20 w-20" />
        </span>
        <div className="mt-3 text-lg font-black tracking-wide">{order.itemName.toUpperCase()}</div>
        <div
          className="mt-2 h-[3px] w-40 rounded-full"
          style={{ backgroundColor: order.status === 'ready' ? '#35C26B' : CREAM.accent }}
        />
        <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed" style={{ color: CREAM.muted }}>
          {order.description}
        </p>
        <div
          className="mt-4 rounded-full px-3 py-1.5 text-[11px] font-black tracking-wide"
          style={{
            backgroundColor: order.status === 'ready' ? '#EAF7EE' : CREAM.chip,
            color: order.status === 'ready' ? '#1E7A3C' : CREAM.accentDark,
          }}
        >
          {order.statusText}
        </div>
        {order.isActive && order.status === 'ready' ? (
          <button
            type="button"
            className="mt-4 w-full max-w-xs rounded-full py-3 text-sm font-black text-white"
            style={{ backgroundColor: '#35C26B' }}
            onClick={props.onServeActive}
          >
            SERVE AT THE COUNTER
          </button>
        ) : null}
        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            aria-label="Previous order"
            disabled={index <= 0}
            onClick={() => setIndex((v) => Math.max(0, v - 1))}
            className="rounded-full border p-2 disabled:opacity-30"
            style={{ borderColor: CREAM.border, backgroundColor: CREAM.card }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-black" style={{ color: CREAM.muted }}>
            ({index + 1}/{props.orders.length})
          </span>
          <button
            type="button"
            aria-label="Next order"
            disabled={index >= props.orders.length - 1}
            onClick={() => setIndex((v) => Math.min(props.orders.length - 1, v + 1))}
            className="rounded-full border p-2 disabled:opacity-30"
            style={{ borderColor: CREAM.border, backgroundColor: CREAM.card }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </CafeModalShell>
  );
}

export function CafeOrderToastBanner(props: {
  customerName: string;
  itemName: string;
  extraCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="pointer-events-auto flex w-full items-center gap-2.5 rounded-full bg-[#232936]/92 py-2 pl-3 pr-4 shadow-[0_10px_28px_rgba(10,14,24,0.45)] ring-1 ring-white/25 backdrop-blur-md"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#35C26B] text-white">
        <Coffee className="h-4 w-4" />
      </span>
      <span className="truncate text-left text-[13px] font-bold text-white">
        You received an order from {props.customerName}!{' '}
        <span className="font-black">{props.itemName}</span>
        {props.extraCount > 0 ? <span className="text-white/70"> · +{props.extraCount} more</span> : null}
      </span>
    </button>
  );
}

export function CafeOrderBellButton(props: { count: number; onClick: () => void }) {
  if (props.count <= 0) return null;
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label="Open cafe orders"
      className="pointer-events-auto flex w-full items-center gap-2.5 rounded-full bg-[#232936]/92 py-2 pl-3 pr-3 text-white shadow-[0_10px_28px_rgba(10,14,24,0.45)] ring-1 ring-white/25 backdrop-blur-md transition hover:bg-[#2c3446]/95 active:scale-[0.98]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#35C26B] text-white">
        <Bell className="h-4 w-4" />
      </span>
      <span className="text-[13px] font-bold">Orders</span>
      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E5484D] px-1.5 text-[11px] font-black text-white">
        {props.count}
      </span>
    </button>
  );
}

export function XpGainCelebrationBanner(props: {
  banner: { id: number; xpGained: number; leveledUpTo: number | null; label: string } | null;
}) {
  const { banner } = props;
  if (!banner) return null;
  return (
    <div
      data-xp-celebration-banner="true"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none animate-bounce"
    >
      <div className="flex items-center gap-2 bg-[#14161d] text-white border-[3px] border-[#b8ff3c] ring-2 ring-black shadow-[4px_4px_0_#000] px-4 py-2 rounded-xl">
        {banner.leveledUpTo ? (
          <Star className="w-5 h-5 text-[#facc15] fill-[#facc15]" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-[#b8ff3c]" aria-hidden="true" />
        )}
        <span className="text-xs font-black uppercase tracking-wider">
          {banner.leveledUpTo
            ? `LEVEL UP! NOW LV ${banner.leveledUpTo} (+${banner.xpGained} XP)`
            : `${banner.label} · +${banner.xpGained} XP`}
        </span>
      </div>
    </div>
  );
}

export function GlasshouseCafeQueueModal(props: {
  isOpen: boolean;
  onClose: () => void;
  workerName: string | null;
  queueNames: string[];
  myRole: 'worker' | 'queue' | 'called' | 'none';
  myQueuePos: number;
  onJoin: () => void;
  onLeave: () => void;
  onClaim: () => void;
}) {
  if (!props.isOpen) return null;
  return (
    <CafeModalShell
      title="SHIFT QUEUE"
      subtitle="One barista at a time — join the list and wait for your turn."
      onClose={props.onClose}
    >
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center justify-between rounded-[16px] border px-4 py-3"
          style={{ borderColor: CREAM.border, backgroundColor: CREAM.card }}
        >
          <span className="text-[11px] font-black tracking-wider" style={{ color: CREAM.muted }}>
            NOW WORKING
          </span>
          <span className="text-sm font-black">
            {props.workerName ?? '— nobody yet —'}
          </span>
        </div>
        <div className="mt-1 text-[11px] font-black tracking-wider" style={{ color: CREAM.muted }}>
          WAITING LIST
        </div>
        {props.queueNames.length === 0 ? (
          <div
            className="rounded-[16px] border px-4 py-3 text-sm font-semibold"
            style={{ borderColor: CREAM.border, backgroundColor: CREAM.card, color: CREAM.muted }}
          >
            Nobody is waiting.
          </div>
        ) : (
          props.queueNames.map((name, i) => {
            const isMe = props.myQueuePos === i + 1;
            return (
              <div
                key={`${name}-${i}`}
                className="flex items-center justify-between rounded-[16px] border px-4 py-2.5"
                style={{
                  borderColor: isMe ? CREAM.selectedBorder : CREAM.border,
                  backgroundColor: isMe ? CREAM.selectedBg : CREAM.card,
                }}
              >
                <span className="text-sm font-black">
                  #{i + 1} {name}
                  {isMe ? ' (You)' : ''}
                </span>
                {i === 0 && !props.workerName ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider text-white"
                    style={{ backgroundColor: CREAM.accent }}
                  >
                    NEXT UP
                  </span>
                ) : null}
              </div>
            );
          })
        )}
        <div className="mt-3">
          {props.myRole === 'worker' ? (
            <div
              className="rounded-[14px] px-3 py-2.5 text-center text-xs font-bold"
              style={{ backgroundColor: '#EAF7EE', color: '#1E7A3C' }}
            >
              You are on shift right now — serve 3 orders before the timer ends!
            </div>
          ) : props.myRole === 'called' ? (
            <button
              type="button"
              className="w-full rounded-full py-3 text-sm font-black text-white"
              style={{ backgroundColor: '#35C26B' }}
              onClick={props.onClaim}
            >
              IT'S YOUR TURN — START WORKING
            </button>
          ) : props.myRole === 'queue' ? (
            <button
              type="button"
              className="w-full rounded-full border-2 py-3 text-sm font-black"
              style={{ borderColor: CREAM.selectedBorder, color: CREAM.accentDark, backgroundColor: CREAM.selectedBg }}
              onClick={props.onLeave}
            >
              LEAVE THE WAITING LIST
            </button>
          ) : !props.workerName && props.queueNames.length === 0 ? (
            <button
              type="button"
              className="w-full rounded-full py-3 text-sm font-black text-white"
              style={{ backgroundColor: CREAM.accent }}
              onClick={props.onClaim}
            >
              START WORKING
            </button>
          ) : (
            <button
              type="button"
              className="w-full rounded-full py-3 text-sm font-black text-white"
              style={{ backgroundColor: CREAM.accent }}
              onClick={props.onJoin}
            >
              JOIN THE WAITING LIST
            </button>
          )}
        </div>
      </div>
    </CafeModalShell>
  );
}
