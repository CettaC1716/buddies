import React from 'react';

interface WalletAssetPortraitCardProps {
  brandLabel: string;
  badgeLabel?: string;
  badgeTone?: 'neutral' | 'emerald' | 'amber' | 'sky';
  title: string;
  statusLabel?: string;
  statusTone?: 'emerald' | 'amber' | 'neutral';
  priceLabel?: string;
  visual: React.ReactNode;
  visualAspectClass?: string;
  headerAction?: React.ReactNode;
  extraFooter?: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  dataAttrs?: Record<string, string | undefined>;
}

/**
 * Editorial vertical hang-tag portrait card inspired by boutique 3D object cards:
 * matte porcelain surface, top-center punch-hole + hanging clasp, light-grey studio
 * visual stage, crisp dark title, and optional compact status/action footer.
 */
export const WalletAssetPortraitCard: React.FC<WalletAssetPortraitCardProps> = ({
  brandLabel,
  badgeLabel,
  badgeTone = 'neutral',
  title,
  statusLabel,
  statusTone = 'emerald',
  priceLabel,
  visual,
  visualAspectClass = 'aspect-[4/4.25]',
  headerAction,
  extraFooter,
  onClick,
  ariaLabel,
  className = '',
  dataAttrs,
}) => {
  const badgeClass =
    badgeTone === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-700'
      : badgeTone === 'amber'
        ? 'bg-amber-500/15 text-amber-800'
        : badgeTone === 'sky'
          ? 'bg-sky-500/12 text-sky-800'
          : 'bg-neutral-900/[0.06] text-neutral-700';

  const statusClass =
    statusTone === 'amber'
      ? 'text-amber-600'
      : statusTone === 'neutral'
        ? 'text-neutral-500'
        : 'text-emerald-600';

  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': ariaLabel ?? title,
        onClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <div
      {...dataAttrs}
      {...interactiveProps}
      className={`group/card relative flex flex-col rounded-[20px] bg-[#fafafa] text-neutral-900 border border-white/60 shadow-[0_10px_26px_rgba(0,0,0,0.28),0_1px_2px_rgba(0,0,0,0.14)] pt-5 px-3 pb-3 overflow-visible transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(0,0,0,0.34)] ${
        onClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/80' : ''
      } ${className}`}
    >
      {/* Signature Hang-Tag Lanyard Clasp + Recessed Punch Hole */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-20"
      >
        <span className="w-[1.5px] h-2 -mt-2 bg-white/65" />
        <span className="w-[5px] h-3 -mt-0.5 rounded-b-full rounded-t-[2px] bg-gradient-to-b from-neutral-900 via-neutral-700 to-neutral-950 ring-1 ring-white/25 shadow-[0_1px_3px_rgba(0,0,0,0.45)] relative z-10" />
        <span className="w-3.5 h-3.5 -mt-2 rounded-full bg-[#e3e5ea] border border-black/[0.09] shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.22)]" />
      </div>

      {/* Minimal Top Brand / Category Header */}
      <div className="flex items-center justify-between gap-1.5 min-h-[16px]">
        <span className="text-[10px] font-bold tracking-[-0.015em] text-neutral-900 truncate">
          {brandLabel}
        </span>
        {badgeLabel && (
          <span
            className={`px-1.5 py-0.5 rounded-md font-semibold text-[9px] leading-none tracking-tight shrink-0 ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Light Studio Portrait Showcase Frame */}
      <div
        className={`relative mt-2 w-full ${visualAspectClass} rounded-[13px] bg-[#f0f1f4] overflow-hidden flex items-center justify-center`}
      >
        {visual}
      </div>

      {/* Editorial Title Row */}
      <div className="mt-2.5 flex items-start justify-between gap-1.5 flex-1">
        <div className="text-[12.5px] font-bold tracking-[-0.02em] text-neutral-950 leading-[1.2] line-clamp-2 min-w-0">
          {title}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {/* Status Footer (no price on owned cards) */}
      {(statusLabel || priceLabel) && (
        <div className="mt-2.5 pt-2 border-t border-black/[0.06] flex items-center justify-between gap-1 text-[10px] font-medium tabular-nums">
          {statusLabel ? (
            <span className={`${statusClass} font-semibold truncate`}>
              {statusLabel}
            </span>
          ) : (
            <span />
          )}
          {priceLabel && (
            <span className="text-neutral-600 font-medium shrink-0">
              {priceLabel}
            </span>
          )}
        </div>
      )}

      {extraFooter && <div className="mt-2">{extraFooter}</div>}
    </div>
  );
};
