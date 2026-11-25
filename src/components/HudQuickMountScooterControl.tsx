import { useEffect, useRef, useState } from 'react';
import {
  URBAN_SCOOTER_CATALOG_ITEMS,
  type UrbanScooterKind,
} from '../game/buddiesUrbanScooterRules';

export interface HudQuickMountScooterControlProps {
  ownedScooterIds: readonly string[];
  equippedScooterKind: UrbanScooterKind | null;
  preferredScooterKind: UrbanScooterKind;
  canMountOutdoors: boolean;
  popoverPlacement?: 'top' | 'bottom';
  onEquipScooter: (kind: UrbanScooterKind) => void;
  onDismountScooter: () => void;
  onLocateShowroom?: () => void;
}

function ElectricScooterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5.5" cy="17.5" r="3" />
      <circle cx="18.5" cy="17.5" r="3" />
      <path d="M15 6h3.5l2 7.5" />
      <path d="M5.5 14.5h5.5l2.5-4.5H9.5" />
      <path d="M8.5 14.5L10 10H6.5a2 2 0 0 0-2 2v2.5" />
      <path d="M13.5 14.5h2.2l1.6-4" />
    </svg>
  );
}

function PushKickScooterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="18" r="2.6" />
      <circle cx="18" cy="18" r="2.6" />
      <path d="M8.6 18h6.8" />
      <path d="M17.5 15.4L15.4 5.5" />
      <path d="M13 5.5h4.5" />
      <path d="M6 15.4a3.2 3.2 0 0 1 3.2 2.6" />
    </svg>
  );
}

/**
 * Neo-Brutalist HUD Quick Mount Scooter Button & Vehicle Selector Popover.
 * Matches `HudAudioVolumeControl` visual architecture (`#14161d` card, `border-3 border-black`,
 * `ring-2 ring-white`, `shadow-[5px_5px_0_#000]`, zero `backdrop-filter` over WebGL).
 */
