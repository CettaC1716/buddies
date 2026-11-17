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
      {/* Vehicle Selector Popover (same Neo-Brutalist style as Audio Volume Mixer) */}
      {isOpen && (
        <div
          role="region"
          aria-label="Quick Mount Vehicle Selector"
          data-hud-scooter-popover="true"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`absolute right-0 ${
            popoverPlacement === 'bottom' ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
          } z-50 w-[256px] bg-[#14161d] text-white border-3 border-black ring-2 ring-white shadow-[5px_5px_0_#000] p-3 space-y-2`}
        >
          <div className="flex items-center justify-between border-b border-white/15 pb-1.5">
            <span className="text-[11px] font-black tracking-wide text-white whitespace-nowrap">
              Quick Mount
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Quick Mount Selector"
              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-[10px] font-black text-slate-200 border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
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
                  className={`flex items-center justify-between gap-2 p-2 border ${
                    isMountedThis
                      ? 'bg-[#1c2820] border-[#b8ff3c]'
                      : 'bg-[#1f2430] border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 flex items-center justify-center border shrink-0 ${
                        isMountedThis
                          ? 'bg-[#14161d] border-[#b8ff3c] text-[#b8ff3c]'
                          : isOwned
                            ? 'bg-[#14161d] border-white/25 text-[#38bdf8]'
                            : 'bg-[#14161d] border-white/15 text-slate-400'
                      }`}
                    >
                      <VehIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {shortLabel}
                      </div>
                      <div className="text-[10px] font-semibold truncate">
                        {isMountedThis ? (
                          <span className="text-[#b8ff3c]">Riding now</span>
                        ) : isOwned ? (
                          canMountOutdoors ? (
                            <span className="text-slate-400">Owned · Ready</span>
                          ) : (
                            <span className="text-amber-300">Outdoor only</span>
                          )
                        ) : (
                          <span className="text-slate-400 tabular-nums">
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
                      className="px-2 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white border border-black text-[10px] font-black cursor-pointer whitespace-nowrap shrink-0"
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
                          ? 'px-2.5 py-1 bg-[#b8ff3c] hover:bg-[#d9f99d] text-black border border-black text-[10px] font-black cursor-pointer whitespace-nowrap shrink-0'
                          : 'px-2 py-1 bg-white/5 text-slate-500 border border-white/10 text-[10px] font-bold cursor-not-allowed whitespace-nowrap shrink-0'
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
                      className="px-2 py-1 bg-[#272c3a] hover:bg-[#333a4d] text-[#38bdf8] border border-white/25 text-[10px] font-black cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Shop
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap shrink-0">
                      Locked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Neo-Brutalist Quick Mount Scooter Button `[🛵]` */}
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
        className="-skew-x-6 relative w-10 h-10 flex items-center justify-center bg-[#14161d] hover:bg-[#1f2430] text-white border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3c]"
      >
        <span className="skew-x-6 relative flex items-center justify-center">
          <ActiveButtonIcon
            className={`w-[18px] h-[18px] ${
              isRiding
                ? 'text-[#b8ff3c]'
                : quickTargetKind
                  ? 'text-[#38bdf8]'
                  : 'text-slate-300'
            }`}
          />
        </span>
        {/* Bottom miniature status bar matching Sound FX button */}
        <span
          aria-hidden="true"
          className="absolute bottom-[2px] left-1 right-1 h-[2.5px] bg-white/15 overflow-hidden"
        >
          <span
            className={`block h-full ${isRiding ? 'bg-[#b8ff3c]' : 'bg-[#38bdf8]'}`}
            style={{ width: isRiding || quickTargetKind ? '100%' : '0%' }}
          />
        </span>
      </button>
    </div>
  );
}
