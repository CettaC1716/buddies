import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Smartphone, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { soundEngine } from '../game/audio';

export type DeviceFormFactor = 'mobile' | 'tablet' | 'desktop';

interface MobileResponsiveControlsProps {
  /** True when the player is actively in the 3D world (after onboarding) */
  isGameplayActive: boolean;
  /** True when any full-screen modal (Wallet, Profile, Chat, Kiosk, Merchant) is open */
  isModalBlocking: boolean;
  /** Callback to trigger a buddy action such as 'jump' or 'pickupOrThrow' */
  onTriggerBuddyAction: (action: string) => void;
  /** Optional primary contextual floating prompt action (e.g. Enter Room, Fish, Grab) */
  primaryContextualAction?: {
    label: string;
    actionEvent: string;
  } | null;
}

export const MobileResponsiveControls: React.FC<MobileResponsiveControlsProps> = ({
  isGameplayActive,
  isModalBlocking,
  onTriggerBuddyAction,
  primaryContextualAction,
}) => {
  const [viewport, setViewport] = useState<{
    width: number;
    height: number;
    isPortrait: boolean;
    hasTouch: boolean;
    formFactor: DeviceFormFactor;
  }>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1280,
        height: 720,
        isPortrait: false,
        hasTouch: false,
        formFactor: 'desktop',
      };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const coarse =
      typeof window.matchMedia === 'function' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(hover: none)').matches);
    const touchPoints =
      typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
    const hasTouch = Boolean(coarse || touchPoints || 'ontouchstart' in window);
    const minDim = Math.min(w, h);
    const maxDim = Math.max(w, h);
    const formFactor: DeviceFormFactor =
      minDim < 600 || (hasTouch && maxDim <= 932)
        ? 'mobile'
        : maxDim <= 1180 && (hasTouch || w <= 1024)
          ? 'tablet'
          : 'desktop';
    return {
      width: w,
      height: h,
      isPortrait: h > w && w < 1024,
      hasTouch,
      formFactor,
    };
  });

  const [dismissedPortraitOverlay, setDismissedPortraitOverlay] = useState(false);

  // Virtual Joystick State
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  const emitJoystickVector = useCallback((normX: number, normFwd: number, sprint: boolean) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('mobile-joystick-input', {
        detail: {
          x: normX,
          y: normFwd,
          sprint,
        },
      }),
    );
  }, []);

  const resetJoystick = useCallback(() => {
    activePointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    setIsJoystickActive(false);
    setIsSprinting(false);
    emitJoystickVector(0, 0, false);
  }, [emitJoystickVector]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const coarse =
        typeof window.matchMedia === 'function' &&
        (window.matchMedia('(pointer: coarse)').matches ||
          window.matchMedia('(hover: none)').matches);
      const touchPoints =
        typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
      const hasTouch = Boolean(coarse || touchPoints || 'ontouchstart' in window);
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);
      const formFactor: DeviceFormFactor =
        minDim < 600 || (hasTouch && maxDim <= 932)
          ? 'mobile'
          : maxDim <= 1180 && (hasTouch || w <= 1024)
            ? 'tablet'
            : 'desktop';
      const nextIsPortrait = h > w && w < 1024;

      setViewport((prev) => {
        if (!prev.isPortrait && nextIsPortrait) {
          setDismissedPortraitOverlay(false);
        }
        return {
          width: w,
          height: h,
          isPortrait: nextIsPortrait,
          hasTouch: prev.hasTouch || hasTouch,
          formFactor,
        };
      });
    };

    const onFirstTouch = () => {
      setViewport((prev) => (prev.hasTouch ? prev : { ...prev, hasTouch: true }));
    };

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.addEventListener('touchstart', onFirstTouch, { passive: true });
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.removeEventListener('touchstart', onFirstTouch);
    };
  }, []);

  // Reset joystick whenever gameplay pauses, a modal opens, or portrait overlay triggers
  useEffect(() => {
    if (!isGameplayActive || isModalBlocking || (viewport.isPortrait && !dismissedPortraitOverlay)) {
      resetJoystick();
    }
  }, [isGameplayActive, isModalBlocking, viewport.isPortrait, dismissedPortraitOverlay, resetJoystick]);

  const updateJoystickFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const baseEl = joystickBaseRef.current;
      if (!baseEl) return;
      const rect = baseEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = Math.max(28, rect.width * 0.36);

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const dist = Math.hypot(rawDx, rawDy);

      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(rawDy, rawDx);
      const clampedX = Math.cos(angle) * clampedDist;
      const clampedY = Math.sin(angle) * clampedDist;

      setKnobOffset({ x: clampedX, y: clampedY });

      const normalizedMag = clampedDist / maxRadius;
      if (normalizedMag < 0.1) {
        setIsSprinting(false);
        emitJoystickVector(0, 0, false);
        return;
      }

      const normX = Number((clampedX / maxRadius).toFixed(3));
      // Up on screen (negative Y) = Forward (+1)
      const normFwd = Number((-clampedY / maxRadius).toFixed(3));
      const sprint = normalizedMag >= 0.82;
      setIsSprinting(sprint);
      emitJoystickVector(normX, normFwd, sprint);
    },
    [emitJoystickVector],
  );

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore capture errors on synthetic events
    }
    setIsJoystickActive(true);
    updateJoystickFromClientPoint(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    updateJoystickFromClientPoint(e.clientX, e.clientY);
  };

  const handleJoystickPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    resetJoystick();
  };

  const showMobileJoystick =
    isGameplayActive &&
    !isModalBlocking &&
    (viewport.hasTouch || viewport.formFactor !== 'desktop' || viewport.width <= 1024);

  const isCompactLandscape = viewport.height <= 460;

  return (
    <>
      {/* =====================================================================
          1. PORTRAIT ORIENTATION WARNING OVERLAY (ENGLISH)
             Forces/guides mobile & tablet players in Portrait mode to rotate
             their screen to Horizontal (Landscape) orientation.
         ===================================================================== */}
      {viewport.isPortrait && !dismissedPortraitOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Please Rotate Your Device to Landscape Mode"
          data-portrait-rotate-overlay="true"
          className="fixed inset-0 z-[100000] bg-[#0b0e16]/96 backdrop-blur-md text-white flex flex-col items-center justify-center p-6 pointer-events-auto select-none text-center"
        >
          <div className="w-full max-w-sm bg-[#14161d] border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] p-6 flex flex-col items-center gap-4">
            {/* Top Badge */}
            <div className="-skew-x-12 px-3.5 py-1 bg-[#facc15] text-black border-2 border-black shadow-[3px_3px_0_#000] font-black text-[11px] uppercase tracking-widest">
              <span className="skew-x-12 inline-block">LANDSCAPE VIEW REQUIRED</span>
            </div>

            {/* Animated Rotating Device Graphic */}
            <div className="relative w-28 h-28 flex items-center justify-center my-1">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#38bdf8]/45 animate-spin" style={{ animationDuration: '10s' }} />
              <div className="relative flex items-center justify-center w-20 h-20 bg-[#1e293b] border-3 border-black ring-2 ring-[#b8ff3c] shadow-[4px_4px_0_#000] rounded-2xl">
                <Smartphone
                  className="w-11 h-11 text-[#b8ff3c] stroke-[2.2] transition-transform duration-700 -rotate-90 animate-pulse"
                  aria-hidden="true"
                />
                <RotateCcw
                  className="w-5 h-5 text-[#facc15] stroke-[2.8] absolute -top-2 -right-2 bg-black rounded-full p-0.5 border border-white"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* English Heading & Instructions */}
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-wide text-white leading-tight">
                PLEASE ROTATE YOUR SCREEN
              </h2>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#b8ff3c]">
                Switch to Horizontal (Landscape) Mode
              </p>
              <p className="text-xs font-bold text-slate-300 leading-relaxed">
                Buddies Blitz is designed for Horizontal (Landscape) display on mobile and tablet devices. Please turn your device sideways for full 3D controls and visibility.
              </p>
            </div>

            {/* Viewport Status Pill */}
            <div className="w-full py-2 px-3 bg-black/50 border border-white/20 text-[10.5px] font-mono font-bold text-[#38bdf8]">
              CURRENT: PORTRAIT ({viewport.width}×{viewport.height}) → ROTATE 90°
            </div>

            {/* Fallback Dismiss Button (e.g. if orientation lock is active on desktop/tablet) */}
            <button
              type="button"
              data-dismiss-portrait-overlay-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                setDismissedPortraitOverlay(true);
              }}
              className="-skew-x-6 w-full py-2 px-4 bg-[#1e293b] hover:bg-[#334155] text-white/85 font-black text-[10.5px] uppercase tracking-wider border-2 border-black shadow-[3px_3px_0_#000] cursor-pointer active:scale-95 transition-all"
            >
              <span className="skew-x-6 inline-block">CONTINUE IN CURRENT VIEW</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. MOBILE & TABLET VIRTUAL MOVEMENT JOYSTICK (BOTTOM-LEFT)
             + TOUCH QUICK-ACTION BUTTONS (BOTTOM-RIGHT)
         ===================================================================== */}
      {showMobileJoystick && (
        <div
          aria-label="Mobile & Tablet Touch Controls"
          data-mobile-controls-layer="true"
          data-device-form-factor={viewport.formFactor}
          className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden"
        >
          {/* BOTTOM-LEFT: 360° Analog Virtual Movement Joystick */}
          <div
            className={`pointer-events-auto fixed ${
              isCompactLandscape ? 'bottom-3 left-3' : 'bottom-5 left-5 sm:bottom-6 sm:left-6'
            } flex flex-col items-center gap-1 touch-none`}
          >
            {/* Status Pill Above Joystick */}
            <div className="-skew-x-12 px-2 py-0.5 bg-[#12151c]/90 text-white border border-black shadow-[2px_2px_0_#000] text-[9px] font-black uppercase tracking-wider">
              <span className="skew-x-12 inline-block">
                {isJoystickActive ? (isSprinting ? '⚡ SPRINTING' : '● MOVING') : 'MOVE JOYSTICK'}
              </span>
            </div>

            {/* Circular Joystick Touch Pad */}
            <div
              ref={joystickBaseRef}
              role="application"
              aria-label="Virtual Movement Joystick"
              data-mobile-joystick="true"
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUpOrCancel}
              onPointerCancel={handleJoystickPointerUpOrCancel}
              style={{ touchAction: 'none' }}
              className={`relative ${
                isCompactLandscape ? 'w-24 h-24' : 'w-28 h-28 sm:w-32 sm:h-32'
              } rounded-full bg-[#12151c]/75 border-3 border-black ring-2 ${
                isSprinting
                  ? 'ring-[#facc15] shadow-[0_0_14px_rgba(250,204,21,0.55)]'
                  : isJoystickActive
                    ? 'ring-[#b8ff3c] shadow-[0_0_12px_rgba(184,255,60,0.45)]'
                    : 'ring-white/75 shadow-[4px_4px_0_#000]'
              } backdrop-blur-xs flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow`}
            >
              {/* Inner Crosshair Ring & Cardinal Direction Indicators */}
              <div className="absolute inset-3 rounded-full border border-dashed border-white/25 pointer-events-none" />
              <ArrowUp
                className="w-3.5 h-3.5 text-white/45 absolute top-1.5 left-1/2 -translate-x-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <ArrowDown
                className="w-3.5 h-3.5 text-white/45 absolute bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <ArrowLeft
                className="w-3.5 h-3.5 text-white/45 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <ArrowRight
                className="w-3.5 h-3.5 text-white/45 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />

              {/* Draggable Thumb Stick Knob */}
              <div
                data-mobile-joystick-knob="true"
                style={{
                  transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                }}
                className={`${
                  isCompactLandscape ? 'w-10 h-10' : 'w-12 h-12 sm:w-13 sm:h-13'
                } rounded-full ${
                  isSprinting
                    ? 'bg-[#facc15] text-black'
                    : 'bg-[#b8ff3c] text-black'
                } border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] flex items-center justify-center font-black text-[9px] uppercase tracking-tighter pointer-events-none transition-colors`}
              >
                {isSprinting ? 'RUN' : 'GO'}
              </div>
            </div>
          </div>

          {/* BOTTOM-RIGHT: Mobile Touch Action Buttons (Jump & Contextual Interact) */}
          <div
            className={`pointer-events-auto fixed ${
              isCompactLandscape ? 'bottom-14 right-3' : 'bottom-16 right-4 sm:bottom-20 sm:right-5'
            } flex flex-col items-end gap-2 touch-none`}
          >
            {primaryContextualAction && (
              <button
                type="button"
                data-mobile-interact-btn="true"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playUiClick();
                  onTriggerBuddyAction(primaryContextualAction.actionEvent);
                }}
                className="-skew-x-6 px-3.5 py-2 bg-[#facc15] hover:bg-[#fde047] active:scale-95 text-black border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                <span className="skew-x-6 inline-block">
                  {primaryContextualAction.label}
                </span>
              </button>
            )}

            <button
              type="button"
              data-mobile-jump-btn="true"
              onPointerDown={(e) => {
                e.stopPropagation();
                soundEngine.playUiClick();
                onTriggerBuddyAction('jump');
              }}
              aria-label="Jump"
              className={`${
                isCompactLandscape ? 'w-12 h-12 text-[10px]' : 'w-14 h-14 text-xs'
              } rounded-full bg-[#38bdf8] hover:bg-[#7dd3fc] active:scale-90 text-black border-3 border-black ring-2 ring-white shadow-[3px_3px_0_#000] font-black uppercase tracking-wider flex items-center justify-center cursor-pointer`}
            >
              JUMP
            </button>
          </div>
        </div>
      )}
    </>
  );
};
