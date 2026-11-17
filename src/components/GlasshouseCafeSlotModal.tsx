import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  Coffee,
  Coins,
  FastForward,
  Minus,
  Play,
  Plus,
  RotateCw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  ARCADE_SLOT_BET_TIERS,
  ARCADE_SLOT_MIN_BET_LUL,
  ARCADE_SLOT_STRIP,
  ARCADE_SLOT_SYMBOLS,
  type ArcadeSlotEvaluation,
  type ArcadeSlotSymbolId,
  spinArcadeSlotReels,
} from '../game/buddiesArcadeSlots';
import type { PlayerLevelProgress } from '../game/buddiesCafeRules';

interface WinningBeamLine {
  coords: ReadonlyArray<{ col: number; row: number }>;
  colorHex: string;
}

interface RecentCafeHit {
  player: string;
  symbolLabel: string;
  amountLul: number;
}

const INITIAL_CAFE_RECENT_HITS: RecentCafeHit[] = [
  { player: 'HANA', symbolLabel: '3x DIAMOND', amountLul: 100 },
  { player: 'KAI', symbolLabel: '3x STAR', amountLul: 60 },
  { player: 'MILO', symbolLabel: '2x LUCKY 7', amountLul: 20 },
  { player: 'SORA', symbolLabel: '3x BELL', amountLul: 40 },
];

const CELL_HEIGHT_PX = 108;
const VISIBLE_ROWS = 3;

const pickRandomCafeSymbol = (): ArcadeSlotSymbolId => {
  const idx = Math.floor(Math.random() * ARCADE_SLOT_STRIP.length);
  return ARCADE_SLOT_STRIP[idx] ?? 'cherry';
};

