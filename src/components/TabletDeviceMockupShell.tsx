import React from 'react';
import { BatteryCharging, Wifi, X } from 'lucide-react';
import { soundEngine } from '../game/audio';

export interface TabletDeviceMockupShellProps {
  /** Brand app label shown in top OS status bar (e.g. "TRANSIT KIOSK", "ESTATE STUDIO") */
  appLabel: string;
  /** Main header title inside the tablet app toolbar */
  title: React.ReactNode;
  /** Subtitle / location line under title */
  subtitle?: React.ReactNode;
  /** Icon rendered inside rounded app badge next to title */
  headerIcon?: React.ReactNode;
  /** Optional left-side Back button inside toolbar */
  backButton?: React.ReactNode;
  /** Optional right-side balance / action chips inside toolbar */
  headerRight?: React.ReactNode;
  /** Optional sub-bar (e.g., category tabs) inside tablet screen */
  subHeader?: React.ReactNode;
  /** Optional fixed footer bar (e.g., search/filter bar or selector strip) above home indicator */
  footer?: React.ReactNode;
  /** Close handler */
  onClose: () => void;
  /** Close button aria-label */
  closeAriaLabel?: string;
  /** Data attributes forwarded to the close button so existing test selectors remain intact */
  closeButtonProps?: Record<string, string | boolean | undefined>;
  /** Max width utility (defaults to "max-w-5xl") */
  maxWidthClass?: string;
  /** Height utility (defaults to "max-h-[90vh]") */
  heightClass?: string;
  /** Main scrollable/flex viewport content */
  children: React.ReactNode;
}

export const TabletDeviceMockupShell: React.FC<TabletDeviceMockupShellProps> = ({
  appLabel,
  title,
  subtitle,
  headerIcon,
  backButton,
  headerRight,
  subHeader,
  footer,
  onClose,
  closeAriaLabel = 'Close',
  closeButtonProps,
  maxWidthClass = 'max-w-5xl',
  heightClass = 'max-h-[90vh]',
  children,
}) => {
  const now = new Date();
  const clockLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative w-full ${maxWidthClass} ${heightClass} rounded-[32px] overflow-hidden flex flex-col bg-[#141926]/68 backdrop-blur-2xl border border-white/25 shadow-[0_24px_70px_rgba(0,0,0,0.52)] text-white select-none`}
    >
      {/* Persistent Tablet OS Status Bar (matching SmartphoneOsModal BLITZ OS) */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 pt-3 pb-2 border-b border-white/[0.12] text-[10.5px] font-medium text-white/90">
        <div className="flex items-center gap-1.5 min-w-0">
          <Wifi className="w-3 h-3 text-white/85 shrink-0" aria-hidden="true" />
          <span className="tracking-wider font-semibold text-white">BLITZ PAD</span>
          <span className="text-white/40" aria-hidden="true">·</span>
          <span className="uppercase tracking-wider text-white/70 truncate">{appLabel}</span>
        </div>

        <span className="hidden sm:inline font-mono tabular-nums font-semibold text-white/90">
          {clockLabel}
        </span>

        <div className="flex items-center gap-2 shrink-0 text-white/85">
          <span className="hidden xs:inline font-mono text-[10px] text-sky-300/90">5G</span>
          <div className="flex items-center gap-1 font-mono tabular-nums">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>94%</span>
          </div>
        </div>
      </div>

      {/* Tablet App Navigation Toolbar */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-white/[0.03] border-b border-white/[0.12]">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {backButton}
          {headerIcon && (
            <div className="w-9 h-9 rounded-2xl bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center shrink-0 shadow-xs">
              {headerIcon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-white leading-snug">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-white/60 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          <button
            type="button"
            aria-label={closeAriaLabel}
            onClick={() => {
              soundEngine.playUiCancel();
              onClose();
            }}
            {...closeButtonProps}
            className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/25 text-white/85 hover:text-white border border-white/20 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Optional Category Tab Bar / Sub-Header */}
      {subHeader}

      {/* App Viewport Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>

      {/* Optional Fixed Footer Strip */}
      {footer}

      {/* Tablet Home Indicator Bar */}
      <div
        aria-hidden="true"
        className="shrink-0 h-5 flex items-center justify-center border-t border-white/10"
      >
        <span className="w-28 sm:w-36 h-1 rounded-full bg-white/30" />
      </div>
    </div>
  );
};
