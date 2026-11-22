import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, Crown, Gem, Play, Plus, Minus, RotateCw, Volume2, VolumeX, X, Zap, FastForward } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  ARCADE_SLOT_SYMBOLS,
  type ArcadeSlotEvaluation,
  type ArcadeSlotSymbolId,
  spinArcadeSlotReels,
} from '../game/buddiesArcadeSlots';
import {
  FORTUNE_WHEEL_SECTORS,
  LUCKY_DRAW_TILES,
  type LuckyDrawSpinEvaluation,
  spinEmeraldFortuneWheel,
  spinLuckyDrawTile,
} from '../game/buddiesGrandCasinoGames';
import {
  CASINO_SLOT_VARIANT_META,
  type CasinoSlotGameVariant,
} from '../game/buddiesGrandCasinoRules';

export type CasinoSlotSvgKey =
  | 'seven'
  | 'diamond'
  | 'star'
  | 'bell'
  | 'coffee'
  | 'cherry'
  | 'mystery'
  | 'vault';

export type RoyaleSymbolId =
  | 'CROWN'
  | 'DIAMOND'
  | 'SEVEN'
  | 'RUBY'
  | 'HORSESHOE'
  | 'GOLDBAG'
  | 'ACE'
  | 'KING'
  | 'QUEEN'
  | 'JACK'
  | 'WILD'
  | 'SCATTER';

interface RoyaleSymbolSpec {
  id: RoyaleSymbolId;
  name: string;
  payout3x: number; // Base multiplier relative to total bet before 3X VIP Boost
  weight: number;
  beamHex: string;
  isWild?: boolean;
  isScatter?: boolean;
}

const ROYALE_SYMBOLS: ReadonlyArray<RoyaleSymbolSpec> = [
  { id: 'CROWN', name: 'CROWN', payout3x: 15, weight: 2, beamHex: '#facc15' },
  { id: 'DIAMOND', name: 'DIAMOND', payout3x: 10, weight: 3, beamHex: '#00f0ff' },
  { id: 'SEVEN', name: 'LUCKY 7', payout3x: 8, weight: 4, beamHex: '#fbbf24' },
  { id: 'RUBY', name: 'RUBY', payout3x: 6, weight: 5, beamHex: '#f43f5e' },
  { id: 'HORSESHOE', name: 'HORSESHOE', payout3x: 5, weight: 6, beamHex: '#fde047' },
  { id: 'GOLDBAG', name: 'GOLD BAG', payout3x: 4, weight: 7, beamHex: '#eab308' },
  { id: 'ACE', name: 'ACE', payout3x: 2.5, weight: 9, beamHex: '#f472b6' },
  { id: 'KING', name: 'KING', payout3x: 2, weight: 10, beamHex: '#fbbf24' },
  { id: 'QUEEN', name: 'QUEEN', payout3x: 1.5, weight: 11, beamHex: '#a3e635' },
  { id: 'JACK', name: 'JACK', payout3x: 1, weight: 12, beamHex: '#38bdf8' },
  { id: 'WILD', name: 'ROYAL WILD', payout3x: 20, weight: 3, beamHex: '#ffe600', isWild: true },
  { id: 'SCATTER', name: 'SCATTER', payout3x: 5, weight: 3, beamHex: '#e879f9', isScatter: true },
];

const ROYALE_SYMBOL_MAP: Record<RoyaleSymbolId, RoyaleSymbolSpec> = ROYALE_SYMBOLS.reduce(
  (acc, sym) => {
    acc[sym.id] = sym;
    return acc;
  },
  {} as Record<RoyaleSymbolId, RoyaleSymbolSpec>,
);

const ROYALE_WEIGHTED_POOL: ReadonlyArray<RoyaleSymbolId> = ROYALE_SYMBOLS.flatMap((s) =>
  Array.from({ length: s.weight }, () => s.id),
);

// 12 classic 3-reel x 4-row payline trajectories (horizontals, diagonals, V-shapes)
const ROYALE_3X4_PAYLINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [1, 1, 1],
  [2, 2, 2],
  [3, 3, 3],
  [0, 1, 2],
  [2, 1, 0],
  [1, 2, 3],
  [3, 2, 1],
  [1, 0, 1],
  [2, 3, 2],
  [0, 1, 0],
  [3, 2, 3],
];

export const RESPITE_SLOT_BET_TIERS = [1, 2, 5, 10, 25, 50, 100, 250] as const;

interface WinningBeamLine {
  coords: Array<{ col: number; row: number }>;
  colorHex: string;
}

interface RecentWinnerEntry {
  initials: string;
  amountRespite: number;
}

const INITIAL_RECENT_WINNERS: RecentWinnerEntry[] = [
  { initials: 'D.K.', amountRespite: 846 },
  { initials: 'B.E.', amountRespite: 320 },
  { initials: 'M.W.', amountRespite: 135 },
  { initials: 'V.T.', amountRespite: 445 },
];

function pickRandomRoyaleSymbol(): RoyaleSymbolId {
  return ROYALE_WEIGHTED_POOL[Math.floor(Math.random() * ROYALE_WEIGHTED_POOL.length)] ?? 'ACE';
}

function formatRespiteReadout(val: number): string {
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const CasinoSlotSymbolArtwork: React.FC<{
  id: CasinoSlotSvgKey;
  sizeClass?: string;
}> = ({ id, sizeClass = 'w-10 h-10' }) => {
  const uid = useId();
  switch (id) {
    case 'seven':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-s7`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b6b" />
              <stop offset="50%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
          <path
            d="M16 12h32v10L29 54h-11L35 22H16z"
            fill={`url(#${uid}-s7)`}
            stroke="#fde047"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-dm`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <polygon
            points="18,12 46,12 56,26 32,54 8,26"
            fill={`url(#${uid}-dm)`}
            stroke="#ecfeff"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <polygon points="22,12 42,12 45,26 19,26" fill="#ffffff" opacity="0.6" />
          <line x1="8" y1="26" x2="56" y2="26" stroke="#ecfeff" strokeWidth="1.8" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <polygon
            points="32,8 39.5,23 56,25.5 44,37 46.8,53.5 32,45.5 17.2,53.5 20,37 8,25.5 24.5,23"
            fill="#facc15"
            stroke="#fef9c3"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <circle cx="32" cy="12" r="4.5" fill="#fbbf24" />
          <path d="M26 46a6 6 0 0 0 12 0z" fill="#d97706" />
          <path
            d="M18 32c0-10 6-17 14-17s14 7 14 17l5 13H13z"
            fill="#facc15"
            stroke="#fef08a"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'coffee':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <ellipse cx="30" cy="50" rx="18" ry="4.5" fill="#fde68a" />
          <path
            d="M42 28h5c4 0 6 2.5 6 6s-2 6-6 6h-5"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M15 24h28v13c0 7.5-6 12-14 12s-14-4.5-14-12z"
            fill="#f59e0b"
            stroke="#fef3c7"
            strokeWidth="2.4"
          />
        </svg>
      );
    case 'cherry':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <path
            d="M23 36 C25 22, 33 15, 36 10 C38 17, 43 24, 42 38"
            fill="none"
            stroke="#4ade80"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="22" cy="43" r="10" fill="#ef4444" stroke="#fecaca" strokeWidth="2" />
          <circle cx="42" cy="44" r="10" fill="#e11d48" stroke="#fecdd3" strokeWidth="2" />
        </svg>
      );
    case 'mystery':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <rect x="10" y="16" width="44" height="38" rx="8" fill="#a21caf" stroke="#f0abfc" strokeWidth="2.5" />
          <rect x="8" y="12" width="48" height="11" rx="4" fill="#d946ef" stroke="#fae8ff" strokeWidth="2" />
          <rect x="28" y="12" width="8" height="42" fill="#facc15" />
          <text x="32" y="43" textAnchor="middle" fontWeight="900" fontSize="19" fill="#ffffff">
            ?
          </text>
        </svg>
      );
    case 'vault':
      return (
        <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
          <rect x="9" y="11" width="46" height="42" rx="9" fill="#581c87" stroke="#e879f9" strokeWidth="2.6" />
          <rect x="15" y="17" width="34" height="30" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="32" cy="32" r="9.5" fill="#facc15" stroke="#fef9c3" strokeWidth="2" />
          <circle cx="32" cy="32" r="3.5" fill="#06b6d4" />
        </svg>
      );
  }
};

/**
 * High-detail metallic & neon vector symbols matching the 3D Grand Royale reference screenshot
 * (including wide glowing plaques for ROYAL WILD and SCATTER).
 */
