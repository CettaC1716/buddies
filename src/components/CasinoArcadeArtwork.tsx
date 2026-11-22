import React, { useId } from 'react';

export const CasinoCoinCrestSvg: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4 shrink-0',
}) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-coin`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="17.5" r="12" fill="#92400e" stroke="#14161d" strokeWidth="2.4" />
      <circle
        cx="16"
        cy="14.8"
        r="12"
        fill={`url(#${uid}-coin)`}
        stroke="#14161d"
        strokeWidth="2.4"
      />
      <circle
        cx="16"
        cy="14.8"
        r="8.2"
        fill="none"
        stroke="#92400e"
        strokeWidth="1.4"
        strokeDasharray="2.5 2"
      />
      <polygon
        points="16,9.2 17.8,12.8 21.8,13.4 18.9,16.1 19.6,20 16,18.1 12.4,20 13.1,16.1 10.2,13.4 14.2,12.8"
        fill="#fffbeb"
        stroke="#14161d"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const CasinoTrophyCrestSvg: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4 shrink-0',
}) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path
      d="M9 7H5c0 5 2 8 5 9M23 7h4c0 5-2 8-5 9"
      fill="none"
      stroke="#14161d"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path
      d="M9 5h14v9c0 4.4-3.1 7.6-7 7.6S9 18.4 9 14z"
      fill="#facc15"
      stroke="#14161d"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <path d="M12 7h3v8l-3-2z" fill="#fef9c3" opacity="0.85" />
    <rect x="13.5" y="21.5" width="5" height="4" fill="#d97706" stroke="#14161d" strokeWidth="2" />
    <rect
      x="9"
      y="25.2"
      width="14"
      height="3.8"
      rx="1.2"
      fill="#78350f"
      stroke="#14161d"
      strokeWidth="2.2"
    />
  </svg>
);

export const CasinoCrownCrestSvg: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5 shrink-0',
}) => (
  <svg viewBox="0 0 36 32" className={className} aria-hidden="true">
    <path
      d="M5 24L3 10l8.5 6L18 7l6.5 9L33 10l-2 14z"
      fill="#facc15"
      stroke="#14161d"
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
    <rect
      x="5"
      y="24"
      width="26"
      height="4.5"
      rx="1.5"
      fill="#d97706"
      stroke="#14161d"
      strokeWidth="2.4"
    />
    <circle cx="18" cy="18" r="2.6" fill="#ef4444" stroke="#14161d" strokeWidth="1.4" />
    <circle cx="10.5" cy="19.5" r="2" fill="#38bdf8" stroke="#14161d" strokeWidth="1.3" />
    <circle cx="25.5" cy="19.5" r="2" fill="#34d399" stroke="#14161d" strokeWidth="1.3" />
  </svg>
);

export const CasinoCloseBadgeSvg: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4 shrink-0',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5"
      stroke="#ffffff"
      strokeWidth="4.2"
      strokeLinecap="round"
    />
  </svg>
);

export const CasinoSpinGlyphSvg: React.FC<{
  spinning?: boolean;
  className?: string;
}> = ({ spinning = false, className = 'w-4 h-4 shrink-0' }) => (
  <svg
    viewBox="0 0 28 28"
    className={`${className} ${spinning ? 'animate-spin' : ''}`}
    aria-hidden="true"
  >
    <path
      d="M21 10.5A8 8 0 0 0 7.4 8.4M7 17.5A8 8 0 0 0 20.6 19.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <polygon points="22.5,5 23,12 16,10.5" fill="currentColor" />
    <polygon points="5.5,23 5,16 12,17.5" fill="currentColor" />
    <circle cx="14" cy="14" r="2.5" fill="currentColor" />
  </svg>
);

export const CasinoUndoGlyphSvg: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M9 7L4 12l5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 12h9a5 5 0 0 1 0 10h-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export const CasinoClearTrashGlyphSvg: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="10.5" y1="11" x2="10.5" y2="16.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="13.5" y1="11" x2="13.5" y2="16.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const CasinoRebetGlyphSvg: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeDasharray="34 12" />
    <polygon points="18,4 20.5,10 14,9.5" fill="currentColor" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
  </svg>
);

