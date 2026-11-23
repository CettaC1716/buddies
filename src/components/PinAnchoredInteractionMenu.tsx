import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getRadialPinScreenAnchor } from '../game/buddiesRadialInteractPinSystem';
import { soundEngine } from '../game/audio';

export interface PinAnchoredMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconWrapClassName?: string;
  pillAccentClassName?: string;
  badgeText?: string;
  badgeClassName?: string;
  dataAttr?: Record<string, string | undefined>;
  onSelect: () => void;
}

export interface PinAnchoredInteractionMenuProps {
  isOpen: boolean;
  anchorPinId: string | null;
  menuDataAttrs?: Record<string, string | undefined>;
  headerStrip?: React.ReactNode;
  items: PinAnchoredMenuItem[];
  onClose: () => void;
}

const DEFAULT_FALLBACK_RIGHT_X = 32;
const PIN_ORB_CENTER_OFFSET_Y = 51;

export const PinAnchoredInteractionMenu: React.FC<PinAnchoredInteractionMenuProps> = ({
  isOpen,
  anchorPinId,
  menuDataAttrs,
  headerStrip,
  items,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [placedLeftOfPin, setPlacedLeftOfPin] = useState<boolean>(false);
  const placedLeftRef = useRef<boolean>(false);
  const openedAtRef = useRef<number>(0);

  useLayoutEffect(() => {
    if (isOpen) {
      openedAtRef.current = performance.now();
    }
  }, [isOpen, anchorPinId]);

  useEffect(() => {
    if (!isOpen || !anchorPinId) return;

    const updatePosition = () => {
      const el = containerRef.current;
      if (!el) return;
      const anchor = getRadialPinScreenAnchor(anchorPinId);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = el.getBoundingClientRect();
      const menuW = rect.width > 0 ? rect.width : 232;
      const menuH = rect.height > 0 ? rect.height : Math.max(88, items.length * 44);

      if (!anchor) {
        // Fallback near upper-center if pin temporarily leaves projection for >350ms -> auto close
        if (performance.now() - openedAtRef.current > 450) {
          onClose();
          return;
        }
        const fx = Math.round(vw * 0.5 + 32);
        const fy = Math.round(Math.max(64, vh * 0.34 - menuH * 0.5));
        el.style.transform = `translate3d(${fx}px, ${fy}px, 0)`;
        el.style.opacity = '1';
        return;
      }

      if (!anchor.inRange && performance.now() - openedAtRef.current > 350) {
        onClose();
        return;
      }

      const rightX = anchor.screenX + DEFAULT_FALLBACK_RIGHT_X;
      const shouldFlipLeft = rightX + menuW > vw - 14 && anchor.screenX - DEFAULT_FALLBACK_RIGHT_X - menuW >= 12;
      if (placedLeftRef.current !== shouldFlipLeft) {
        placedLeftRef.current = shouldFlipLeft;
        setPlacedLeftOfPin(shouldFlipLeft);
      }

      const rawX = shouldFlipLeft
        ? anchor.screenX - DEFAULT_FALLBACK_RIGHT_X - menuW
        : rightX;
      const clampedX = Math.max(12, Math.min(vw - menuW - 12, rawX));

      const orbCenterY = anchor.screenY - PIN_ORB_CENTER_OFFSET_Y;
      const rawY = orbCenterY - menuH * 0.5;
      const clampedY = Math.max(58, Math.min(vh - menuH - 96, rawY));

      el.style.transform = `translate3d(${Math.round(clampedX)}px, ${Math.round(clampedY)}px, 0)`;
      el.style.opacity = '1';
    };

    let rafId = 0;
    const tick = () => {
      updatePosition();
      rafId = window.requestAnimationFrame(tick);
    };
    updatePosition();
    rafId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen, anchorPinId, items.length, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('[data-pin-anchored-menu="true"]') ||
        target.closest('[data-radial-interact-pin="true"]')
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !anchorPinId || items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      data-pin-anchored-menu="true"
      data-anchor-pin-id={anchorPinId}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        opacity: 0,
        willChange: 'transform, opacity',
      }}
      {...(menuDataAttrs ?? {})}
      className="z-40 pointer-events-auto select-none transition-opacity duration-150"
    >
      <div
        className={`flex items-stretch gap-2.5 ${
          placedLeftOfPin ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Reference vertical stem line beside the radial trigger pin */}
        <div
          aria-hidden="true"
          className="w-[2px] rounded-full bg-gradient-to-b from-white/25 via-white/85 to-white/25 shadow-[0_0_8px_rgba(255,255,255,0.4)] my-1.5 shrink-0"
        />

        {/* Stacked Frosted Rounded-Full Interaction Pills */}
        <div className="flex flex-col items-stretch gap-1.5 min-w-[206px] max-w-[264px]">
          {headerStrip}

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                item.onSelect();
              }}
              {...(item.dataAttr ?? {})}
              className={`h-9.5 px-3 rounded-full bg-[#f4f6f9]/92 hover:bg-white backdrop-blur-xl border shadow-[0_6px_20px_rgba(15,23,42,0.22)] flex items-center gap-2.5 text-slate-900 font-semibold text-[12px] tracking-tight cursor-pointer active:scale-[0.98] transition-all ${
                item.pillAccentClassName ?? 'border-white/95'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  item.iconWrapClassName ?? 'bg-slate-200/80 text-slate-800'
                }`}
              >
                {item.icon}
              </span>
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.badgeText && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-tabular shrink-0 ${
                    item.badgeClassName ?? 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.badgeText}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