const GrandRoyaleSymbolTile: React.FC<{
  symbolId: RoyaleSymbolId;
  highlighted?: boolean;
  compact?: boolean;
}> = ({ symbolId, highlighted = false, compact = false }) => {
  const uid = useId();
  const wrapCls = highlighted ? 'slot-symbol-win-highlight' : '';

  if (symbolId === 'WILD') {
    return (
      <div
        className={`relative w-[92%] max-w-[244px] mx-auto rounded-xl px-3 py-1.5 bg-gradient-to-b from-[#5c3d08] via-[#2b1d07] to-[#170f03] border-2 border-cyan-300 shadow-[0_6px_14px_rgba(0,0,0,0.8),0_0_24px_rgba(250,204,21,0.55),inset_0_2px_3px_rgba(255,255,255,0.45)] flex flex-col items-center justify-center ${wrapCls}`}
      >
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 110 34" className={compact ? 'w-16 h-5' : 'w-24 h-7'} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-wgold`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#fde047" />
                <stop offset="75%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#854d0e" />
              </linearGradient>
            </defs>
            <path d="M8 22 C16 8, 28 8, 36 16 C26 19, 18 22, 8 22 Z" fill={`url(#${uid}-wgold)`} />
            <path d="M102 22 C94 8, 82 8, 74 16 C84 19, 92 22, 102 22 Z" fill={`url(#${uid}-wgold)`} />
            <path d="M16 27 C23 20, 31 19, 39 22 C30 25, 22 27, 16 27 Z" fill="#facc15" />
            <path d="M94 27 C87 20, 79 19, 71 22 C80 25, 88 27, 94 27 Z" fill="#facc15" />
            <path
              d="M35 23 L48 11 L55 4 L62 11 L75 23 L61 19 L55 28 L49 19 Z"
              fill={`url(#${uid}-wgold)`}
              stroke="#fef9c3"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-200 font-cinzel leading-none mt-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
          ROYAL WILD
        </span>
      </div>
    );
  }

  if (symbolId === 'SCATTER') {
    return (
      <div
        className={`relative w-[92%] max-w-[244px] mx-auto rounded-xl px-3 py-1.5 bg-gradient-to-b from-[#4a1675] via-[#260a42] to-[#120422] border-2 border-fuchsia-300 shadow-[0_6px_14px_rgba(0,0,0,0.8),0_0_24px_rgba(217,70,239,0.6),inset_0_2px_3px_rgba(255,255,255,0.4)] flex flex-col items-center justify-center ${wrapCls}`}
      >
        <svg viewBox="0 0 88 32" className={compact ? 'w-14 h-5' : 'w-20 h-7'} aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-seagle`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fae8ff" />
              <stop offset="45%" stopColor="#e879f9" />
              <stop offset="100%" stopColor="#9333ea" />
            </linearGradient>
          </defs>
          <path
            d="M8 9 C22 8, 33 13, 44 20 C55 13, 66 8, 80 9 C70 18, 59 23, 44 28 C29 23, 18 18, 8 9 Z"
            fill={`url(#${uid}-seagle)`}
            stroke="#fdf4ff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="44" cy="11" r="3.6" fill="#fde047" />
        </svg>
        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200 font-cinzel leading-none mt-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
          SCATTER
        </span>
      </div>
    );
  }

  const iconSize = compact ? 'w-9 h-9' : 'w-14 h-14';
  const auraCls = compact
    ? 'hidden'
    : 'pointer-events-none absolute w-20 h-16 rounded-full blur-md opacity-70 -z-0';

  switch (symbolId) {
    case 'SEVEN':
      return (
        <div className={`relative flex flex-col items-center justify-center ${wrapCls}`}>
          <div className={`${auraCls} bg-amber-500/30`} aria-hidden="true" />
          <svg viewBox="0 0 64 54" className={`relative z-10 ${iconSize} drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]`} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-r7`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff9494" />
                <stop offset="42%" stopColor="#ef4444" />
                <stop offset="82%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#450a0a" />
              </linearGradient>
              <linearGradient id={`${uid}-r7bevel`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#a16207" />
              </linearGradient>
            </defs>
            {/* 3D Extruded Back Depth */}
            <path
              d="M14 9h38v11L31 49H19L36 20H14z"
              fill="#422006"
              transform="translate(2, 3)"
            />
            <path
              d="M14 7h38v11L31 47H19L36 18H14z"
              fill={`url(#${uid}-r7)`}
              stroke={`url(#${uid}-r7bevel)`}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            <path d="M17 10h31l-2 3H17z" fill="#ffffff" opacity="0.55" />
          </svg>
          <span className="relative z-10 text-[9.5px] font-extrabold uppercase text-amber-200 font-cinzel tracking-wider -mt-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            LUCKY 7
          </span>
        </div>
      );
    case 'GOLDBAG':
      return (
        <div className={`relative flex flex-col items-center justify-center ${wrapCls}`}>
          <div className={`${auraCls} bg-yellow-500/30`} aria-hidden="true" />
          <svg viewBox="0 0 64 54" className={`relative z-10 ${iconSize} drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]`} aria-hidden="true">
            <defs>
              <radialGradient id={`${uid}-gb`} cx="36%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="22%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#713f12" />
              </radialGradient>
            </defs>
            <ellipse cx="32" cy="46" rx="16" ry="4" fill="rgba(0,0,0,0.55)" />
            <path
              d="M23 9 L41 9 L36 17 L28 17 Z"
              fill="#facc15"
              stroke="#fef9c3"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M25 16 C14 21, 11 33, 15 43 C18 47, 46 47, 49 43 C53 33, 50 21, 39 16 Z"
              fill={`url(#${uid}-gb)`}
              stroke="#fde047"
              strokeWidth="2.4"
            />
            <rect x="24" y="15" width="16" height="3.5" rx="1.5" fill="#b91c1c" stroke="#fef08a" strokeWidth="1" />
            <text x="32" y="37" textAnchor="middle" fontWeight="900" fontSize="17" fill="#422006">
              R
            </text>
          </svg>
          <span className="relative z-10 text-[9.5px] font-extrabold uppercase text-amber-200 font-cinzel tracking-wider -mt-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            GOLD BAG
          </span>
        </div>
      );
    case 'HORSESHOE':
      return (
        <div className={`relative flex flex-col items-center justify-center ${wrapCls}`}>
          <div className={`${auraCls} bg-amber-400/35`} aria-hidden="true" />
          <svg viewBox="0 0 64 54" className={`relative z-10 ${iconSize} drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]`} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-hs`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7b7b" />
                <stop offset="48%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>
            </defs>
            <path
              d="M15 43 V24 C15 10, 49 10, 49 24 V43 H39 V24 C39 17, 25 17, 25 24 V43 Z"
              fill="#450a0a"
              transform="translate(1.5, 2.5)"
            />
            <path
              d="M15 43 V24 C15 10, 49 10, 49 24 V43 H39 V24 C39 17, 25 17, 25 24 V43 Z"
              fill={`url(#${uid}-hs)`}
              stroke="#fde047"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            <rect x="13.5" y="36" width="12.5" height="8" rx="2" fill="#facc15" stroke="#fef9c3" strokeWidth="1.5" />
            <rect x="38" y="36" width="12.5" height="8" rx="2" fill="#facc15" stroke="#fef9c3" strokeWidth="1.5" />
          </svg>
          <span className="relative z-10 text-[9.5px] font-extrabold uppercase text-yellow-200 font-cinzel tracking-wider -mt-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            HORSESHOE
          </span>
        </div>
      );
    case 'CROWN':
      return (
        <div className={`relative flex flex-col items-center justify-center ${wrapCls}`}>
          <div className={`${auraCls} bg-yellow-400/35`} aria-hidden="true" />
          <svg viewBox="0 0 64 52" className={`relative z-10 ${iconSize} drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]`} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-crn`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="28%" stopColor="#fef08a" />
                <stop offset="68%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#854d0e" />
              </linearGradient>
            </defs>
            <path
              d="M9 38 L14 15 L25 26 L32 9 L39 26 L50 15 L55 38 Z"
              fill="#422006"
              transform="translate(1.5, 2.5)"
            />
            <path
              d="M9 38 L14 15 L25 26 L32 9 L39 26 L50 15 L55 38 Z"
              fill={`url(#${uid}-crn)`}
              stroke="#fef9c3"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <rect x="10" y="38" width="44" height="6.5" rx="2.5" fill="#ca8a04" stroke="#fef08a" strokeWidth="1.8" />
            <circle cx="32" cy="29" r="3.8" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.2" />
            <circle cx="20" cy="31" r="2.8" fill="#00f0ff" stroke="#ffffff" strokeWidth="1" />
            <circle cx="44" cy="31" r="2.8" fill="#00f0ff" stroke="#ffffff" strokeWidth="1" />
            <circle cx="14" cy="14" r="2.6" fill="#fef08a" />
            <circle cx="32" cy="8" r="3" fill="#ffffff" />
            <circle cx="50" cy="14" r="2.6" fill="#fef08a" />
          </svg>
          <span className="relative z-10 text-[9.5px] font-extrabold uppercase text-yellow-200 font-cinzel tracking-wider -mt-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            CROWN
          </span>
        </div>
      );
    case 'DIAMOND':
      return (
        <div className={`relative flex flex-col items-center justify-center ${wrapCls}`}>
          <div className={`${auraCls} bg-cyan-400/35`} aria-hidden="true" />
          <div className="relative z-10 drop-shadow-[0_4px_10px_rgba(6,182,212,0.55)]">
            <CasinoSlotSymbolArtwork id="diamond" sizeClass={iconSize} />
          </div>
          <span className="relative z-10 text-[9.5px] font-extrabold uppercase text-cyan-200 font-cinzel tracking-wider -mt-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            DIAMOND
          </span>
        </div>
      );
    case 'RUBY':
      return (
        <div className={`relative flex flex-col items-center justify-center ${wrapCls}`}>
          <div className={`${auraCls} bg-rose-500/35`} aria-hidden="true" />
          <svg viewBox="0 0 64 54" className={`relative z-10 ${iconSize} drop-shadow-[0_4px_10px_rgba(244,63,94,0.55)]`} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-rby`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="45%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>
            </defs>
            <polygon
              points="32,5 52,26 32,47 12,26"
              fill={`url(#${uid}-rby)`}
              stroke="#ffe4e6"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <polygon points="32,12 44,26 32,40 20,26" fill="#fb7185" opacity="0.78" />
            <polygon points="32,10 40,26 32,26 24,26" fill="#ffffff" opacity="0.72" />
          </svg>
          <span className="relative z-10 text-[9.5px] font-extrabold uppercase text-rose-200 font-cinzel tracking-wider -mt-1 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            RUBY
          </span>
        </div>
      );
    case 'ACE':
    case 'KING':
    case 'QUEEN':
    case 'JACK': {
      const letter = symbolId[0];
      const auraTone =
        symbolId === 'ACE'
          ? 'bg-amber-400/30'
          : symbolId === 'KING'
            ? 'bg-yellow-500/25'
            : symbolId === 'QUEEN'
              ? 'bg-lime-400/25'
              : 'bg-sky-400/25';
      const gradStops =
        symbolId === 'ACE'
          ? ['#ffffff', '#fde047', '#d97706']
          : symbolId === 'KING'
            ? ['#fef9c3', '#facc15', '#b45309']
            : symbolId === 'QUEEN'
              ? ['#ecfccb', '#a3e635', '#3f6212']
              : ['#e0f2fe', '#38bdf8', '#0369a1'];
      return (
        <div className={`relative flex flex-col items-center justify-center ${wrapCls}`}>
          <div className={`${auraCls} ${auraTone}`} aria-hidden="true" />
          <svg
            viewBox="0 0 56 46"
            className={`relative z-10 ${compact ? 'w-9 h-8' : 'w-13 h-11'} drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${uid}-ltr`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradStops[0]} />
                <stop offset="48%" stopColor={gradStops[1]} />
                <stop offset="100%" stopColor={gradStops[2]} />
              </linearGradient>
            </defs>
            <text
              x="29.5"
              y="38.5"
              textAnchor="middle"
              className="font-playfair"
              fontWeight="900"
              fontSize="38"
              fill="#1e1b18"
            >
              {letter}
            </text>
            <text
              x="28"
              y="36.5"
              textAnchor="middle"
              className="font-playfair"
              fontWeight="900"
              fontSize="38"
              fill={`url(#${uid}-ltr)`}
              stroke="#fef08a"
              strokeWidth="1.2"
            >
              {letter}
            </text>
          </svg>
          <span className="relative z-10 text-[9.5px] font-extrabold uppercase text-slate-200 font-cinzel tracking-wider -mt-0.5 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            {symbolId}
          </span>
        </div>
      );
    }
  }
};

export interface CasinoSlotMachinesPanelProps {
  variant: CasinoSlotGameVariant;
  isActive: boolean;
  respiteBalance: number;
  lulBalance?: number;
  onClose?: () => void;
  onDebitRespite: (stakeRespite: number) => { ok: boolean; message: string };
  onSettleRespite: (
    payoutRespite: number,
    xpGained: number,
    announceHeadline?: string,
  ) => void;
  onQuickTopUpRespite?: () => void;
  onSettleClassicEvaluation?: (evaluation: ArcadeSlotEvaluation) => void;
}

export const CasinoSlotMachinesPanel: React.FC<CasinoSlotMachinesPanelProps> = ({
  variant,
  isActive,
  respiteBalance,
  lulBalance = 0,
  onClose,
  onDebitRespite,
  onSettleRespite,
  onQuickTopUpRespite,
}) => {
  const jackpotGradId = useId();
  const variantMeta = CASINO_SLOT_VARIANT_META[variant];
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const rafIdsRef = useRef<number[]>([]);
  const pendingSettlementRef = useRef<(() => void) | null>(null);

  // Cabinet controls & HUD states (default to 1 RESPITE when low balance, 5 RESPITE otherwise)
  const [betIndex, setBetIndex] = useState<number>(() => (respiteBalance >= 5 ? 2 : 0));
  const [lastWinRespite, setLastWinRespite] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [isTurbo, setIsTurbo] = useState<boolean>(false);
  const [isAutoSpin, setIsAutoSpin] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(!soundEngine.muted);
  const [isPaytableOpen, setIsPaytableOpen] = useState<boolean>(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('READY · SPIN TO WIN!');
  const [recentWinners, setRecentWinners] = useState<RecentWinnerEntry[]>(INITIAL_RECENT_WINNERS);

  // Progressive Jackpot Display Tickers (scaled cleanly in RESPITE)
  const [jackpots, setJackpots] = useState({
    grand: 125091.48,
    major: 4522.39,
    mini: 185.95,
  });

  // VIP Active Boost Multiplier (3X base, surges to 5X during Free Spins!)
  const activeMultiplier = freeSpinsLeft > 0 ? 5 : 3;
  const currentBet = RESPITE_SLOT_BET_TIERS[betIndex] ?? 5;

  // Refs for auto-spin & canvas overlays
  const isAutoSpinRef = useRef(false);
  isAutoSpinRef.current = isAutoSpin;
  const isTurboRef = useRef(false);
  isTurboRef.current = isTurbo;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

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

  // ---------------------------------------------------------------------------
  // Audio Helpers (Respecting local cabinet SOUND: ON/OFF toggle)
  // ---------------------------------------------------------------------------
  const playCabinetClick = useCallback(() => {
    if (soundEnabledRef.current) soundEngine.playUiClick();
  }, []);

  const playCabinetTick = useCallback((step = 0) => {
    if (soundEnabledRef.current) soundEngine.playSlotReelTick(step);
  }, []);

  const playCabinetReelLock = useCallback((colIdx: number, excited = false) => {
    if (soundEnabledRef.current) soundEngine.playSlotReelLock(colIdx, excited);
  }, []);

  const playCabinetWin = useCallback((isBigJackpot: boolean) => {
    if (soundEnabledRef.current) soundEngine.playCasinoJackpotFanfare(isBigJackpot);
  }, []);

  // ---------------------------------------------------------------------------
  // 2D Coin & Gem Particle Burst Engine
  // ---------------------------------------------------------------------------
  const triggerCoinParticleBurst = useCallback((count = 42) => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.44;
    const palette = ['#ffd700', '#f59e0b', '#00f0ff', '#e879f9', '#4ade80'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8.5 + 3.5;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5.2,
        size: Math.random() * 9 + 6,
        color: palette[i % palette.length] ?? '#ffd700',
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
        p.alpha -= 0.014;

        if (p.alpha <= 0 || p.y > c.height + 20) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.72, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('R', 0, 0.5);
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

  const clearAllAnimations = useCallback(() => {
    for (const tid of timersRef.current) {
      window.clearTimeout(tid);
      window.clearInterval(tid);
    }
    timersRef.current = [];
    for (const rid of rafIdsRef.current) {
      window.cancelAnimationFrame(rid);
    }
    rafIdsRef.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const ticker = window.setInterval(() => {
      setJackpots((prev) => ({
        grand: prev.grand + 0.14,
        major: prev.major + 0.04,
        mini: prev.mini + 0.01,
      }));
    }, 1150);

    return () => {
      mountedRef.current = false;
      window.clearInterval(ticker);
      clearAllAnimations();
      if (particleRafRef.current !== null) {
        window.cancelAnimationFrame(particleRafRef.current);
        particleRafRef.current = null;
      }
      if (pendingSettlementRef.current) {
        const settle = pendingSettlementRef.current;
        pendingSettlementRef.current = null;
        settle();
      }
    };
  }, [clearAllAnimations]);

  useEffect(() => {
    if (!isActive) {
      setIsAutoSpin(false);
      clearAllAnimations();
      if (pendingSettlementRef.current) {
        const settle = pendingSettlementRef.current;
        pendingSettlementRef.current = null;
        settle();
      }
    }
  }, [isActive, clearAllAnimations]);

  const recordWinnerFeed = useCallback((payout: number) => {
    if (payout <= 0) return;
    setRecentWinners((prev) => [
      { initials: 'YOU', amountRespite: Math.round(payout * 100) / 100 },
      ...prev.slice(0, 3),
    ]);
  }, []);

  // ===========================================================================
  // BANK 3 & BANK 2 CONTINUOUS VERTICAL REEL ENGINE
  // - multi_line_3x3: Grand Royale 3-Reel x 4-Row (50 Paylines, Wilds, Scatters)
  // - classic_reels: Ruby 777 3-Reel x 3-Row (Center Payline + Pair/Triple Wins)
  // ===========================================================================
  const isReelMatrixVariant = variant === 'multi_line_3x3' || variant === 'classic_reels';
  const visibleRows = variant === 'multi_line_3x3' ? 4 : 3;
  const cellHeightPx = variant === 'multi_line_3x3' ? 84 : 112; // Exact 336px viewport height

  const [reelTapes, setReelTapes] = useState<[RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]]>(
    () =>
      variant === 'multi_line_3x3'
        ? [
            ['SEVEN', 'HORSESHOE', 'SEVEN', 'ACE'],
            ['GOLDBAG', 'WILD', 'ACE', 'KING'],
            ['GOLDBAG', 'HORSESHOE', 'SCATTER', 'ACE'],
          ]
        : [
            ['DIAMOND', 'SEVEN', 'ACE'],
            ['CROWN', 'SEVEN', 'KING'],
            ['RUBY', 'DIAMOND', 'QUEEN'],
          ],
  );
  const currentMatrixRef = useRef<[RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]]>(reelTapes);
  const stripDomRefs = useRef<[HTMLDivElement | null, HTMLDivElement | null, HTMLDivElement | null]>([
    null,
    null,
    null,
  ]);
  const [spinningCols, setSpinningCols] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [winningCellKeys, setWinningCellKeys] = useState<Set<string>>(() =>
    variant === 'multi_line_3x3'
      ? new Set(['0-1', '1-1', '2-1', '0-3', '1-2', '2-3'])
      : new Set(),
  );
  const [winningBeams, setWinningBeams] = useState<WinningBeamLine[]>(() =>
    variant === 'multi_line_3x3'
      ? [
          {
            coords: [
              { col: 0, row: 1 },
              { col: 1, row: 1 },
              { col: 2, row: 1 },
            ],
            colorHex: '#fde047',
          },
          {
            coords: [
              { col: 0, row: 3 },
              { col: 1, row: 2 },
              { col: 2, row: 3 },
            ],
            colorHex: '#f472b6',
          },
        ]
      : [],
  );

  // Sync initial matrix when switching between multi_line_3x3 and classic_reels
  useEffect(() => {
    if (variant === 'multi_line_3x3') {
      const init4: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [
        ['SEVEN', 'HORSESHOE', 'SEVEN', 'ACE'],
        ['GOLDBAG', 'WILD', 'ACE', 'KING'],
        ['GOLDBAG', 'HORSESHOE', 'SCATTER', 'ACE'],
      ];
      currentMatrixRef.current = init4;
      setReelTapes(init4);
      setWinningCellKeys(new Set(['0-1', '1-1', '2-1', '0-3', '1-2', '2-3']));
      setWinningBeams([
        {
          coords: [
            { col: 0, row: 1 },
            { col: 1, row: 1 },
            { col: 2, row: 1 },
          ],
          colorHex: '#fde047',
        },
        {
          coords: [
            { col: 0, row: 3 },
            { col: 1, row: 2 },
            { col: 2, row: 3 },
          ],
          colorHex: '#f472b6',
        },
      ]);
    } else if (variant === 'classic_reels') {
      const init3: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [
        ['DIAMOND', 'SEVEN', 'ACE'],
        ['CROWN', 'SEVEN', 'KING'],
        ['RUBY', 'DIAMOND', 'QUEEN'],
      ];
      currentMatrixRef.current = init3;
      setReelTapes(init3);
      setWinningCellKeys(new Set());
      setWinningBeams([]);
    }
  }, [variant]);

  // Draw glowing laser payline beams onto Canvas whenever winningBeams updates
  const drawLaserPaylines = useCallback(
    (beams: ReadonlyArray<WinningBeamLine>) => {
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
      const rowH = canvas.height / visibleRows;

      for (const beam of beams) {
        ctx.beginPath();
        beam.coords.forEach((pt, idx) => {
          const x = pt.col * colW + colW * 0.5;
          const y = pt.row * rowH + rowH * 0.5;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = beam.colorHex;
        ctx.lineWidth = 5.5;
        ctx.shadowColor = beam.colorHex;
        ctx.shadowBlur = 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
    },
    [visibleRows],
  );

  useLayoutEffect(() => {
    if (!isReelMatrixVariant) return;
    drawLaserPaylines(winningBeams);
    const onResize = () => drawLaserPaylines(winningBeams);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isReelMatrixVariant, winningBeams, drawLaserPaylines]);

  // ===========================================================================
  // BANK 1 STATE: LUCKY DRAW 777 (4x4 Perimeter Light Chase + x777 Vault)
  // ===========================================================================
  const [ldVaultPct, setLdVaultPct] = useState<number>(25);
  const [ldActiveTileIdx, setLdActiveTileIdx] = useState<number>(0);
  const ldCursorRef = useRef<number>(0);

  // ===========================================================================
  // BANK 4 STATE: EMERALD FORTUNE WHEEL (8-Sector Peg Physics + Flapper)
  // ===========================================================================
  const [wheelAngleDeg, setWheelAngleDeg] = useState<number>(0);
  const [flapperTiltDeg, setFlapperTiltDeg] = useState<number>(0);
  const wheelAngleRef = useRef<number>(0);

  // ===========================================================================
  // UNIFIED SPIN DISPATCHER (Powered 100% by Real RESPITE Currency)
  // ===========================================================================
  const handleSpinRef = useRef<() => void>(() => {});

  const scheduleAutoSpinNext = useCallback(() => {
    if (!isAutoSpinRef.current || !mountedRef.current) return;
    const delay = isTurboRef.current ? 420 : 950;
    const tid = window.setTimeout(() => {
      if (mountedRef.current && isAutoSpinRef.current) {
        handleSpinRef.current();
      }
    }, delay);
    timersRef.current.push(tid);
  }, []);

  const executeSpin = useCallback(() => {
    if (isSpinning || isPaytableOpen) return;

    const usingFreeSpin = freeSpinsLeft > 0;
    const stakeRespite = currentBet;
    const multUsed = usingFreeSpin ? 5 : 3;

    if (!usingFreeSpin) {
      const debit = onDebitRespite(stakeRespite);
      if (!debit.ok) {
        soundEngine.playHit();
        setStatusMessage(debit.message.toUpperCase());
        setIsAutoSpin(false);
        return;
      }
    } else {
      setFreeSpinsLeft((prev) => Math.max(0, prev - 1));
    }

    clearAllAnimations();
    setIsSpinning(true);
    setLastWinRespite(0);
    setJackpots((prev) => ({
      grand: prev.grand + stakeRespite * 0.08,
      major: prev.major + stakeRespite * 0.03,
      mini: prev.mini + stakeRespite * 0.01,
    }));

    if (soundEnabledRef.current) {
      soundEngine.playCasinoLeverPull();
    }

    // -------------------------------------------------------------------------
    // MODE A: GRAND ROYALE 3x4 (50 PAYLINES) — SAPPHIRE NORTH BANK
    // -------------------------------------------------------------------------
    if (variant === 'multi_line_3x3') {
      setWinningCellKeys(new Set());
      setWinningBeams([]);
      setStatusMessage(usingFreeSpin ? 'FREE SPIN · 5X BOOST!' : 'REELS SPINNING...');

      // Build fair, exciting 3x4 outcome matrix
      const targetCols: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [[], [], []];
      const forceLineHit = Math.random() < 0.42;
      const chosenPattern =
        ROYALE_3X4_PAYLINES[Math.floor(Math.random() * ROYALE_3X4_PAYLINES.length)]!;
      const nonScatterPool: RoyaleSymbolId[] = [
        'CROWN',
        'DIAMOND',
        'SEVEN',
        'RUBY',
        'HORSESHOE',
        'GOLDBAG',
        'ACE',
        'KING',
        'QUEEN',
        'JACK',
      ];
      const forcedSym =
        nonScatterPool[Math.floor(Math.random() * nonScatterPool.length)] ?? 'HORSESHOE';

      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 4; r++) {
          if (forceLineHit && chosenPattern[c] === r) {
            targetCols[c].push(Math.random() < 0.24 ? 'WILD' : forcedSym);
          } else {
            targetCols[c].push(pickRandomRoyaleSymbol());
          }
        }
      }

      // Evaluate 12 payline trajectories + Scatters
      let baseWin = 0;
      const hitKeys = new Set<string>();
      const beams: WinningBeamLine[] = [];

      for (const pattern of ROYALE_3X4_PAYLINES) {
        const s0 = ROYALE_SYMBOL_MAP[targetCols[0][pattern[0]]!];
        const s1 = ROYALE_SYMBOL_MAP[targetCols[1][pattern[1]]!];
        const s2 = ROYALE_SYMBOL_MAP[targetCols[2][pattern[2]]!];
        if (s0.isScatter || s1.isScatter || s2.isScatter) continue;

        const nonWilds = [s0, s1, s2].filter((s) => !s.isWild);
        const resolvedSym = nonWilds[0] ?? ROYALE_SYMBOL_MAP.WILD;
        const allMatch = nonWilds.every((s) => s.id === resolvedSym.id);

        if (allMatch) {
          baseWin += stakeRespite * (resolvedSym.payout3x / 6);
          hitKeys.add(`0-${pattern[0]}`);
          hitKeys.add(`1-${pattern[1]}`);
          hitKeys.add(`2-${pattern[2]}`);
          beams.push({
            coords: [
              { col: 0, row: pattern[0] },
              { col: 1, row: pattern[1] },
              { col: 2, row: pattern[2] },
            ],
            colorHex: resolvedSym.beamHex,
          });
        }
      }

      let scatterCount = 0;
      const scatterCoords: Array<{ col: number; row: number }> = [];
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 4; r++) {
          if (targetCols[c][r] === 'SCATTER') {
            scatterCount += 1;
            scatterCoords.push({ col: c, row: r });
          }
        }
      }

      let awardedFreeSpins = 0;
      if (scatterCount >= 3) {
        awardedFreeSpins = 5;
        baseWin += stakeRespite * 3;
        scatterCoords.forEach((sc) => hitKeys.add(`${sc.col}-${sc.row}`));
      } else if (scatterCount === 2) {
        awardedFreeSpins = 2;
        scatterCoords.forEach((sc) => hitKeys.add(`${sc.col}-${sc.row}`));
      }

      const finalWinRespite = Math.round(baseWin * multUsed);
      const xpGained =
        finalWinRespite >= stakeRespite * 8 ? 30 : finalWinRespite > 0 ? 10 : 3;

      pendingSettlementRef.current = () => {
        onSettleRespite(finalWinRespite, xpGained);
      };

      const intermediateLen = isTurboRef.current ? 12 : 22;
      const fullTapes: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [[], [], []];
      for (let c = 0; c < 3; c++) {
        const prevCol = currentMatrixRef.current[c] ?? ['SEVEN', 'ACE', 'KING', 'QUEEN'];
        const mid: RoyaleSymbolId[] = Array.from({ length: intermediateLen }, () =>
          pickRandomRoyaleSymbol(),
        );
        // Place previous visible symbols at the bottom and target symbols at top?
        // Scrolling downward (symbols falling top-to-bottom like real casino reels) OR upward:
        // Putting [prevCol ... mid ... targetCols] and translating Y from 0 to -distance scrolls smoothly!
        fullTapes[c] = [...prevCol, ...mid, ...targetCols[c]];
      }

      setReelTapes(fullTapes);
      setSpinningCols([true, true, true]);

      const baseDur = isTurboRef.current ? 480 : 1020;
      const stagger = isTurboRef.current ? 160 : 340;
      let stoppedCount = 0;

      const easeOutBack = (t: number) => {
        const c1 = 1.65;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };

      for (let colIdx = 0; colIdx < 3; colIdx++) {
        const totalDist = (fullTapes[colIdx].length - 4) * cellHeightPx;
        const duration = baseDur + colIdx * stagger;
        const startTime = performance.now();
        let lastTick = 0;

        const stepCol = (now: number) => {
          if (!mountedRef.current) return;
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          const stripEl = stripDomRefs.current[colIdx];

          if (progress < 0.92 && now - lastTick > (isTurboRef.current ? 55 : 85)) {
            playCabinetTick(colIdx);
            lastTick = now;
          }

          const eased =
            progress < 0.8
              ? (progress / 0.8) * 0.86
              : 0.86 + easeOutBack((progress - 0.8) / 0.2) * 0.14;

          if (stripEl) {
            stripEl.style.setProperty('transform', `translateY(${-totalDist * eased}px)`);
          }

          if (progress < 1) {
            const rid = window.requestAnimationFrame(stepCol);
            rafIdsRef.current.push(rid);
            return;
          }

          // Lock this reel cleanly onto targetCols[colIdx]
          if (stripEl) {
            stripEl.style.setProperty('transform', 'translateY(0px)');
          }
          setSpinningCols((prev) => {
            const next: [boolean, boolean, boolean] = [...prev];
            next[colIdx] = false;
            return next;
          });
          setReelTapes((prev) => {
            const next: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [
              prev[0],
              prev[1],
              prev[2],
            ];
            next[colIdx] = targetCols[colIdx];
            return next;
          });
          playCabinetReelLock(colIdx, colIdx === 2 && finalWinRespite > 0);

          stoppedCount += 1;
          if (stoppedCount === 3) {
            currentMatrixRef.current = targetCols;
            pendingSettlementRef.current = null;
            setIsSpinning(false);
            setWinningCellKeys(hitKeys);
            setWinningBeams(beams);

            if (awardedFreeSpins > 0) {
              setFreeSpinsLeft((prev) => prev + awardedFreeSpins);
            }

            const headline =
              finalWinRespite > 0
                ? `WINNER! +${finalWinRespite} RESPITE`
                : awardedFreeSpins > 0
                  ? `+${awardedFreeSpins} FREE SPINS UNLOCKED!`
                  : 'SPIN AGAIN!';

            setStatusMessage(headline);
            setLastWinRespite(finalWinRespite);
            onSettleRespite(
              finalWinRespite,
              xpGained,
              finalWinRespite >= stakeRespite * 5
                ? `GRAND ROYALE WIN +${finalWinRespite} RESPITE!`
                : undefined,
            );

            if (finalWinRespite > 0) {
              recordWinnerFeed(finalWinRespite);
              const big = finalWinRespite >= stakeRespite * 6;
              playCabinetWin(big);
              triggerCoinParticleBurst(big ? 65 : 32);
            }
            scheduleAutoSpinNext();
          }
        };

        const rid = window.requestAnimationFrame(stepCol);
        rafIdsRef.current.push(rid);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // MODE B: RUBY 777 CLASSIC 3-REEL — CRIMSON ISLAND BANK
    // -------------------------------------------------------------------------
    if (variant === 'classic_reels') {
      setWinningCellKeys(new Set());
      setWinningBeams([]);
      setStatusMessage(usingFreeSpin ? 'FREE SPIN · 5X RUBY!' : 'SPINNING RUBY 777...');

      const mapArcadeToRoyale: Record<ArcadeSlotSymbolId, RoyaleSymbolId> = {
        seven: 'SEVEN',
        diamond: 'DIAMOND',
        star: 'CROWN',
        bell: 'HORSESHOE',
        coffee: 'GOLDBAG',
        cherry: 'RUBY',
      };

      const spinRes = spinArcadeSlotReels(Math.max(2, stakeRespite), 9999999);
      const evalClassic = spinRes.evaluation!;
      const centerLine: [RoyaleSymbolId, RoyaleSymbolId, RoyaleSymbolId] = [
        mapArcadeToRoyale[evalClassic.reels[0]],
        mapArcadeToRoyale[evalClassic.reels[1]],
        mapArcadeToRoyale[evalClassic.reels[2]],
      ];

      const targetCols: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [
        [pickRandomRoyaleSymbol(), centerLine[0], pickRandomRoyaleSymbol()],
        [pickRandomRoyaleSymbol(), centerLine[1], pickRandomRoyaleSymbol()],
        [pickRandomRoyaleSymbol(), centerLine[2], pickRandomRoyaleSymbol()],
      ];

      const rawBaseWin =
        evalClassic.multiplier > 0 ? Math.round(stakeRespite * evalClassic.multiplier * 0.5) : 0;
      const finalWinRespite = rawBaseWin > 0 ? Math.max(stakeRespite, rawBaseWin * multUsed) : 0;
      const xpGained = evalClassic.xpGained;

      pendingSettlementRef.current = () => {
        onSettleRespite(finalWinRespite, xpGained);
      };

      const intermediateLen = isTurboRef.current ? 10 : 18;
      const fullTapes: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [[], [], []];
      for (let c = 0; c < 3; c++) {
        const prevCol = currentMatrixRef.current[c] ?? ['DIAMOND', 'SEVEN', 'ACE'];
        const mid: RoyaleSymbolId[] = Array.from({ length: intermediateLen }, () =>
          pickRandomRoyaleSymbol(),
        );
        fullTapes[c] = [...prevCol, ...mid, ...targetCols[c]];
      }

      setReelTapes(fullTapes);
      setSpinningCols([true, true, true]);

      const baseDur = isTurboRef.current ? 460 : 960;
      const stagger = isTurboRef.current ? 160 : 350;
      let stoppedCount = 0;

      for (let colIdx = 0; colIdx < 3; colIdx++) {
        const totalDist = (fullTapes[colIdx].length - 3) * cellHeightPx;
        const duration = baseDur + colIdx * stagger;
        const startTime = performance.now();
        let lastTick = 0;

        const stepCol = (now: number) => {
          if (!mountedRef.current) return;
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);
          const stripEl = stripDomRefs.current[colIdx];

          if (progress < 0.92 && now - lastTick > (isTurboRef.current ? 55 : 85)) {
            playCabinetTick(colIdx);
            lastTick = now;
          }

          const eased = 1 - Math.pow(1 - progress, 3);
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
            const next: [RoyaleSymbolId[], RoyaleSymbolId[], RoyaleSymbolId[]] = [
              prev[0],
              prev[1],
              prev[2],
            ];
            next[colIdx] = targetCols[colIdx];
            return next;
          });

          const isPairTension = colIdx === 1 && centerLine[0] === centerLine[1];
          playCabinetReelLock(colIdx, isPairTension);
          if (isPairTension) {
            setStatusMessage('PAIR LOCKED! WAITING REEL 3...');
          }

          stoppedCount += 1;
          if (stoppedCount === 3) {
            currentMatrixRef.current = targetCols;
            pendingSettlementRef.current = null;
            setIsSpinning(false);

            if (finalWinRespite > 0) {
              const hitKeys = new Set<string>(['0-1', '1-1', '2-1']);
              setWinningCellKeys(hitKeys);
              setWinningBeams([
                {
                  coords: [
                    { col: 0, row: 1 },
                    { col: 1, row: 1 },
                    { col: 2, row: 1 },
                  ],
                  colorHex: '#f43f5e',
                },
              ]);
              if (evalClassic.outcomeKind === 'jackpot') {
                setFreeSpinsLeft((prev) => prev + 3);
              }
              setStatusMessage(`WINNER! +${finalWinRespite} RESPITE`);
              setLastWinRespite(finalWinRespite);
              recordWinnerFeed(finalWinRespite);
              playCabinetWin(finalWinRespite >= stakeRespite * 6);
              triggerCoinParticleBurst(finalWinRespite >= stakeRespite * 6 ? 60 : 28);
            } else {
              setStatusMessage('SPIN AGAIN!');
            }

            onSettleRespite(
              finalWinRespite,
              xpGained,
              finalWinRespite >= stakeRespite * 5
                ? `RUBY 777 JACKPOT +${finalWinRespite} RESPITE!`
                : undefined,
            );
            scheduleAutoSpinNext();
          }
        };

        const rid = window.requestAnimationFrame(stepCol);
        rafIdsRef.current.push(rid);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // MODE C: LUCKY DRAW x777 VAULT — VIOLET WEST BANK
    // -------------------------------------------------------------------------
    if (variant === 'lucky_draw') {
      setStatusMessage(usingFreeSpin ? 'FREE CHASE ACTIVE!' : 'CHASING VAULT MATRIX...');
      const evaluation: LuckyDrawSpinEvaluation = spinLuckyDrawTile(
        Math.max(2, stakeRespite),
        ldVaultPct,
        usingFreeSpin,
      );
      const scaledWin = evaluation.vaultJackpotTriggered
        ? stakeRespite * 777
        : Math.round(stakeRespite * evaluation.resolvedMultiplier * (multUsed / 3));

      pendingSettlementRef.current = () => {
        onSettleRespite(scaledWin, evaluation.xpGained);
      };

      let chaseTick = 0;
      const stepMs = isTurboRef.current ? 40 : 64;
      const chaseDuration = isTurboRef.current ? 420 : 820;

      const intervalId = window.setInterval(() => {
        chaseTick += 1;
        const next = (ldCursorRef.current + 1) % LUCKY_DRAW_TILES.length;
        ldCursorRef.current = next;
        if (mountedRef.current) {
          setLdActiveTileIdx(next);
          if (soundEnabledRef.current) soundEngine.playLuckyChaseStep(chaseTick);
        }
      }, stepMs);
      timersRef.current.push(intervalId);

      const stopTimer = window.setTimeout(() => {
        window.clearInterval(intervalId);
        const totalTiles = LUCKY_DRAW_TILES.length;
        const cur = ldCursorRef.current % totalTiles;
        const delta = (evaluation.tile.index - cur + totalTiles) % totalTiles;
        const hops = delta === 0 ? 4 : delta < 3 ? delta + totalTiles : delta;
        let hopStep = 0;

        const finishHop = () => {
          if (!mountedRef.current) return;
          hopStep += 1;
          const nextIdx = (cur + hopStep) % totalTiles;
          ldCursorRef.current = nextIdx;
          setLdActiveTileIdx(nextIdx);
          if (soundEnabledRef.current) soundEngine.playLuckyChaseStep(chaseTick + hopStep);

          if (hopStep >= hops) {
            pendingSettlementRef.current = null;
            setIsSpinning(false);
            setLdVaultPct(evaluation.nextVaultProgressPct);
            if (evaluation.grantsFreeRespin) {
              setFreeSpinsLeft((prev) => prev + 1);
            }
            setLastWinRespite(scaledWin);
            setStatusMessage(
              scaledWin > 0
                ? `WINNER! +${scaledWin} RESPITE`
                : evaluation.grantsFreeRespin
                  ? '+1 FREE SPIN UNLOCKED!'
                  : 'SPIN AGAIN!',
            );
            onSettleRespite(
              scaledWin,
              evaluation.xpGained,
              evaluation.vaultJackpotTriggered
                ? `x777 VAULT JACKPOT +${scaledWin} RESPITE!`
                : undefined,
            );
            if (scaledWin > 0) {
              recordWinnerFeed(scaledWin);
              playCabinetWin(evaluation.vaultJackpotTriggered || scaledWin >= stakeRespite * 5);
              triggerCoinParticleBurst(evaluation.vaultJackpotTriggered ? 75 : 30);
            }
            scheduleAutoSpinNext();
            return;
          }

          const p = hopStep / hops;
          const nextDelay = Math.round((isTurboRef.current ? 45 : 70) + p * p * 95);
          timersRef.current.push(window.setTimeout(finishHop, nextDelay));
        };

        timersRef.current.push(window.setTimeout(finishHop, 65));
      }, chaseDuration);
      timersRef.current.push(stopTimer);
      return;
    }

    // -------------------------------------------------------------------------
    // MODE D: EMERALD 50X FORTUNE WHEEL — EMERALD EAST BANK
    // -------------------------------------------------------------------------
    setStatusMessage('SPINNING FORTUNE WHEEL...');
    const wheelRes = spinEmeraldFortuneWheel(Math.max(2, stakeRespite));
    const wheelWin =
      wheelRes.sector.multiplier > 0
        ? Math.round(stakeRespite * wheelRes.sector.multiplier * (multUsed / 3))
        : 0;

    pendingSettlementRef.current = () => {
      onSettleRespite(wheelWin, wheelRes.xpGained);
    };

    const sectorCenter = wheelRes.sector.index * 45 + 22.5;
    const targetBaseMod = (360 - sectorCenter) % 360;
    const startAngle = wheelAngleRef.current;
    const currentMod = ((startAngle % 360) + 360) % 360;
    const deltaMod = (targetBaseMod - currentMod + 360) % 360;
    const jitter = (Math.random() - 0.5) * 16;
    const spinsCount = isTurboRef.current ? 3 : 5;
    const totalDelta = 360 * spinsCount + deltaMod + jitter;
    const durationMs = isTurboRef.current ? 1050 : 2050;
    const startTime = performance.now();
    let lastPegIdx = Math.floor(startAngle / 45);
    let lastKickTime = -999;

    const animateWheel = (now: number) => {
      if (!mountedRef.current) return;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 4);
      const curAngle = startAngle + totalDelta * eased;
      wheelAngleRef.current = curAngle;
      setWheelAngleDeg(curAngle);

      const speed01 = Math.max(0, 1 - t);
      const pegIdx = Math.floor(curAngle / 45);
      if (pegIdx !== lastPegIdx) {
        lastPegIdx = pegIdx;
        lastKickTime = now;
        if (soundEnabledRef.current) soundEngine.playWheelPegTick(speed01);
      }

      const msSinceKick = now - lastKickTime;
      if (msSinceKick >= 0 && msSinceKick < 95) {
        const spring = 1 - msSinceKick / 95;
        setFlapperTiltDeg(-25 * spring * (0.45 + 0.55 * speed01));
      } else {
        setFlapperTiltDeg(0);
      }

      if (t < 1) {
        rafIdsRef.current.push(window.requestAnimationFrame(animateWheel));
        return;
      }

      pendingSettlementRef.current = null;
      setFlapperTiltDeg(0);
      setIsSpinning(false);
      setLastWinRespite(wheelWin);
      if (wheelRes.sector.multiplier >= 50) {
        setFreeSpinsLeft((prev) => prev + 3);
      }
      setStatusMessage(
        wheelWin > 0 ? `WINNER! +${wheelWin} RESPITE` : 'LANDED ON MISS · SPIN AGAIN!',
      );
      onSettleRespite(
        wheelWin,
        wheelRes.xpGained,
        wheelWin >= stakeRespite * 10
          ? `EMERALD WHEEL +${wheelWin} RESPITE!`
          : undefined,
      );
      if (wheelWin > 0) {
        recordWinnerFeed(wheelWin);
        playCabinetWin(wheelWin >= stakeRespite * 8);
        triggerCoinParticleBurst(wheelWin >= stakeRespite * 8 ? 65 : 28);
      }
      scheduleAutoSpinNext();
    };

    rafIdsRef.current.push(window.requestAnimationFrame(animateWheel));
  }, [
    isSpinning,
    isPaytableOpen,
    freeSpinsLeft,
    currentBet,
    variant,
    ldVaultPct,
    cellHeightPx,
    onDebitRespite,
    onSettleRespite,
    clearAllAnimations,
    playCabinetTick,
    playCabinetReelLock,
    playCabinetWin,
    recordWinnerFeed,
    triggerCoinParticleBurst,
    scheduleAutoSpinNext,
  ]);

  handleSpinRef.current = executeSpin;

  // Spacebar quick-spin support
  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isPaytableOpen) {
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          handleSpinRef.current();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, isPaytableOpen]);

  const modeSubtitle =
    variant === 'multi_line_3x3'
      ? '50 PAYLINES'
      : variant === 'classic_reels'
        ? 'CENTER PAYLINE'
        : variant === 'lucky_draw'
          ? 'x777 VAULT CHASE'
          : '8-SECTOR WHEEL';

  return (
    <>
      {/* Full-Viewport Coin & Gem Particle Shower Canvas */}
      <canvas
        ref={particleCanvasRef}
        className="pointer-events-none fixed inset-0 w-screen h-screen z-[80]"
        aria-hidden="true"
      />

      <div
        data-slot-bank={variant}
        className="w-full max-w-[1140px] mx-auto rounded-[26px] bg-[#0e121b]/88 backdrop-blur-2xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.62)] text-white overflow-hidden relative"
      >
        {/* TOP JACKPOT HEADER */}
        <header className="relative px-4 sm:px-6 py-4 bg-white/[0.03] border-b border-white/10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-300 text-[10px] font-bold font-cinzel uppercase tracking-widest shrink-0">
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                {variantMeta.title}
              </span>
              <span className="hidden sm:inline-block text-xs font-medium text-slate-400 truncate">
                {variantMeta.bankLabel} · {modeSubtitle}
              </span>
            </div>

            {onClose && (
              <button
                type="button"
                data-grand-casino-close-btn="true"
                onClick={() => {
                  setIsAutoSpin(false);
                  soundEngine.playUiCancel();
                  onClose();
                }}
                aria-label="Exit Slot Machine"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
            {/* MAJOR JACKPOT */}
            <div className="lg:col-span-3 flex items-center justify-between lg:justify-center gap-2 bg-white/[0.05] border border-white/10 px-4 py-2 rounded-2xl">
              <span className="text-xs font-bold text-amber-300/90 font-cinzel tracking-widest">
                MAJOR:
              </span>
              <span className="font-mono-tabular text-base sm:text-lg font-extrabold text-white tracking-wide">
                {formatRespiteReadout(jackpots.major)} R
              </span>
            </div>

            {/* GRAND JACKPOT CENTERPIECE */}
            <div className="lg:col-span-6 text-center px-4 py-2 rounded-2xl border border-amber-300/35 bg-gradient-to-r from-amber-300/10 via-amber-400/15 to-amber-300/10">
              <div className="flex items-center justify-center gap-1.5">
                <Gem className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-xs font-bold tracking-widest text-amber-200 font-cinzel">
                  GRAND JACKPOT
                </span>
                <Gem className="w-3.5 h-3.5 text-amber-300" />
              </div>

              <svg
                viewBox="0 0 460 40"
                className="w-full max-w-[400px] h-8 sm:h-9 mx-auto overflow-visible"
                role="img"
                aria-label={`Grand Jackpot ${formatRespiteReadout(jackpots.grand)} RESPITE`}
              >
                <defs>
                  <linearGradient id={`${jackpotGradId}-jp`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="45%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <text
                  x="230"
                  y="31"
                  textAnchor="middle"
                  className="font-mono-tabular"
                  fontWeight="900"
                  fontSize="30"
                  fill={`url(#${jackpotGradId}-jp)`}
                >
                  {formatRespiteReadout(jackpots.grand)} RESPITE
                </text>
              </svg>
            </div>

            {/* MINI JACKPOT */}
            <div className="lg:col-span-3 flex items-center justify-between lg:justify-center gap-2 bg-white/[0.05] border border-white/10 px-4 py-2 rounded-2xl">
              <span className="text-xs font-bold text-emerald-400 font-cinzel tracking-widest">
                MINI:
              </span>
              <span className="font-mono-tabular text-base sm:text-lg font-extrabold text-white tracking-wide">
                {formatRespiteReadout(jackpots.mini)} R
              </span>
            </div>
          </div>
        </header>

        {/* BODY CONTENT */}
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* CENTER INTERACTIVE 3-COLUMN STAGE */}
          <section className="grid grid-cols-12 gap-3 items-stretch relative">
            {/* LEFT STATUS & UTILITY PANEL */}
            <aside className="col-span-12 lg:col-span-2 flex lg:flex-col justify-between gap-2.5 rounded-2xl bg-white/[0.05] border border-white/10 p-3">
              <div className="flex-1 lg:flex-initial text-center bg-amber-300/10 border border-amber-300/30 rounded-xl p-2.5 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest font-cinzel">
                  Multiplier
                </span>
                <div className="text-2xl sm:text-3xl font-black text-white font-cinzel my-0.5 tracking-tight">
                  {activeMultiplier}X
                </div>
                <span className="text-[9px] text-emerald-400 font-bold tracking-wider uppercase whitespace-nowrap">
                  {freeSpinsLeft > 0 ? 'SUPER BOOST' : 'ACTIVE BOOST'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  playCabinetClick();
                  setIsPaytableOpen(true);
                }}
                className="flex-1 lg:flex-initial w-full rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 py-2 px-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-100 uppercase tracking-wider font-cinzel whitespace-nowrap cursor-pointer transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Paytable</span>
              </button>

              <button
                type="button"
                data-active={soundEnabled}
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) soundEngine.playUiClick();
                }}
                className={`flex-1 lg:flex-initial w-full rounded-full border py-2 px-3 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider font-cinzel whitespace-nowrap cursor-pointer transition-colors ${
                  soundEnabled
                    ? 'bg-emerald-400/15 border-emerald-400/35 text-emerald-300 hover:bg-emerald-400/25'
                    : 'bg-white/[0.05] border-white/10 text-slate-400 hover:bg-white/[0.1]'
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{soundEnabled ? 'Sound: On' : 'Sound: Off'}</span>
              </button>

              <div className="hidden lg:flex flex-col items-center justify-center text-slate-400 pt-2 border-t border-white/10 text-center">
                <Gem className="w-4 h-4 text-amber-300" />
                <span className="text-[8.5px] font-bold tracking-widest text-slate-300 mt-1 uppercase font-cinzel">
                  {variantMeta.bankLabel}
                </span>
              </div>
            </aside>

            {/* CENTER VIEWPORT */}
            <div className="col-span-12 lg:col-span-8 relative rounded-2xl overflow-hidden bg-[#070a12]/90 border border-white/15 shadow-inner h-[336px]">
              {/* BANK 3 & BANK 2: REEL DRUMS */}
              {isReelMatrixVariant && (
                <>
                  <canvas
                    ref={paylineCanvasRef}
                    className="pointer-events-none absolute inset-0 w-full h-full z-30"
                  />

                  {/* Center Payline Illuminated Guide Bar for Classic 3-Reel Bank */}
                  {variant === 'classic_reels' && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[112px] border-y border-amber-300/45 bg-amber-300/[0.06] z-10"
                    />
                  )}

                  <div className="grid grid-cols-3 h-[336px] relative divide-x divide-white/10">
                    {([0, 1, 2] as const).map((colIdx) => {
                      const colSpinning = spinningCols[colIdx];
                      const tape = reelTapes[colIdx];
                      const rowClass = variant === 'multi_line_3x3' ? 'h-[84px]' : 'h-[112px]';

                      return (
                        <div
                          key={colIdx}
                          className={`relative overflow-hidden h-[336px] bg-gradient-to-b from-black/35 via-white/[0.02] to-black/35 ${
                            colSpinning ? 'shadow-[inset_0_0_24px_rgba(252,211,77,0.14)]' : ''
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
                              const isHighlighted =
                                !colSpinning && winningCellKeys.has(`${colIdx}-${rowIdx}`);
                              return (
                                <div
                                  key={`${colIdx}-${rowIdx}-${symId}`}
                                  className={`${rowClass} flex items-center justify-center px-2 border-b border-white/[0.04] select-none`}
                                >
                                  <GrandRoyaleSymbolTile
                                    symbolId={symId}
                                    highlighted={isHighlighted}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* BANK 1: LUCKY DRAW 4x4 CHASE + x777 RESPITE VAULT */}
              {variant === 'lucky_draw' && (
                <div className="relative z-20 h-full grid grid-cols-4 grid-rows-4 gap-2 p-3 bg-[#090d17]">
                  {Array.from({ length: 16 }).map((_, flatIdx) => {
                    const r = Math.floor(flatIdx / 4);
                    const c = flatIdx % 4;
                    if ((r === 1 || r === 2) && (c === 1 || c === 2)) {
                      if (r === 1 && c === 1) {
                        return (
                          <div
                            key="vault-core"
                            className="col-span-2 row-span-2 rounded-2xl border border-amber-300/45 bg-gradient-to-b from-amber-300/15 via-white/[0.04] to-black/40 p-3 flex flex-col items-center justify-between"
                          >
                            <div className="w-full flex items-center justify-between text-[10px] font-cinzel font-bold tracking-widest">
                              <span className="text-amber-200">VAULT REACTOR</span>
                              <span className="text-amber-300 font-mono-tabular">x777</span>
                            </div>

                            <div className="flex flex-col items-center my-0.5">
                              <CasinoSlotSymbolArtwork id="vault" sizeClass="w-12 h-12" />
                              <div className="font-mono-tabular text-base sm:text-lg font-extrabold text-emerald-300 mt-0.5">
                                {(currentBet * 777).toLocaleString()} RESPITE
                              </div>
                            </div>

                            <div className="w-full space-y-1">
                              <div className="flex items-center justify-between text-[9.5px] font-bold">
                                <span className="text-slate-300 uppercase font-cinzel">Charge</span>
                                <span className="font-mono-tabular text-emerald-400">
                                  {ldVaultPct}%
                                </span>
                              </div>
                              <svg
                                viewBox="0 0 200 10"
                                className="w-full h-2.5 rounded-full overflow-hidden bg-white/10"
                                aria-hidden="true"
                              >
                                <rect
                                  x="0"
                                  y="0"
                                  width={Math.max(4, Math.round(ldVaultPct * 2))}
                                  height="10"
                                  rx="5"
                                  fill="#34d399"
                                />
                              </svg>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }

                    const tile = LUCKY_DRAW_TILES.find((t) => t.gridRow === r && t.gridCol === c)!;
                    const active = ldActiveTileIdx === tile.index;
                    return (
                      <div
                        key={tile.index}
                        className={`rounded-xl border flex flex-col items-center justify-center px-1.5 py-1 transition-all duration-75 ${
                          active
                            ? 'bg-amber-300/25 border-amber-300 scale-[1.04] shadow-[0_0_20px_rgba(252,211,77,0.4)] z-10'
                            : 'bg-white/[0.05] border-white/10'
                        }`}
                      >
                        <CasinoSlotSymbolArtwork id={tile.iconKey} sizeClass="w-7 h-7" />
                        <span className="font-mono-tabular text-xs font-extrabold text-white leading-tight">
                          {tile.label}
                        </span>
                        <span className="text-[8.5px] font-cinzel font-bold text-amber-300/90 tracking-wider uppercase truncate max-w-full">
                          {tile.sublabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* BANK 4: EMERALD 50X FORTUNE WHEEL */}
              {variant === 'fortune_wheel' && (
                <div className="relative z-20 h-full flex items-center justify-center bg-gradient-to-b from-[#0b1f1c] via-[#091419] to-[#070a12] px-4">
                  <div className="hidden sm:flex flex-col gap-2.5 mr-6 text-left">
                    <div className="px-3.5 py-2.5 rounded-2xl bg-white/[0.05] border border-emerald-400/35">
                      <div className="text-[9px] font-cinzel text-emerald-300 uppercase tracking-widest">
                        Top Wedge Prize
                      </div>
                      <div className="font-mono-tabular text-lg font-extrabold text-amber-300">
                        {(currentBet * 50 * (activeMultiplier / 3)).toFixed(0)} RESPITE
                      </div>
                    </div>
                    <div className="px-3.5 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10">
                      <div className="text-[9px] font-cinzel text-slate-300 uppercase tracking-widest">
                        50x Wedge Bonus
                      </div>
                      <div className="text-xs font-bold text-emerald-300">+3 Free Spins</div>
                    </div>
                  </div>

                  <svg
                    viewBox="0 0 260 272"
                    className="w-[270px] h-[282px] drop-shadow-[0_10px_25px_rgba(0,0,0,0.75)]"
                    aria-label="Emerald Fortune Spin Wheel"
                  >
                    <circle cx="130" cy="142" r="118" fill="#090d16" stroke="#34d399" strokeWidth="3.5" />
                    <circle cx="130" cy="142" r="111" fill="#0f172a" stroke="#fcd34d" strokeWidth="2.5" />

                    <g transform={`rotate(${wheelAngleDeg.toFixed(2)} 130 142)`}>
                      {FORTUNE_WHEEL_SECTORS.map((sec, idx) => {
                        const sliceAngle = 360 / FORTUNE_WHEEL_SECTORS.length;
                        const startRad = ((idx * sliceAngle - 90) * Math.PI) / 180;
                        const endRad = (((idx + 1) * sliceAngle - 90) * Math.PI) / 180;
                        const r = 104;
                        const x1 = 130 + r * Math.cos(startRad);
                        const y1 = 142 + r * Math.sin(startRad);
                        const x2 = 130 + r * Math.cos(endRad);
                        const y2 = 142 + r * Math.sin(endRad);
                        const midDeg = idx * sliceAngle + sliceAngle * 0.5;
                        const pegX = 130 + 106 * Math.cos(startRad);
                        const pegY = 142 + 106 * Math.sin(startRad);
                        const wedgeFill =
                          sec.multiplier >= 50
                            ? '#eab308'
                            : sec.multiplier >= 15
                              ? '#be123c'
                              : sec.multiplier >= 8
                                ? '#7e22ce'
                                : sec.multiplier >= 5
                                  ? '#047857'
                                  : sec.multiplier >= 3
                                    ? '#0369a1'
                                    : sec.multiplier >= 2
                                      ? '#0f766e'
                                      : '#1e293b';

                        return (
                          <g key={sec.index}>
                            <path
                              d={`M130,142 L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`}
                              fill={wedgeFill}
                              stroke="#94a3b8"
                              strokeWidth="1.2"
                            />
                            <text
                              x="130"
                              y="62"
                              textAnchor="middle"
                              fontWeight="900"
                              fontSize="12.5"
                              fill={sec.multiplier >= 50 ? '#0f172a' : '#f8fafc'}
                              transform={`rotate(${midDeg} 130 142)`}
                            >
                              {sec.label}
                            </text>
                            <circle
                              cx={pegX}
                              cy={pegY}
                              r="3.8"
                              fill="#fef08a"
                              stroke="#0f172a"
                              strokeWidth="1.6"
                            />
                          </g>
                        );
                      })}
                      <circle cx="130" cy="142" r="22" fill="#0f172a" stroke="#fcd34d" strokeWidth="3.5" />
                      <circle cx="130" cy="142" r="9" fill="#34d399" />
                    </g>

                    <g transform={`rotate(${flapperTiltDeg.toFixed(1)} 130 18)`}>
                      <circle cx="130" cy="18" r="6" fill="#fcd34d" stroke="#0f172a" strokeWidth="2" />
                      <polygon
                        points="130,44 119,19 141,19"
                        fill="#f43f5e"
                        stroke="#fef08a"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </g>
                  </svg>
                </div>
              )}
            </div>

            {/* RIGHT STATUS PANEL */}
            <aside className="col-span-12 lg:col-span-2 flex lg:flex-col justify-between gap-2.5 rounded-2xl bg-white/[0.05] border border-white/10 p-3">
              <div className="flex-1 lg:flex-initial bg-white/[0.04] border border-white/10 rounded-xl p-2.5">
                <h4 className="text-[9.5px] font-bold tracking-widest text-amber-300 uppercase text-center border-b border-white/10 pb-1 mb-1.5 font-cinzel">
                  Recent Winners
                </h4>
                <div className="text-[11px] space-y-1 font-mono-tabular text-slate-300 leading-tight">
                  {recentWinners.map((w, idx) => (
                    <div key={`${w.initials}-${idx}`} className="flex justify-between gap-1">
                      <span className={w.initials === 'YOU' ? 'text-amber-300 font-bold' : ''}>
                        {w.initials}
                      </span>
                      <span className="text-emerald-400 font-bold">+{w.amountRespite} R</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 lg:flex-initial text-center bg-emerald-400/10 border border-emerald-400/25 rounded-xl p-2.5 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest font-cinzel">
                  Free Spins
                </span>
                <div className="flex items-center gap-1 my-0.5">
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span className="text-2xl sm:text-3xl font-black text-white font-cinzel">
                    {freeSpinsLeft}
                  </span>
                </div>
                <span className="text-[9px] text-slate-300 font-bold tracking-wider uppercase">
                  Remaining
                </span>
              </div>

              <div className="flex-1 lg:flex-initial bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-2 text-center text-[10.5px] font-bold text-amber-200 font-cinzel flex items-center justify-center leading-tight">
                {statusMessage}
              </div>
            </aside>
          </section>

          {/* READOUTS: CREDITS & WIN */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-cinzel text-xs sm:text-sm font-bold text-amber-300 tracking-widest uppercase">
                  CREDITS:
                </span>
                {onQuickTopUpRespite && lulBalance >= 50 && (
                  <button
                    type="button"
                    onClick={onQuickTopUpRespite}
                    title="Exchange 50 LUL for +5 RESPITE Slot Credits"
                    className="px-3 py-1 rounded-full bg-amber-300 hover:bg-amber-200 text-slate-950 text-[10px] font-bold font-cinzel whitespace-nowrap cursor-pointer transition-colors"
                  >
                    +5 R (50 LUL)
                  </button>
                )}
              </div>
              <span className="font-mono-tabular text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {formatRespiteReadout(respiteBalance)} RESPITE
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10">
              <span className="font-cinzel text-xs sm:text-sm font-bold text-emerald-400 tracking-widest uppercase">
                WIN:
              </span>
              <span className="font-mono-tabular text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight">
                {formatRespiteReadout(lastWinRespite)} RESPITE
              </span>
            </div>
          </section>

          {/* BOTTOM CONTROL DECK */}
          <footer className="w-full rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 sm:gap-3">
              {/* Left Auxiliary Controls: TURBO & AUTO SPIN */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-active={isTurbo}
                  onClick={() => {
                    playCabinetClick();
                    setIsTurbo((prev) => !prev);
                  }}
                  className={`px-4 py-2.5 rounded-full border text-xs font-bold font-cinzel tracking-wider flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    isTurbo
                      ? 'bg-amber-300 border-amber-300 text-slate-950'
                      : 'bg-white/[0.07] hover:bg-white/[0.14] border-white/15 text-slate-200'
                  }`}
                >
                  <FastForward className="w-3.5 h-3.5 shrink-0" />
                  <span>Turbo</span>
                </button>

                <button
                  type="button"
                  data-active={isAutoSpin}
                  onClick={() => {
                    playCabinetClick();
                    const next = !isAutoSpin;
                    setIsAutoSpin(next);
                    if (next && !isSpinning) {
                      executeSpin();
                    }
                  }}
                  className={`px-4 py-2.5 rounded-full border text-xs font-bold font-cinzel tracking-wider flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    isAutoSpin
                      ? 'bg-emerald-400 border-emerald-400 text-slate-950'
                      : 'bg-amber-300/15 hover:bg-amber-300/25 border-amber-300/35 text-amber-200'
                  }`}
                >
                  <RotateCw
                    className={`w-3.5 h-3.5 shrink-0 ${isAutoSpin ? 'animate-spin' : ''}`}
                  />
                  <span>{isAutoSpin ? 'Stop Auto' : 'Auto Spin'}</span>
                </button>
              </div>

              {/* Center Bet Rocker */}
              <div className="flex items-center bg-white/[0.04] border border-white/15 rounded-full px-2 py-1 gap-2">
                <button
                  type="button"
                  disabled={isSpinning || betIndex === 0}
                  onClick={() => {
                    playCabinetClick();
                    setBetIndex((prev) => Math.max(0, prev - 1));
                  }}
                  aria-label="Decrease Bet"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-35 cursor-pointer transition-colors"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>

                <div className="px-3 text-center min-w-[138px]">
                  <div className="text-[9px] uppercase tracking-widest text-amber-300 font-bold font-cinzel">
                    TOTAL BET
                  </div>
                  <div className="font-mono-tabular text-base sm:text-lg font-extrabold text-white leading-tight whitespace-nowrap">
                    {currentBet} RESPITE
                  </div>
                  <div className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase whitespace-nowrap">
                    {modeSubtitle}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSpinning || betIndex >= RESPITE_SLOT_BET_TIERS.length - 1}
                  onClick={() => {
                    playCabinetClick();
                    setBetIndex((prev) => Math.min(RESPITE_SLOT_BET_TIERS.length - 1, prev + 1));
                  }}
                  aria-label="Increase Bet"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-35 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Max Bet Pill */}
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => {
                  playCabinetClick();
                  let bestIdx = 0;
                  for (let i = 0; i < RESPITE_SLOT_BET_TIERS.length; i++) {
                    if (respiteBalance >= RESPITE_SLOT_BET_TIERS[i]) {
                      bestIdx = i;
                    }
                  }
                  setBetIndex(bestIdx);
                }}
                className="px-4 py-2.5 rounded-full bg-amber-300/15 hover:bg-amber-300/25 border border-amber-300/35 text-xs font-bold font-cinzel text-amber-200 tracking-wider whitespace-nowrap disabled:opacity-45 cursor-pointer transition-colors"
              >
                Max Bet
              </button>

              {/* Primary Emerald Pill SPIN Button */}
              <button
                type="button"
                disabled={isSpinning}
                data-casino-spin-slots-btn="true"
                onClick={executeSpin}
                className="flex-1 lg:flex-initial ml-auto min-w-[175px] sm:min-w-[215px] h-12 rounded-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-45 px-6 flex items-center justify-center gap-2 text-slate-950 font-cinzel font-black text-base sm:text-lg tracking-widest whitespace-nowrap shadow-md active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>{isSpinning ? 'SPINNING' : freeSpinsLeft > 0 ? 'FREE SPIN' : 'SPIN'}</span>
                <Play className="w-4 h-4 fill-current shrink-0" />
              </button>
            </div>
          </footer>
        </div>

        {/* PAYTABLE & BANK RULES OVERLAY MODAL */}
        {isPaytableOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${variantMeta.title} Paytable`}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
            onClick={() => setIsPaytableOpen(false)}
          >
            <div
              className="w-full max-w-2xl rounded-[26px] bg-[#0e121b]/95 backdrop-blur-2xl border border-white/15 p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.62)] text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
                <div className="flex items-center gap-2.5">
                  <Crown className="w-5 h-5 text-amber-300" />
                  <h3 className="font-cinzel text-lg sm:text-xl font-bold text-amber-300">
                    {variantMeta.title} · Paytable &amp; Rules
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaytableOpen(false)}
                  aria-label="Close Paytable"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isReelMatrixVariant && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mb-4">
                  {ROYALE_SYMBOLS.slice(0, 8).map((sym) => (
                    <div
                      key={sym.id}
                      className="bg-white/[0.05] border border-white/10 rounded-2xl p-2.5 flex flex-col items-center text-center"
                    >
                      <GrandRoyaleSymbolTile symbolId={sym.id} compact />
                      <span className="text-[10.5px] text-amber-200 font-mono-tabular mt-1">
                        3x Line = {sym.payout3x}x
                      </span>
                    </div>
                  ))}
                  <div className="col-span-1 sm:col-span-2 bg-white/[0.05] border border-amber-300/35 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center">
                    <GrandRoyaleSymbolTile symbolId="WILD" compact />
                    <span className="text-[10.5px] text-amber-200 font-mono-tabular mt-1">
                      Substitutes All Non-Scatter Symbols
                    </span>
                  </div>
                  <div className="col-span-1 sm:col-span-2 bg-white/[0.05] border border-emerald-400/35 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center">
                    <GrandRoyaleSymbolTile symbolId="SCATTER" compact />
                    <span className="text-[10.5px] text-emerald-300 font-mono-tabular mt-1">
                      2+ Scatters = +2 to +5 Free Spins (5X Boost)
                    </span>
                  </div>
                </div>
              )}

              {variant === 'lucky_draw' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs mb-4">
                  <div className="bg-white/[0.05] border border-amber-300/35 rounded-2xl p-3 text-center">
                    <div className="font-cinzel font-bold text-amber-300">x777 Vault</div>
                    <div className="font-mono-tabular text-slate-200 mt-1">
                      100% Charge = 777x Bet
                    </div>
                  </div>
                  <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-3 text-center">
                    <div className="font-cinzel font-bold text-amber-200">Super 7 &amp; Gems</div>
                    <div className="font-mono-tabular text-slate-200 mt-1">Up to 10x Instant Win</div>
                  </div>
                  <div className="bg-white/[0.05] border border-emerald-400/35 rounded-2xl p-3 text-center">
                    <div className="font-cinzel font-bold text-emerald-300">Free Re-Spin</div>
                    <div className="font-mono-tabular text-slate-200 mt-1">+1 Free Spin &amp; Charge</div>
                  </div>
                </div>
              )}

              {variant === 'fortune_wheel' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mb-4">
                  {ARCADE_SLOT_SYMBOLS.slice(0, 4).map((s, idx) => {
                    const mults = ['50x JP', '15x', '8x', '5x'];
                    return (
                      <div
                        key={s.id}
                        className="bg-white/[0.05] border border-emerald-400/30 rounded-2xl p-3 text-center"
                      >
                        <div className="font-cinzel font-bold text-emerald-300">Wedge #{idx + 1}</div>
                        <div className="font-mono-tabular text-amber-300 text-sm font-black mt-1">
                          {mults[idx]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-3.5 text-xs leading-relaxed text-slate-300 space-y-1">
                <p>
                  <strong className="text-amber-300 font-cinzel">RESPITE Settlement:</strong> All bets
                  and winnings settle directly against your in-game{' '}
                  <span className="text-emerald-300 font-semibold">RESPITE</span> balance.
                </p>
                <p>
                  <strong className="text-amber-300 font-cinzel">Active VIP Multiplier:</strong> Base
                  spins apply a <span className="text-amber-200 font-semibold">3X</span> multiplier;
                  Free Spins surge to <span className="text-emerald-300 font-semibold">5X</span>!
                </p>
                <p>
                  <strong className="text-amber-300 font-cinzel">Quick Spin:</strong> Press{' '}
                  <kbd className="px-2 py-0.5 bg-white/10 rounded-md border border-white/15 font-mono-tabular text-amber-300">
                    SPACEBAR
                  </kbd>{' '}
                  anytime to spin.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