export const CasinoEyeGlyphSvg: React.FC<{
  closed?: boolean;
  className?: string;
}> = ({ closed = false, className = 'w-3.5 h-3.5 shrink-0' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M2.5 12s3.8-6 9.5-6 9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.8" fill="currentColor" />
    {closed && (
      <line
        x1="4"
        y1="20"
        x2="20"
        y2="4"
        stroke="#fb7185"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    )}
  </svg>
);

const CHIP_PALETTE: Record<
  number,
  { outer: string; rim: string; center: string; text: string }
> = {
  5: { outer: '#dc2626', rim: '#fee2e2', center: '#991b1b', text: '#ffffff' },
  10: { outer: '#0284c7', rim: '#e0f2fe', center: '#075985', text: '#ffffff' },
  25: { outer: '#059669', rim: '#fef3c7', center: '#065f46', text: '#ffffff' },
  50: { outer: '#f59e0b', rim: '#14161d', center: '#fde047', text: '#14161d' },
  100: { outer: '#9333ea', rim: '#fef08a', center: '#581c87', text: '#fef08a' },
};

export const CasinoPokerChipButton: React.FC<{
  amount: number;
  selected: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}> = ({ amount, selected, disabled = false, compact = false, onClick }) => {
  const pal = CHIP_PALETTE[amount] || CHIP_PALETTE[10];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative flex flex-col items-center justify-center rounded-xl border-[2.5px] border-[#14161d] cursor-pointer transition-transform duration-150 disabled:opacity-45 disabled:cursor-not-allowed ${
        compact ? 'px-2 py-1.5 min-w-[54px]' : 'px-2.5 py-1.5 min-w-[64px]'
      } ${
        selected
          ? 'bg-[#fef08a] -translate-y-0.5 shadow-[0_4px_0_#14161d] ring-2 ring-[#facc15]'
          : 'bg-[#f7efe0] hover:bg-white shadow-[0_2px_0_#14161d] active:translate-y-[1px]'
      }`}
    >
      <svg
        viewBox="0 0 44 44"
        className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} transition-transform group-hover:scale-105`}
        aria-hidden="true"
      >
        <circle cx="22" cy="23.5" r="18" fill="#14161d" />
        <circle cx="22" cy="21.5" r="18" fill={pal.outer} stroke="#14161d" strokeWidth="2.4" />
        <circle
          cx="22"
          cy="21.5"
          r="15"
          fill="none"
          stroke={pal.rim}
          strokeWidth="3.2"
          strokeDasharray="4.5 4.2"
        />
        <circle cx="22" cy="21.5" r="11" fill={pal.center} stroke="#14161d" strokeWidth="1.8" />
        <path
          d="M12.5 14.5 A12 12 0 0 1 28 11.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.55"
        />
        <text
          x="22"
          y="24.8"
          textAnchor="middle"
          fontWeight="900"
          fontSize="10.5"
          fill={pal.text}
          fontFamily="monospace"
        >
          {amount}
        </text>
      </svg>
      <span className="mt-0.5 text-[9.5px] font-black uppercase tracking-tight text-[#14161d] font-mono-tabular whitespace-nowrap">
        {amount} LUL
      </span>
    </button>
  );
};

export const RouletteFeltChipTokenSvg: React.FC<{
  amount: number;
  compact?: boolean;
}> = ({ amount, compact = false }) => {
  const pal =
    amount >= 100
      ? CHIP_PALETTE[100]
      : amount >= 50
        ? CHIP_PALETTE[50]
        : amount >= 25
          ? CHIP_PALETTE[25]
          : amount >= 10
            ? CHIP_PALETTE[10]
            : CHIP_PALETTE[5];
  return (
    <span
      className={`pointer-events-none relative inline-flex items-center justify-center ${
        compact ? 'w-5 h-5' : 'w-6 h-6'
      }`}
    >
      <svg viewBox="0 0 32 32" className="w-full h-full drop-shadow-[0_1.5px_0_#000]" aria-hidden="true">
        <circle cx="16" cy="16" r="13.5" fill={pal.outer} stroke="#14161d" strokeWidth="2.2" />
        <circle
          cx="16"
          cy="16"
          r="10.8"
          fill="none"
          stroke={pal.rim}
          strokeWidth="2.4"
          strokeDasharray="3.2 2.9"
        />
        <circle cx="16" cy="16" r="8" fill={pal.center} />
        <text
          x="16"
          y="18.8"
          textAnchor="middle"
          fontWeight="900"
          fontSize="7.8"
          fill={pal.text}
          fontFamily="monospace"
        >
          {amount > 999 ? '1K+' : amount}
        </text>
      </svg>
    </span>
  );
};