export function HudQuickMountScooterControl({
  ownedScooterIds,
  equippedScooterKind,
  preferredScooterKind,
  canMountOutdoors,
  popoverPlacement = 'top',
  onEquipScooter,
  onDismountScooter,
  onLocateShowroom,
}: HudQuickMountScooterControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeHoverTimerRef = useRef<number | null>(null);

  const ownedItems = URBAN_SCOOTER_CATALOG_ITEMS.filter((item) =>
    ownedScooterIds.includes(item.id),
  );
  const quickTargetKind: UrbanScooterKind | null =
    ownedItems.find((item) => item.kind === preferredScooterKind)?.kind ??
    ownedItems[0]?.kind ??
    null;

  const clearHoverTimer = () => {
    if (closeHoverTimerRef.current !== null) {
      window.clearTimeout(closeHoverTimerRef.current);
      closeHoverTimerRef.current = null;
    }
  };

  const openPopover = () => {
    setIsOpen(true);
    window.dispatchEvent(
      new CustomEvent('hud-corner-popover-open', { detail: 'scooter' }),
    );
  };

  useEffect(() => {
    const onOtherPopoverOpen = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && detail !== 'scooter') {
        clearHoverTimer();
        setIsOpen(false);
      }
    };
    window.addEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    return () => {
      window.removeEventListener('hud-corner-popover-open', onOtherPopoverOpen);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDownOutside = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDownOutside, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDownOutside, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeHoverTimerRef.current !== null) {
        window.clearTimeout(closeHoverTimerRef.current);
      }
    };
  }, []);

  const isRiding = equippedScooterKind !== null;
  const ActiveButtonIcon =
    (equippedScooterKind ?? quickTargetKind) === 'push_kick_scooter'
      ? PushKickScooterIcon
      : ElectricScooterIcon;

  return (
    <div
      ref={rootRef}
      data-hud-scooter-controls="true"
      data-scooter-popover-open={isOpen ? 'true' : 'false'}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') {
          clearHoverTimer();
          openPopover();
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          clearHoverTimer();
          closeHoverTimerRef.current = window.setTimeout(() => {
            setIsOpen(false);
          }, 220);
        }
      }}
      className="relative flex items-center select-none pointer-events-auto"
    >
      {/* Vehicle Selector Popover (Dark Frosted Glass) */}
      {isOpen && (
        <div
          role="region"
          aria-label="Quick Mount Vehicle Selector"
          data-hud-scooter-popover="true"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`absolute right-0 ${
            popoverPlacement === 'bottom' ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          } z-50 w-[262px] rounded-2xl bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 text-white border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)] p-3.5 space-y-2.5`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-semibold tracking-tight text-white whitespace-nowrap">
              Quick Mount
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Quick Mount Selector"
              className="px-2 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-[10px] font-medium text-white/85 border border-white/10 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              Done
            </button>
          </div>

          <div className="space-y-1.5">
            {URBAN_SCOOTER_CATALOG_ITEMS.map((veh) => {
              const isOwned = ownedScooterIds.includes(veh.id);
              const isMountedThis = equippedScooterKind === veh.kind;
              const shortLabel =
                veh.kind === 'electric_scooter_bike'
                  ? 'Electric Scooter'
                  : 'Push Kick Scooter';
              const VehIcon =
                veh.kind === 'push_kick_scooter'
                  ? PushKickScooterIcon
                  : ElectricScooterIcon;

              return (
                <div
                  key={veh.id}
                  data-quick-mount-item={veh.kind}
                  className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition-colors ${
                    isMountedThis
                      ? 'bg-emerald-400/12 border-emerald-300/45'
                      : 'bg-white/[0.05] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${
                        isMountedThis
                          ? 'bg-emerald-400/20 border-emerald-300/60 text-emerald-200'
                          : isOwned
                            ? 'bg-white/[0.08] border-white/15 text-sky-300'
                            : 'bg-white/[0.04] border-white/10 text-white/40'
                      }`}
                    >
                      <VehIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white/95 truncate">
                        {shortLabel}
                      </div>
                      <div className="text-[10px] font-normal truncate">
                        {isMountedThis ? (
                          <span className="text-emerald-300">Riding now</span>
                        ) : isOwned ? (
                          canMountOutdoors ? (
                            <span className="text-white/50">Owned · Ready</span>
                          ) : (
                            <span className="text-amber-300">Outdoor only</span>
                          )
                        ) : (
                          <span className="text-white/45 tabular-nums">
                            {veh.priceRespite} RESPITE · Showroom
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isMountedThis ? (
                    <button
                      type="button"
                      data-quick-mount-off={veh.kind}
                      onClick={() => {
                        onDismountScooter();
                        setIsOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-full bg-rose-500/80 hover:bg-rose-500 text-white text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      Off
                    </button>
                  ) : isOwned ? (
                    <button
                      type="button"
                      disabled={!canMountOutdoors}
                      data-quick-mount-ride={veh.kind}
                      onClick={() => {
                        if (!canMountOutdoors) return;
                        onEquipScooter(veh.kind);
                        setIsOpen(false);
                      }}
                      className={
                        canMountOutdoors
                          ? 'px-2.5 py-1 rounded-full bg-emerald-400/90 hover:bg-emerald-300 text-slate-950 text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors'
                          : 'px-2.5 py-1 rounded-full bg-white/5 text-white/35 border border-white/10 text-[10px] font-medium cursor-not-allowed whitespace-nowrap shrink-0'
                      }
                    >
                      Ride
                    </button>
                  ) : onLocateShowroom && canMountOutdoors ? (
                    <button
                      type="button"
                      data-quick-mount-shop={veh.kind}
                      onClick={() => {
                        onLocateShowroom();
                        setIsOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-full bg-white/[0.1] hover:bg-white/[0.2] text-sky-300 border border-white/15 text-[10px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                    >
                      Shop
                    </button>
                  ) : (
                    <span className="text-[10px] font-medium text-white/40 whitespace-nowrap shrink-0">
                      Locked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Frosted Glass Quick Mount Scooter Button */}
      <button
        type="button"
        data-hud-scooter-quick-mount="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.currentTarget.blur();
          if (!isOpen) {
            openPopover();
            return;
          }
          if (isRiding) {
            onDismountScooter();
            return;
          }
          if (quickTargetKind && canMountOutdoors) {
            onEquipScooter(quickTargetKind);
            setIsOpen(false);
          }
        }}
        aria-label={
          isRiding
            ? 'Dismount Scooter or Switch Vehicle'
            : quickTargetKind
              ? 'Quick Mount Scooter'
              : 'Select Vehicle'
        }
        title={
          isRiding
            ? 'Riding Scooter (Click to dismount or choose vehicle)'
            : quickTargetKind
              ? canMountOutdoors
                ? 'Quick Mount Scooter (Click to ride or choose vehicle)'
                : 'Step outside to mount your scooter'
              : 'Vehicles — Buy a scooter at Central Plaza Showroom'
        }
        className={`relative w-9 h-9 rounded-full flex items-center justify-center border shadow-[0_6px_20px_rgba(0,0,0,0.35)] cursor-pointer active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 ${
          isRiding
            ? 'bg-emerald-400/22 hover:bg-emerald-400/32 border-emerald-300/60 text-emerald-200'
            : isOpen
              ? 'bg-[#1c2436]/92 border-white/35 text-white'
              : 'bg-[#111622]/86 hover:bg-[#192133]/92 border-white/22 hover:border-white/35 text-white'
        }`}
      >
        <ActiveButtonIcon
          className={`w-[17px] h-[17px] ${
            isRiding
              ? 'text-emerald-200'
              : quickTargetKind
                ? 'text-white/92'
                : 'text-white/55'
          }`}
        />
        {isRiding && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0d1118]"
          />
        )}
      </button>
    </div>
  );
}