const SlotSymbolArtwork: React.FC<{ id: ArcadeSlotSymbolId; sizeClass?: string }> = ({
  id,
  sizeClass = 'w-14 h-14',
}) => {
  const uid = useId();
  switch (id) {
    case 'seven':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-seven-badge`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id={`${uid}-seven-body`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b6b" />
              <stop offset="48%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="rgba(120,53,15,0.22)" />
          <rect
            x="8"
            y="7"
            width="48"
            height="48"
            rx="14"
            fill={`url(#${uid}-seven-badge)`}
            stroke="#451a03"
            strokeWidth="3"
          />
          <rect
            x="12"
            y="11"
            width="40"
            height="40"
            rx="10"
            fill="#fffbeb"
            stroke="#d97706"
            strokeWidth="1.8"
          />
          <path
            d="M19 19h26v8.5L31 50h-9.5L35 27.5H19z"
            transform="translate(0, 2.5)"
            fill="#7f1d1d"
          />
          <path
            d="M19 17.5h26V26L31 48.5h-9.5L35 26H19z"
            fill={`url(#${uid}-seven-body)`}
            stroke="#450a0a"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path d="M21.5 20h20.5l-1.2 2.6H21.5z" fill="#fecaca" opacity="0.85" />
          <circle cx="46" cy="17" r="3" fill="#fef08a" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-gem-top`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ecfeff" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
            <linearGradient id={`${uid}-gem-body`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="16" ry="3.8" fill="rgba(12,74,110,0.22)" />
          <polygon
            points="18,12 46,12 57,26 32,54 7,26"
            fill={`url(#${uid}-gem-body)`}
            stroke="#083344"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon points="18,12 46,12 57,26 7,26" fill={`url(#${uid}-gem-top)`} />
          <polygon points="23,12 41,12 45,26 19,26" fill="#ffffff" opacity="0.7" />
          <polygon points="7,26 19,26 32,54" fill="#0284c7" opacity="0.75" />
          <polygon points="45,26 57,26 32,54" fill="#0369a1" opacity="0.85" />
          <polygon points="19,26 45,26 32,54" fill="#38bdf8" opacity="0.85" />
          <line x1="7" y1="26" x2="57" y2="26" stroke="#083344" strokeWidth="2.4" />
          <polyline
            points="18,12 19,26 32,54 45,26 46,12"
            fill="none"
            stroke="#083344"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="19" r="2.2" fill="#ffffff" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-star-gold`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="17" ry="3.8" fill="rgba(146,64,14,0.22)" />
          <polygon
            points="32,9 39.5,23.5 56,25.8 43.8,37.2 46.8,53.5 32,45.5 17.2,53.5 20.2,37.2 8,25.8 24.5,23.5"
            transform="translate(0, 2)"
            fill="#92400e"
          />
          <polygon
            points="32,7 39.5,22 56,24.4 43.8,36 46.8,52.5 32,44.5 17.2,52.5 20.2,36 8,24.4 24.5,22"
            fill={`url(#${uid}-star-gold)`}
            stroke="#451a03"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <polygon
            points="32,12 36.8,22.5 48,24.2 32,32 25.5,22.5"
            fill="#fef9c3"
            opacity="0.78"
          />
          <circle cx="28" cy="24" r="2.3" fill="#ffffff" opacity="0.9" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-bell-brass`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="17" ry="3.8" fill="rgba(120,53,15,0.22)" />
          <circle cx="32" cy="11.5" r="5" fill="#f59e0b" stroke="#451a03" strokeWidth="2.8" />
          <circle cx="32" cy="46.5" r="6.5" fill="#92400e" />
          <path
            d="M25.5 45a6.5 6.5 0 0 0 13 0z"
            fill="#b45309"
            stroke="#451a03"
            strokeWidth="2.8"
          />
          <path
            d="M17.5 32c0-10.5 6.2-17.5 14.5-17.5S46.5 21.5 46.5 32l5.5 12.5H12z"
            fill={`url(#${uid}-bell-brass)`}
            stroke="#451a03"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M23 20.5c-2.8 3.2-4.2 7.5-4.2 12l-2.2 6.5h4.2l1.6-6.5c0-4.2 1.2-8 3.6-10.8z"
            fill="#fef9c3"
            opacity="0.8"
          />
          <rect x="13" y="40.5" width="38" height="4" rx="2" fill="#fde68a" opacity="0.65" />
        </svg>
      );
    case 'coffee':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-cup-body`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="60%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <ellipse cx="31" cy="55" rx="21" ry="4.5" fill="rgba(120,53,15,0.2)" />
          <ellipse
            cx="30"
            cy="50.5"
            rx="20"
            ry="5.5"
            fill="#fef3c7"
            stroke="#451a03"
            strokeWidth="2.8"
          />
          <path
            d="M43 27.5h5.2c4 0 6.5 2.8 6.5 6.2s-2.5 6.3-6.5 6.3H43"
            fill="none"
            stroke="#451a03"
            strokeWidth="5.2"
            strokeLinecap="round"
          />
          <path
            d="M43 27.5h5.2c4 0 6.5 2.8 6.5 6.2s-2.5 6.3-6.5 6.3H43"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M15 23.5h30v13.5c0 8-6.5 13-15 13s-15-5-15-13z"
            fill={`url(#${uid}-cup-body)`}
            stroke="#451a03"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <ellipse
            cx="30"
            cy="23.5"
            rx="15"
            ry="4.8"
            fill="#78350f"
            stroke="#451a03"
            strokeWidth="2.6"
          />
          <ellipse cx="30" cy="23.5" rx="11" ry="2.8" fill="#b45309" />
          <path
            d="M25 15.5c0-2.6 2.5-2.8 2.5-5.4M33 14.5c0-2.6 2.5-2.8 2.5-5.4"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'cherry':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <radialGradient id={`${uid}-cherry-left`} cx="35%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="40%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </radialGradient>
            <radialGradient id={`${uid}-cherry-right`} cx="35%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="42%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#881337" />
            </radialGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="19" ry="3.8" fill="rgba(136,19,55,0.2)" />
          <path
            d="M21 36c3-12 9-19 17.5-25.5M45 37c-1-10.5-3-19-6.5-26.5"
            fill="none"
            stroke="#365314"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M38 11c5-3.5 13-2 15.5 2.5-4.5 4-12.5 3.5-15.5-2.5z"
            fill="#84cc16"
            stroke="#365314"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <circle
            cx="20.5"
            cy="43"
            r="11.5"
            fill={`url(#${uid}-cherry-left)`}
            stroke="#450a0a"
            strokeWidth="3"
          />
          <circle
            cx="43.5"
            cy="44.5"
            r="11.5"
            fill={`url(#${uid}-cherry-right)`}
            stroke="#450a0a"
            strokeWidth="3"
          />
          <ellipse
            cx="16.8"
            cy="38.5"
            rx="3.2"
            ry="2"
            transform="rotate(-28 16.8 38.5)"
            fill="#ffffff"
            opacity="0.88"
          />
          <ellipse
            cx="39.8"
            cy="40"
            rx="3.2"
            ry="2"
            transform="rotate(-28 39.8 40)"
            fill="#ffffff"
            opacity="0.88"
          />
        </svg>
      );
  }
};

const CafeReelSymbolTile: React.FC<{
  symbolId: ArcadeSlotSymbolId;
  isCenterRow: boolean;
  highlighted: boolean;
  wonMultiplier?: number;
}> = ({ symbolId, isCenterRow, highlighted, wonMultiplier }) => {
  const spec = ARCADE_SLOT_SYMBOLS.find((s) => s.id === symbolId);
  const showCornerBadge = highlighted || (isCenterRow && symbolId === 'seven');

  return (
    <div
      className={`relative w-full max-w-[196px] h-[88px] rounded-xl border-[2.5px] flex flex-col items-center justify-center pb-2.5 transition-transform duration-150 ${
        highlighted
          ? 'bg-gradient-to-b from-[#fef08a] via-[#fbbf24] to-[#f59e0b] border-[#fffbeb] ring-3 ring-[#b8ff3c] scale-[1.04] shadow-[0_4px_0_#3b1806]'
          : isCenterRow
            ? 'bg-gradient-to-b from-[#fffdf7] via-[#fef3c7] to-[#fde68a] border-[#78350f] shadow-[0_3px_0_#451a03]'
            : 'bg-gradient-to-b from-[#fdf6e7]/90 to-[#f5ead4]/90 border-[#cbb894] opacity-80'
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 rounded-lg border border-[#78350f]/15"
      />

      {showCornerBadge && (
        <div
          className={`absolute -top-2 -right-2 z-10 px-1.5 py-0.5 rounded-lg border-2 border-[#14161d] font-mono-tabular font-black text-[9.5px] uppercase shadow-[0_2px_0_#14161d] whitespace-nowrap ${
            highlighted ? 'bg-[#b8ff3c] text-[#14161d]' : 'bg-[#1e212b] text-[#fec83e]'
          }`}
        >
          {highlighted && wonMultiplier ? `${wonMultiplier}X` : '50X'}
        </div>
      )}

      <SlotSymbolArtwork id={symbolId} sizeClass="w-12 h-12 sm:w-13 sm:h-13" />

      <div
        className={`absolute -bottom-2 inset-x-3 py-0.5 px-1.5 rounded-full border-2 text-center shadow-[0_2px_0_#3b1806] ${
          highlighted
            ? 'bg-gradient-to-b from-[#d9f99d] to-[#65a30d] border-white text-[#14161d]'
            : isCenterRow
              ? 'bg-gradient-to-b from-[#7c2d12] to-[#3b1806] border-[#fef3c7] text-[#fffbeb]'
              : 'bg-[#573614] border-[#efe4ce] text-[#fef3c7]'
        }`}
      >
        <span className="block text-[9px] font-black uppercase tracking-wider truncate">
          {spec?.label ?? symbolId}
        </span>
      </div>
    </div>
  );
};

export interface GlasshouseCafeSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  lulBalance: number;
  levelProgress: PlayerLevelProgress;
  onDebitStake: (betLul: number) => { ok: boolean; message: string };
  onSettleSpin: (evaluation: ArcadeSlotEvaluation, betLul: number) => void;
}

export const GlasshouseCafeSlotModal: React.FC<GlasshouseCafeSlotModalProps> = ({
  isOpen,
  onClose,
  lulBalance,
  levelProgress,
  onDebitStake,
  onSettleSpin,
}) => {
  const jackpotGradId = useId();
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const rafIdsRef = useRef<number[]>([]);

  const [selectedBet, setSelectedBet] = useState<number>(5);
  const [reels, setReels] = useState<[ArcadeSlotSymbolId, ArcadeSlotSymbolId, ArcadeSlotSymbolId]>([
    'seven',
    'diamond',
    'star',
  ]);
  const [reelTapes, setReelTapes] = useState<
    [ArcadeSlotSymbolId[], ArcadeSlotSymbolId[], ArcadeSlotSymbolId[]]
  >(() => [
    ['cherry', 'seven', 'coffee'],
    ['bell', 'diamond', 'cherry'],
    ['coffee', 'star', 'bell'],
  ]);
  const currentMatrixRef = useRef<
    [ArcadeSlotSymbolId[], ArcadeSlotSymbolId[], ArcadeSlotSymbolId[]]
  >(reelTapes);
  const stripDomRefs = useRef<[HTMLDivElement | null, HTMLDivElement | null, HTMLDivElement | null]>(
    [null, null, null],
  );
  const [spinningCols, setSpinningCols] = useState<[boolean, boolean, boolean]>([
    false,
    false,
    false,
  ]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isTurbo, setIsTurbo] = useState(false);
  const [isAutoSpin, setIsAutoSpin] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => !soundEngine.muted);
  const [isPaytableOpen, setIsPaytableOpen] = useState(false);

  const [lastResult, setLastResult] = useState<ArcadeSlotEvaluation | null>(null);
  const [lastWinLul, setLastWinLul] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Pick your stake and press Spin');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState({ spins: 0, bestWinLul: 0, netLul: 0 });
  const [recentHits, setRecentHits] = useState<RecentCafeHit[]>(INITIAL_CAFE_RECENT_HITS);
  const [winningCellKeys, setWinningCellKeys] = useState<Set<string>>(() => new Set());
  const [winningBeams, setWinningBeams] = useState<WinningBeamLine[]>([]);

  const isAutoSpinRef = useRef(false);
  isAutoSpinRef.current = isAutoSpin;
  const isTurboRef = useRef(false);
  isTurboRef.current = isTurbo;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const pendingSettlementRef = useRef<{ evaluation: ArcadeSlotEvaluation; betLul: number } | null>(
    null,
  );
  const onSettleSpinRef = useRef(onSettleSpin);
  onSettleSpinRef.current = onSettleSpin;
  const handleSpinRef = useRef<() => void>(() => {});

  const paylineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      rot: number;
      vRot: number;
    }>
  >([]);
  const particleRafRef = useRef<number | null>(null);

  const playCabinetClick = useCallback(() => {
    if (soundEnabledRef.current) soundEngine.playUiClick();
  }, []);

  const playCabinetTick = useCallback((step = 0) => {
    if (soundEnabledRef.current) soundEngine.playSlotReelTick(step);
  }, []);

  const playCabinetReelLock = useCallback((colIdx: number, excited = false) => {
    if (soundEnabledRef.current) soundEngine.playSlotReelLock(colIdx, excited);
  }, []);

  const triggerCoinParticleBurst = useCallback((count = 36) => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.44;
    const palette = ['#fec83e', '#fde047', '#f59e0b', '#b8ff3c', '#84cc16'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3.2;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        size: Math.random() * 8.5 + 6,
        color: palette[i % palette.length] ?? '#fec83e',
        alpha: 1,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 14,
      });
    }

    if (particleRafRef.current !== null) return;

    const renderParticles = () => {
      const c = particleCanvasRef.current;
      if (!c) {
        particleRafRef.current = null;
        return;
      }
      const ctx = c.getContext('2d');
      if (!ctx) {
        particleRafRef.current = null;
        return;
      }
      ctx.clearRect(0, 0, c.width, c.height);

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28;
        p.rot += p.vRot;
        p.alpha -= 0.015;

        if (p.alpha <= 0 || p.y > c.height + 20) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.74, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#3b1806';
        ctx.stroke();
        ctx.fillStyle = '#3b1806';
        ctx.font = '900 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('L', 0, 0.5);
        ctx.restore();
      }

      if (particlesRef.current.length > 0) {
        particleRafRef.current = window.requestAnimationFrame(renderParticles);
      } else {
        particleRafRef.current = null;
        ctx.clearRect(0, 0, c.width, c.height);
      }
    };

    particleRafRef.current = window.requestAnimationFrame(renderParticles);
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    timersRef.current = [];
    for (const rid of rafIdsRef.current) {
      window.cancelAnimationFrame(rid);
    }
    rafIdsRef.current = [];
    for (let i = 0; i < 3; i++) {
      const stripEl = stripDomRefs.current[i];
      if (stripEl) {
        stripEl.style.setProperty('transform', 'translateY(0px)');
      }
    }
  }, []);

  const flushPendingSettlement = useCallback(() => {
    const pending = pendingSettlementRef.current;
    if (!pending) return;
    pendingSettlementRef.current = null;
    const { evaluation, betLul } = pending;
    onSettleSpinRef.current(evaluation, betLul);
    setSessionStats((prev) => ({
      spins: prev.spins + 1,
      bestWinLul: Math.max(prev.bestWinLul, evaluation.payoutLul),
      netLul: prev.netLul + evaluation.netDeltaLul,
    }));
    setLastResult(evaluation);
    setLastWinLul(evaluation.payoutLul);
    setStatusMessage(`${evaluation.headline} · +${evaluation.xpGained} XP`);
    setReels(evaluation.reels);
    setSpinningCols([false, false, false]);
    setIsSpinning(false);

    if (evaluation.payoutLul > 0 && evaluation.matchedSymbol) {
      const countPrefix =
        evaluation.outcomeKind === 'jackpot' || evaluation.outcomeKind === 'triple' ? '3x' : '2x';
      setRecentHits((prev) => [
        {
          player: 'YOU',
          symbolLabel: `${countPrefix} ${evaluation.matchedSymbol!.label}`,
          amountLul: evaluation.payoutLul,
        },
        ...prev.slice(0, 3),
      ]);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      if (particleRafRef.current !== null) {
        window.cancelAnimationFrame(particleRafRef.current);
        particleRafRef.current = null;
      }
      flushPendingSettlement();
    };
  }, [clearTimers, flushPendingSettlement]);

  useEffect(() => {
    if (!isOpen) {
      setIsAutoSpin(false);
      setIsPaytableOpen(false);
      clearTimers();
      flushPendingSettlement();
      setErrorMsg(null);
    }
  }, [isOpen, clearTimers, flushPendingSettlement]);

  const drawLaserPaylines = useCallback((beams: ReadonlyArray<WinningBeamLine>) => {
    const canvas = paylineCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (beams.length === 0) return;

    const colW = canvas.width / 3;
    const rowH = canvas.height / VISIBLE_ROWS;

    for (const beam of beams) {
      ctx.beginPath();
      beam.coords.forEach((pt, idx) => {
        const x = pt.col * colW + colW * 0.5;
        const y = pt.row * rowH + rowH * 0.5;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#3b1806';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.strokeStyle = beam.colorHex;
      ctx.lineWidth = 4.5;
      ctx.shadowColor = beam.colorHex;
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = 1.6;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    drawLaserPaylines(winningBeams);
    const onResize = () => drawLaserPaylines(winningBeams);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, winningBeams, drawLaserPaylines]);

  const scheduleAutoSpinNext = useCallback(() => {
    if (!isAutoSpinRef.current || !mountedRef.current) return;
    const delay = isTurboRef.current ? 420 : 920;
    const tid = window.setTimeout(() => {
      if (mountedRef.current && isAutoSpinRef.current) {
        handleSpinRef.current();
      }
    }, delay);
    timersRef.current.push(tid);
  }, []);

  const handleSpin = useCallback(() => {
    if (isSpinning || isPaytableOpen) return;
    setErrorMsg(null);

    const spin = spinArcadeSlotReels(selectedBet, lulBalance);
    if (!spin.ok || !spin.evaluation) {
      if (soundEnabledRef.current) soundEngine.playHit();
      setErrorMsg(spin.message);
      setStatusMessage(spin.message);
      setIsAutoSpin(false);
      return;
    }

    const debit = onDebitStake(spin.betLul);
    if (!debit.ok) {
      if (soundEnabledRef.current) soundEngine.playHit();
      setErrorMsg(debit.message);
      setStatusMessage(debit.message);
      setIsAutoSpin(false);
      return;
    }

    clearTimers();
    const targetEval = spin.evaluation;
    const betLul = spin.betLul;
    pendingSettlementRef.current = { evaluation: targetEval, betLul };

    setLastResult(null);
    setLastWinLul(0);
    setWinningCellKeys(new Set());
    setWinningBeams([]);
    setIsSpinning(true);
    setSpinningCols([true, true, true]);
    setStatusMessage(`Spinning Reels (${betLul} LUL)...`);

    if (soundEnabledRef.current) {
      soundEngine.playCasinoLeverPull();
    }

    const targetCols: [ArcadeSlotSymbolId[], ArcadeSlotSymbolId[], ArcadeSlotSymbolId[]] = [
      [pickRandomCafeSymbol(), targetEval.reels[0], pickRandomCafeSymbol()],
      [pickRandomCafeSymbol(), targetEval.reels[1], pickRandomCafeSymbol()],
      [pickRandomCafeSymbol(), targetEval.reels[2], pickRandomCafeSymbol()],
    ];

    const intermediateLen = isTurboRef.current ? 10 : 18;
    const fullTapes: [ArcadeSlotSymbolId[], ArcadeSlotSymbolId[], ArcadeSlotSymbolId[]] = [
      [],
      [],
      [],
    ];
    for (let c = 0; c < 3; c++) {
      const prevCol = currentMatrixRef.current[c] ?? ['cherry', 'seven', 'coffee'];
      const mid: ArcadeSlotSymbolId[] = Array.from({ length: intermediateLen }, () =>
        pickRandomCafeSymbol(),
      );
      fullTapes[c] = [...prevCol, ...mid, ...targetCols[c]];
    }

    setReelTapes(fullTapes);

    const baseDur = isTurboRef.current ? 440 : 880;
    const stagger = isTurboRef.current ? 150 : 320;
    let stoppedCount = 0;

    const easeOutBack = (t: number) => {
      const c1 = 1.55;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    for (let colIdx = 0; colIdx < 3; colIdx++) {
      const totalDist = (fullTapes[colIdx].length - VISIBLE_ROWS) * CELL_HEIGHT_PX;
      const duration = baseDur + colIdx * stagger;
      const startTime = performance.now();
      let lastTick = 0;

      const stepCol = (now: number) => {
        if (!mountedRef.current) return;
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const stripEl = stripDomRefs.current[colIdx];

        if (progress < 0.92 && now - lastTick > (isTurboRef.current ? 55 : 80)) {
          playCabinetTick(colIdx);
          lastTick = now;
        }

        const eased =
          progress < 0.82
            ? (progress / 0.82) * 0.88
            : 0.88 + easeOutBack((progress - 0.82) / 0.18) * 0.12;

        if (stripEl) {
          stripEl.style.setProperty('transform', `translateY(${-totalDist * eased}px)`);
        }

        if (progress < 1) {
          const rid = window.requestAnimationFrame(stepCol);
          rafIdsRef.current.push(rid);
          return;
        }

        if (stripEl) {
          stripEl.style.setProperty('transform', 'translateY(0px)');
        }

        setSpinningCols((prev) => {
          const next: [boolean, boolean, boolean] = [...prev];
          next[colIdx] = false;
          return next;
        });
        setReelTapes((prev) => {
          const next: [ArcadeSlotSymbolId[], ArcadeSlotSymbolId[], ArcadeSlotSymbolId[]] = [
            prev[0],
            prev[1],
            prev[2],
          ];
          next[colIdx] = targetCols[colIdx];
          return next;
        });
        setReels((prev) => {
          const next: [ArcadeSlotSymbolId, ArcadeSlotSymbolId, ArcadeSlotSymbolId] = [
            prev[0],
            prev[1],
            prev[2],
          ];
          next[colIdx] = targetEval.reels[colIdx];
          return next;
        });

        const isPairTension = colIdx === 1 && targetEval.reels[0] === targetEval.reels[1];
        playCabinetReelLock(colIdx, isPairTension || (colIdx === 2 && targetEval.payoutLul > 0));
        if (isPairTension) {
          setStatusMessage('Pair Locked · Waiting Reel 3...');
        }

        stoppedCount += 1;
        if (stoppedCount === 3) {
          currentMatrixRef.current = targetCols;
          flushPendingSettlement();

          if (targetEval.matchedSymbol) {
            const matchedId = targetEval.matchedSymbol.id;
            const hitKeys = new Set<string>();
            const hitCols: Array<{ col: number; row: number }> = [];
            ([0, 1, 2] as const).forEach((c) => {
              if (targetEval.reels[c] === matchedId) {
                hitKeys.add(`${c}-1`);
                hitCols.push({ col: c, row: 1 });
              }
            });
            setWinningCellKeys(hitKeys);
            if (hitCols.length >= 2) {
              setWinningBeams([
                {
                  coords: hitCols,
                  colorHex:
                    targetEval.outcomeKind === 'jackpot' || targetEval.outcomeKind === 'triple'
                      ? '#b8ff3c'
                      : '#fec83e',
                },
              ]);
            }
          }

          if (soundEnabledRef.current) {
            if (targetEval.outcomeKind === 'jackpot' || targetEval.outcomeKind === 'triple') {
              soundEngine.playCasinoJackpotFanfare(targetEval.outcomeKind === 'jackpot');
              soundEngine.playPickup();
            } else if (targetEval.outcomeKind === 'pair_win') {
              soundEngine.playOrderBell();
            } else if (targetEval.outcomeKind === 'push') {
              soundEngine.playUiConfirm();
            } else {
              soundEngine.playHit();
            }
          }

          if (targetEval.payoutLul > 0) {
            triggerCoinParticleBurst(
              targetEval.outcomeKind === 'jackpot'
                ? 68
                : targetEval.outcomeKind === 'triple'
                  ? 44
                  : 24,
            );
          }

          scheduleAutoSpinNext();
        }
      };

      const rid = window.requestAnimationFrame(stepCol);
      rafIdsRef.current.push(rid);
    }
  }, [
    isSpinning,
    isPaytableOpen,
    selectedBet,
    lulBalance,
    onDebitStake,
    clearTimers,
    playCabinetTick,
    playCabinetReelLock,
    flushPendingSettlement,
    triggerCoinParticleBurst,
    scheduleAutoSpinNext,
  ]);

  handleSpinRef.current = handleSpin;

  const handleClose = useCallback(() => {
    setIsAutoSpin(false);
    setIsPaytableOpen(false);
    clearTimers();
    flushPendingSettlement();
    if (soundEnabledRef.current) soundEngine.playUiCancel();
    onClose();
  }, [clearTimers, flushPendingSettlement, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isPaytableOpen) {
          setIsPaytableOpen(false);
        } else {
          handleClose();
        }
      } else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && !isPaytableOpen) {
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleSpinRef.current();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, isPaytableOpen, handleClose]);

  if (!isOpen) return null;

  const currentBetIdx = Math.max(
    0,
    ARCADE_SLOT_BET_TIERS.indexOf(selectedBet as (typeof ARCADE_SLOT_BET_TIERS)[number]),
  );

  const isWinningOutcome =
    lastResult !== null &&
    (lastResult.outcomeKind === 'jackpot' ||
      lastResult.outcomeKind === 'triple' ||
      lastResult.outcomeKind === 'pair_win');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NEO-STRIKE SLOTS"
      data-cafe-slot-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 overflow-y-auto pointer-events-auto"
    >
      {/* Full-Viewport Golden LUL Coin Particle Burst Canvas */}
      <canvas
        ref={particleCanvasRef}
        className="pointer-events-none fixed inset-0 w-screen h-screen z-[80]"
        aria-hidden="true"
      />

      <div className="w-full max-w-[1120px] mx-auto my-auto cafe-slot-perspective-stage flex flex-col items-center relative text-[#14161d] px-1 sm:px-3">
        {/* =====================================================================
            UPPER 3D BEVELED CAFE CHASSIS & WARM CREAM RECESSED CABINET SCREEN
            ===================================================================== */}
        <div className="w-full cafe-slot-cabinet-outer-3d">
          <div className="w-full cafe-slot-cabinet-screen p-2.5 sm:p-3.5">
            {/* Tactile 3D Red Close Button Pinned to Top-Right Bezel */}
            <button
              type="button"
              data-cafe-slot-close-btn="true"
              onClick={handleClose}
              aria-label="Close Slot Machine"
              className="slot-tactile-btn absolute top-2.5 right-2.5 z-50 w-9 h-9 rounded-xl bg-gradient-to-b from-[#ff554a] to-[#dc2626] border-[2.5px] border-[#14161d] shadow-[0_4px_0_#14161d] flex items-center justify-center text-white hover:brightness-105"
            >
              <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
            </button>

            {/* TOP CHASING 19-BULB WARM ESPRESSO & AMBER JACKPOT MARQUEE */}
            <header className="relative mb-2.5 cafe-slot-marquee-frame rounded-2xl p-2 sm:p-2.5 sm:pr-12">
              <div
                className="flex justify-between items-center px-3 sm:px-6 mb-2"
                aria-hidden="true"
              >
                {Array.from({ length: 19 }).map((_, idx) => (
                  <div key={idx} className="cafe-slot-lamp-3d" />
                ))}
              </div>

              <div className="flex flex-col lg:flex-row items-center justify-between gap-2 px-1 sm:px-2">
                {/* DIAMOND 20X TIER */}
                <div className="flex items-center gap-2 bg-gradient-to-b from-[#451a03] to-[#290f02] border-2 border-[#fbbf24] px-3.5 py-1.5 rounded-xl shadow-[0_3px_0_#1e0a01] w-full lg:w-auto justify-center">
                  <span className="text-xs font-black text-[#fde68a] tracking-wider uppercase whitespace-nowrap">
                    DIAMOND 20X:
                  </span>
                  <span className="font-mono-tabular text-base sm:text-lg font-black text-[#fffbeb] whitespace-nowrap">
                    {selectedBet * 20} LUL
                  </span>
                </div>

                {/* 777 GRAND JACKPOT CENTERPIECE */}
                <div className="text-center px-4 sm:px-6 py-1.5 rounded-2xl border-[2.5px] border-[#fef3c7] bg-gradient-to-b from-[#9a3412] via-[#7c2d12] to-[#3b1806] shadow-[0_4px_0_#240d02,inset_0_2px_3px_rgba(255,251,235,0.35)] flex-1 max-w-xl relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <div className="px-3 py-0.5 bg-[#14161d] rounded-full border-2 border-[#fef3c7] shadow-[0_2px_0_#000] flex items-center gap-1.5 whitespace-nowrap">
                      <span className="px-1.5 py-0.2 bg-[#b8ff3c] text-[#14161d] rounded text-[9px] font-black uppercase">
                        LV {levelProgress.level}
                      </span>
                      <span className="text-[10px] font-black tracking-wider text-white uppercase">
                        NEO-STRIKE SLOTS
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    <Trophy className="w-3.5 h-3.5 text-[#fde047] shrink-0" aria-hidden="true" />
                    <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#fef08a] uppercase whitespace-nowrap">
                      777 JACKPOT PAYS 50X
                    </span>
                    <Trophy className="w-3.5 h-3.5 text-[#fde047] shrink-0" aria-hidden="true" />
                  </div>

                  <svg
                    viewBox="0 0 420 42"
                    className="w-full max-w-[380px] h-8 sm:h-10 mx-auto overflow-visible"
                    role="img"
                    aria-label={`777 Jackpot ${selectedBet * 50} LUL`}
                  >
                    <defs>
                      <linearGradient id={`${jackpotGradId}-cafe-jp`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fffbeb" />
                        <stop offset="45%" stopColor="#fde047" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <text
                      x="212"
                      y="34"
                      textAnchor="middle"
                      className="font-mono-tabular"
                      fontWeight="900"
                      fontSize="31"
                      fill="#240d02"
                    >
                      {selectedBet * 50} LUL
                    </text>
                    <text
                      x="210"
                      y="32"
                      textAnchor="middle"
                      className="font-mono-tabular"
                      fontWeight="900"
                      fontSize="31"
                      fill={`url(#${jackpotGradId}-cafe-jp)`}
                      stroke="#451a03"
                      strokeWidth="0.9"
                    >
                      {selectedBet * 50} LUL
                    </text>
                  </svg>
                </div>

                {/* BLITZ STAR 12X TIER */}
                <div className="flex items-center gap-2 bg-gradient-to-b from-[#1a3a18] to-[#0f240e] border-2 border-[#b8ff3c] px-3.5 py-1.5 rounded-xl shadow-[0_3px_0_#091708] w-full lg:w-auto justify-center">
                  <span className="text-xs font-black text-[#bef264] tracking-wider uppercase whitespace-nowrap">
                    STAR 12X:
                  </span>
                  <span className="font-mono-tabular text-base sm:text-lg font-black text-[#f7fee7] whitespace-nowrap">
                    {selectedBet * 12} LUL
                  </span>
                </div>
              </div>
            </header>

            {/* CENTER INTERACTIVE 3-COLUMN CABINET STAGE */}
            <section className="grid grid-cols-12 gap-2.5 sm:gap-3 items-stretch relative">
              {/* LEFT STATUS & UTILITY PANEL */}
              <aside className="col-span-12 lg:col-span-2 flex lg:flex-col justify-between gap-2 cafe-slot-wood-frame rounded-2xl p-2.5">
                <div className="flex-1 lg:flex-initial text-center bg-gradient-to-b from-[#fffdf7] to-[#fde68a] border-[2.5px] border-[#3b1806] rounded-xl p-2.5 shadow-[0_3px_0_#3b1806] flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-[#78350f] uppercase tracking-wider whitespace-nowrap">
                    {isWinningOutcome && lastResult ? 'Hit Multiplier' : 'Top Jackpot'}
                  </span>
                  <div className="font-mono-tabular text-2xl sm:text-3xl font-black text-[#3b1806] my-0.5 tracking-tight">
                    {isWinningOutcome && lastResult ? `${lastResult.multiplier}X` : '50X'}
                  </div>
                  <span className="text-[9.5px] text-[#4d7c0f] font-black tracking-wider uppercase whitespace-nowrap">
                    Center Payline
                  </span>
                </div>

                <div className="cafe-slot-btn-socket-3d flex-1 lg:flex-initial">
                  <button
                    type="button"
                    onClick={() => {
                      playCabinetClick();
                      setIsPaytableOpen(true);
                    }}
                    className="w-full slot-tactile-btn cafe-slot-btn-cream rounded-xl py-2 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-black text-[#3b1806] uppercase tracking-wider whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#9a3412] shrink-0" aria-hidden="true" />
                    <span>Paytable</span>
                  </button>
                </div>

                <div className="cafe-slot-btn-socket-3d flex-1 lg:flex-initial">
                  <button
                    type="button"
                    data-active={soundEnabled}
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      if (next) soundEngine.playUiClick();
                    }}
                    className="w-full slot-tactile-btn cafe-slot-btn-cream rounded-xl py-2 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider whitespace-nowrap text-[#3b1806]"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{soundEnabled ? 'Sound: On' : 'Sound: Off'}</span>
                  </button>
                </div>

                <div className="hidden lg:flex flex-col items-center justify-center text-[#fef3c7] pt-1.5 border-t border-[#fef3c7]/25 text-center">
                  <Coffee className="w-4 h-4 text-[#fde047]" aria-hidden="true" />
                  <span className="text-[9px] font-black tracking-wider text-[#ffedd5] mt-1 uppercase">
                    Glasshouse Cafe
                  </span>
                </div>
              </aside>

              {/* CENTER 3D CURVED CYLINDRICAL 3x3 CREAM REEL VIEWPORT */}
              <div className="col-span-12 lg:col-span-8 relative rounded-2xl overflow-hidden cafe-slot-reels-viewport h-[324px]">
                <canvas
                  ref={paylineCanvasRef}
                  className="pointer-events-none absolute inset-0 w-full h-full z-30"
                />

                {/* Center Payline Illuminated Guide Bar */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[108px] border-y-[2.5px] border-[#d97706]/80 bg-gradient-to-r from-[#fde68a]/40 via-[#fffbeb]/60 to-[#fde68a]/40 z-10 flex items-center justify-between px-1"
                >
                  <div className="w-0 h-0 border-y-[7px] border-y-transparent border-l-[10px] border-l-[#b45309]" />
                  <div className="w-0 h-0 border-y-[7px] border-y-transparent border-r-[10px] border-r-[#b45309]" />
                </div>

                <div className="grid grid-cols-3 h-[324px] relative divide-x-[3px] divide-[#78350f]/45 z-20">
                  {([0, 1, 2] as const).map((colIdx) => {
                    const colSpinning = spinningCols[colIdx];
                    const tape = reelTapes[colIdx];

                    return (
                      <div
                        key={colIdx}
                        data-slot-reel={colIdx}
                        data-slot-symbol={reels[colIdx]}
                        className={`relative overflow-hidden h-[324px] cafe-slot-reel-drum-3d ${
                          colSpinning ? 'shadow-[inset_0_0_24px_rgba(217,119,6,0.28)]' : ''
                        }`}
                      >
                        <div
                          ref={(el) => {
                            stripDomRefs.current[colIdx] = el;
                          }}
                          className={`will-change-transform absolute top-0 left-0 w-full ${
                            colSpinning ? 'slot-spinning-blur' : ''
                          }`}
                        >
                          {tape.map((symId, rowIdx) => {
                            const isCenterRow = !colSpinning && rowIdx === 1;
                            const isHighlighted =
                              !colSpinning && winningCellKeys.has(`${colIdx}-${rowIdx}`);
                            return (
                              <div
                                key={`${colIdx}-${rowIdx}-${symId}`}
                                className="h-[108px] flex items-center justify-center px-2 sm:px-3 select-none"
                              >
                                <CafeReelSymbolTile
                                  symbolId={symId}
                                  isCenterRow={isCenterRow}
                                  highlighted={isHighlighted}
                                  wonMultiplier={lastResult?.multiplier}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT STATUS & SESSION LEDGER PANEL */}
              <aside className="col-span-12 lg:col-span-2 flex lg:flex-col justify-between gap-2 cafe-slot-wood-frame rounded-2xl p-2.5">
                <div className="flex-1 lg:flex-initial bg-[#2b1003] border-2 border-[#d97706] rounded-xl p-2 shadow-[inset_0_3px_8px_rgba(0,0,0,0.75)]">
                  <h4 className="text-[9.5px] font-black tracking-wider text-[#fde68a] uppercase text-center border-b border-[#78350f] pb-1 mb-1.5">
                    Recent Hits
                  </h4>
                  <div className="text-[10.5px] space-y-1 font-mono-tabular text-[#ffedd5] leading-tight">
                    {recentHits.map((hit, idx) => (
                      <div key={`${hit.player}-${idx}`} className="flex justify-between gap-1">
                        <span
                          className={`truncate ${
                            hit.player === 'YOU' ? 'text-[#b8ff3c] font-black' : 'text-[#fde68a]'
                          }`}
                        >
                          {hit.player}
                        </span>
                        <span className="text-[#bef264] font-black whitespace-nowrap">
                          +{hit.amountLul} LUL
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 lg:flex-initial bg-gradient-to-b from-[#fffdf7] to-[#efe4ce] border-2 border-[#3b1806] rounded-xl p-2 text-[10.5px] font-mono-tabular font-black text-[#451a03] space-y-0.5 shadow-[0_3px_0_#3b1806]">
                  <div className="flex justify-between">
                    <span className="text-[#78350f]">Spins</span>
                    <span>{sessionStats.spins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#78350f]">Best</span>
                    <span>{sessionStats.bestWinLul} LUL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#78350f]">Net</span>
                    <span
                      className={
                        sessionStats.netLul > 0
                          ? 'text-[#15803d]'
                          : sessionStats.netLul < 0
                            ? 'text-[#b91c1c]'
                            : 'text-[#451a03]'
                      }
                    >
                      {sessionStats.netLul >= 0 ? `+${sessionStats.netLul}` : sessionStats.netLul}{' '}
                      LUL
                    </span>
                  </div>
                </div>

                <div
                  data-slot-outcome-banner="true"
                  className={`flex-1 lg:flex-initial rounded-xl border-2 px-2 py-2 text-center text-[10.5px] font-black uppercase tracking-wide flex items-center justify-center gap-1 leading-tight ${
                    isSpinning
                      ? 'bg-[#3b1806] border-[#fbbf24] text-[#fef08a]'
                      : isWinningOutcome
                        ? 'bg-gradient-to-b from-[#d9f99d] to-[#84cc16] border-[#14532d] text-[#14161d] shadow-[0_2px_0_#14532d]'
                        : lastResult?.outcomeKind === 'push'
                          ? 'bg-gradient-to-b from-[#fef08a] to-[#f59e0b] border-[#3b1806] text-[#14161d]'
                          : 'bg-[#2b1003] border-[#d97706] text-[#ffedd5]'
                  }`}
                >
                  {isWinningOutcome && !isSpinning && (
                    <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{statusMessage}</span>
                </div>
              </aside>
            </section>

            {/* DIGITAL WARM ESPRESSO READOUTS: LUL BALANCE & WIN */}
            <section className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div
                data-slot-lul-balance="true"
                className="flex items-center justify-between gap-2 px-4 py-2 cafe-slot-led-box rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#fec83e] shrink-0" aria-hidden="true" />
                  <span className="text-xs sm:text-sm font-black text-[#fde68a] tracking-wider uppercase whitespace-nowrap">
                    CREDITS:
                  </span>
                  {lulBalance < ARCADE_SLOT_MIN_BET_LUL && !isSpinning && (
                    <span className="hidden sm:inline text-[10.5px] font-bold text-[#fca5a5] truncate">
                      Min {ARCADE_SLOT_MIN_BET_LUL} LUL · Work shift or use Cafe ATM
                    </span>
                  )}
                </div>
                <span className="font-mono-tabular text-xl sm:text-2xl font-black text-[#fec83e] tracking-wide whitespace-nowrap">
                  {lulBalance} LUL
                </span>
              </div>

              <div className="flex items-center justify-between px-4 py-2 cafe-slot-led-box rounded-xl">
                <span className="text-xs sm:text-sm font-black text-[#bef264] tracking-wider uppercase whitespace-nowrap">
                  WIN:
                </span>
                <span className="font-mono-tabular text-xl sm:text-2xl font-black text-[#b8ff3c] tracking-wide whitespace-nowrap">
                  {lastWinLul} LUL
                </span>
              </div>
            </section>

            {errorMsg && (
              <div className="mt-2 px-3 py-1.5 rounded-xl bg-[#fee2e2] border-2 border-[#7f1d1d] text-xs font-black text-[#991b1b] text-center">
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* =====================================================================
            3D MECHANICAL RECESSED HINGE SEAM
            ===================================================================== */}
        <div className="cafe-slot-hinge-neck-3d" aria-hidden="true" />

        {/* =====================================================================
            LOWER 3D FORWARD-JUTTING WARM CREAM CONSOLE DECK + FRONT BUMPER LIP
            ===================================================================== */}
        <div className="w-[99%] sm:w-[102%] flex flex-col items-center">
          <footer className="w-full cafe-slot-tactile-console-3d px-3 py-3 sm:px-5 sm:py-3.5">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 sm:gap-3">
              {/* Left Auxiliary Controls in Recessed 3D Sockets: TURBO & AUTO SPIN */}
              <div className="flex items-center gap-2">
                <div className="cafe-slot-btn-socket-3d">
                  <button
                    type="button"
                    data-active={isTurbo}
                    onClick={() => {
                      playCabinetClick();
                      setIsTurbo((prev) => !prev);
                    }}
                    className="slot-tactile-btn cafe-slot-btn-cream px-3 py-2.5 rounded-xl text-xs font-black text-[#3b1806] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FastForward className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Turbo</span>
                  </button>
                </div>

                <div className="cafe-slot-btn-socket-3d">
                  <button
                    type="button"
                    data-active={isAutoSpin}
                    onClick={() => {
                      playCabinetClick();
                      const next = !isAutoSpin;
                      setIsAutoSpin(next);
                      if (next && !isSpinning) {
                        handleSpin();
                      }
                    }}
                    className="slot-tactile-btn cafe-slot-btn-amber px-3 py-2.5 rounded-xl text-xs font-black text-[#3b1806] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCw
                      className={`w-3.5 h-3.5 shrink-0 ${isAutoSpin ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isAutoSpin ? 'Stop Auto' : 'Auto Spin'}</span>
                  </button>
                </div>
              </div>

              {/* Center Recessed Stake Rocker + Direct Tier Buttons (2 / 5 / 10 / 25 LUL) */}
              <div className="flex items-center bg-[#3b1806] border-[2.5px] border-[#d97706] rounded-2xl p-1.5 shadow-[inset_0_3px_8px_rgba(0,0,0,0.75)] gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={isSpinning || currentBetIdx <= 0}
                  onClick={() => {
                    playCabinetClick();
                    const nextTier = ARCADE_SLOT_BET_TIERS[Math.max(0, currentBetIdx - 1)] ?? 2;
                    setSelectedBet(nextTier);
                    setErrorMsg(null);
                  }}
                  aria-label="Decrease Stake"
                  className="slot-tactile-btn w-8 h-9 rounded-lg cafe-slot-btn-cream text-[#3b1806] flex items-center justify-center disabled:opacity-45"
                >
                  <Minus className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                </button>

                <div className="flex items-center gap-1">
                  {ARCADE_SLOT_BET_TIERS.map((tier) => {
                    const active = selectedBet === tier;
                    const affordable = lulBalance >= tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        disabled={isSpinning}
                        data-slot-bet-btn={tier}
                        onClick={() => {
                          playCabinetClick();
                          setSelectedBet(tier);
                          setErrorMsg(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg border-2 font-mono-tabular font-black text-center cursor-pointer transition-transform duration-100 active:translate-y-0.5 whitespace-nowrap ${
                          active
                            ? 'bg-gradient-to-b from-[#fde047] via-[#f59e0b] to-[#c2410c] border-[#fffbeb] text-white shadow-[0_2px_0_#1e0a01]'
                            : affordable
                              ? 'bg-[#fffdf7] hover:bg-[#fef3c7] border-[#9a3412] text-[#3b1806]'
                              : 'bg-[#573614] border-[#78350f] text-[#cbb894]'
                        }`}
                      >
                        <div className="text-xs font-black leading-tight">{tier}</div>
                        <div className="text-[8.5px] font-black uppercase leading-none opacity-90">
                          LUL
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={isSpinning || currentBetIdx >= ARCADE_SLOT_BET_TIERS.length - 1}
                  onClick={() => {
                    playCabinetClick();
                    const nextTier =
                      ARCADE_SLOT_BET_TIERS[
                        Math.min(ARCADE_SLOT_BET_TIERS.length - 1, currentBetIdx + 1)
                      ] ?? 25;
                    setSelectedBet(nextTier);
                    setErrorMsg(null);
                  }}
                  aria-label="Increase Stake"
                  className="slot-tactile-btn w-8 h-9 rounded-lg cafe-slot-btn-cream text-[#3b1806] flex items-center justify-center disabled:opacity-45"
                >
                  <Plus className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                </button>
              </div>

              {/* Max Bet Button in Recessed 3D Socket */}
              <div className="cafe-slot-btn-socket-3d">
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={() => {
                    playCabinetClick();
                    let bestTier: number = ARCADE_SLOT_BET_TIERS[0];
                    for (const tier of ARCADE_SLOT_BET_TIERS) {
                      if (lulBalance >= tier) bestTier = tier;
                    }
                    setSelectedBet(bestTier);
                    setErrorMsg(null);
                  }}
                  className="slot-tactile-btn cafe-slot-btn-amber px-3 py-2.5 rounded-xl text-xs font-black text-[#3b1806] uppercase tracking-wider whitespace-nowrap disabled:opacity-50"
                >
                  Max Bet
                </button>
              </div>

              {/* Giant 3D Extruded Botanical Lime-Green Dome SPIN Button */}
              <div className="cafe-slot-btn-socket-3d flex-1 lg:flex-initial ml-auto">
                <button
                  type="button"
                  disabled={isSpinning || lulBalance < ARCADE_SLOT_MIN_BET_LUL}
                  data-slot-spin-btn="true"
                  onClick={handleSpin}
                  className="w-full slot-tactile-btn cafe-slot-btn-spin-lime min-w-[175px] sm:min-w-[215px] h-13 sm:h-14 rounded-xl px-4 flex items-center justify-center gap-2 text-[#14161d] font-black text-base sm:text-lg uppercase tracking-wider whitespace-nowrap"
                >
                  <span className="font-mono-tabular">
                    {isSpinning ? 'SPINNING...' : `SPIN (${selectedBet} LUL)`}
                  </span>
                  <Play
                    className="w-4 h-4 text-[#14161d] fill-[#14161d] shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </footer>

          {/* Physical 3D Extruded Front Espresso & Charcoal Bumper Lip with Warm Gold-Lime Vent */}
          <div className="w-full cafe-slot-console-front-lip-3d">
            <div className="cafe-slot-console-vent" />
          </div>

          {/* Grounded 3D Floor Shadow Beneath the Cabinet */}
          <div className="cafe-slot-floor-shadow-3d" aria-hidden="true" />
        </div>

        {/* =====================================================================
            WARM CREAM & ESPRESSO PAYTABLE OVERLAY MODAL
            ===================================================================== */}
        {isPaytableOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Neo-Strike Slots Paytable"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
            onClick={() => setIsPaytableOpen(false)}
          >
            <div
              className="w-full max-w-xl bg-gradient-to-b from-[#fffdf7] via-[#fdf6e7] to-[#f5ead4] border-[3px] border-[#14161d] ring-3 ring-[#d97706] rounded-3xl overflow-hidden shadow-[0_18px_45px_rgba(0,0,0,0.85)] text-[#14161d]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#1e212b] border-b-[3px] border-[#14161d] text-white">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-5 h-5 text-[#fec83e]" aria-hidden="true" />
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wider">
                    Neo-Strike Slots · Paytable
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaytableOpen(false)}
                  aria-label="Close Paytable"
                  className="w-8 h-8 rounded-lg bg-[#ff3b30] hover:bg-[#ff554a] border-2 border-black text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ARCADE_SLOT_SYMBOLS.map((spec) => {
                    const isJackpot = spec.id === 'seven';
                    return (
                      <div
                        key={spec.id}
                        className={`rounded-2xl border-2 p-3 flex flex-col items-center text-center ${
                          isJackpot
                            ? 'bg-gradient-to-b from-[#fffbeb] to-[#fde68a] border-[#b45309] shadow-[0_3px_0_#78350f]'
                            : 'bg-[#fffdf7] border-[#cbb894] shadow-[0_3px_0_#a89068]'
                        }`}
                      >
                        <SlotSymbolArtwork id={spec.id} sizeClass="w-11 h-11" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#3b1806] mt-1">
                          {spec.label}
                        </span>
                        <span className="font-mono-tabular text-xs font-black text-[#9a3412] mt-1">
                          3x Center = {spec.tripleMultiplier}x
                        </span>
                        <span className="font-mono-tabular text-[11px] font-bold text-[#573614]">
                          2x Any Pair = {spec.pairMultiplier}x
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-[#efe4ce] border-2 border-[#cbb894] rounded-2xl p-3.5 text-xs leading-relaxed text-[#451a03] space-y-1">
                  <p>
                    <strong className="font-black text-[#3b1806]">Center Payline:</strong> Match 3
                    identical symbols across the illuminated middle row for up to{' '}
                    <span className="font-mono-tabular font-black text-[#9a3412]">50x</span> your
                    LUL stake, or any 2 matching symbols on the center line for a pair payout.
                  </p>
                  <p>
                    <strong className="font-black text-[#3b1806]">XP Rewards:</strong> Every spin
                    awards Cafe progression XP (<span className="font-mono-tabular">+2 XP</span>{' '}
                    base, <span className="font-mono-tabular">+5 XP</span> pair,{' '}
                    <span className="font-mono-tabular">+10 XP</span> triple,{' '}
                    <span className="font-mono-tabular">+25 XP</span> 777 Jackpot).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