export const ArcadePushButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  variant?: 'lime' | 'gold' | 'sky' | 'rose' | 'slate';
  className?: string;
  children: React.ReactNode;
  dataAttrs?: Record<string, string>;
}> = ({
  onClick,
  disabled = false,
  variant = 'lime',
  className = '',
  children,
  dataAttrs,
}) => {
  const toneCls = {
    lime: 'bg-gradient-to-b from-[#d9ff70] via-[#b8ff3c] to-[#84cc16] text-[#14161d] shadow-[0_4px_0_#14161d]',
    gold: 'bg-gradient-to-b from-[#fef08a] via-[#facc15] to-[#eab308] text-[#14161d] shadow-[0_4px_0_#14161d]',
    sky: 'bg-gradient-to-b from-[#bae6fd] via-[#38bdf8] to-[#0284c7] text-[#14161d] shadow-[0_4px_0_#14161d]',
    rose: 'bg-gradient-to-b from-[#fca5a5] via-[#ff3b30] to-[#dc2626] text-white shadow-[0_4px_0_#14161d]',
    slate: 'bg-gradient-to-b from-[#334155] to-[#1e293b] text-white shadow-[0_3px_0_#000]',
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      {...dataAttrs}
      className={`relative inline-flex items-center justify-center gap-2 px-5 py-2.5 font-black text-xs uppercase tracking-wider border-[3px] border-[#14161d] rounded-xl cursor-pointer transition-all duration-100 hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_#14161d] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 whitespace-nowrap shrink-0 ${toneCls} ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-0.5 h-1 rounded-full bg-white/45"
      />
      {children}
    </button>
  );
};

/**
 * Interactive mechanical slot-cabinet Pull Lever.
 * Clicking (or pulling) animates the lever handle downward and triggers the spin.
 */
export const CasinoPullLeverButton: React.FC<{
  pulled: boolean;
  disabled?: boolean;
  accentHex?: string;
  onPull: () => void;
}> = ({ pulled, disabled = false, accentHex = '#ef4444', onPull }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onPull}
    title="Pull Slot Machine Lever"
    aria-label="Pull Slot Machine Lever"
    className={`group relative flex flex-col items-center justify-center w-12 sm:w-14 self-stretch rounded-xl border-[3px] border-[#14161d] bg-[#272b38] shadow-[4px_4px_0_#000] px-1 py-2 cursor-pointer transition-colors hover:bg-[#313647] disabled:cursor-not-allowed shrink-0`}
  >
    <span className="text-[8px] font-black uppercase tracking-widest text-[#fec83e] mb-1">
      PULL
    </span>

    <div className="relative flex-1 w-full flex items-center justify-center min-h-[112px]">
      {/* Housing Track */}
      <div className="w-3 h-24 rounded-full bg-[#0f172a] border-2 border-[#14161d] shadow-inner" />

      {/* Pivot Base */}
      <div className="absolute bottom-3 w-8 h-5 rounded-md bg-gradient-to-b from-slate-300 to-slate-500 border-2 border-[#14161d]" />

      {/* Chrome Rod + Knob that slides/tilts down smoothly */}
      <div
        className={`absolute inset-x-0 flex flex-col items-center transition-transform duration-200 ease-out ${
          pulled ? 'translate-y-8 scale-y-90' : 'translate-y-[-22px] group-hover:translate-y-[-18px]'
        }`}
      >
        <svg viewBox="0 0 36 36" className="w-8 h-8 drop-shadow-[0_2px_0_#000]" aria-hidden="true">
          <circle cx="18" cy="17" r="14" fill={accentHex} stroke="#14161d" strokeWidth="3" />
          <ellipse cx="13.5" cy="11.5" rx="4.5" ry="2.8" fill="#ffffff" opacity="0.65" transform="rotate(-24 13.5 11.5)" />
        </svg>
        <div className="w-2 h-11 -mt-1.5 rounded-b bg-gradient-to-r from-slate-200 via-white to-slate-400 border-x-2 border-[#14161d]" />
      </div>
    </div>

    <span className="mt-1 text-[8px] font-black uppercase tracking-wider text-slate-300">
      {pulled ? 'SPIN!' : 'LEVER'}
    </span>
  </button>
);
