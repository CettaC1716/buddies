import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Smartphone, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpDown, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import type { FishingPhaseState } from '../game/buddiesFishingMarket';

export type DeviceFormFactor = 'mobile' | 'tablet' | 'desktop';

interface MobileResponsiveControlsProps {
  /** True when the player is actively in the 3D world (after onboarding) */
  isGameplayActive: boolean;
  /** True when any full-screen modal (Wallet, Profile, Chat, Kiosk, Merchant) is open */
  isModalBlocking: boolean;
  /** Callback to trigger a buddy action such as 'jump' or 'pickupOrThrow' */
  onTriggerBuddyAction: (action: string) => void;
  /** Force the touch controls to show on desktop (Settings toggle) */
  forceShowJoystick?: boolean;
  /** True while the player is in the Warzone map - the camera flip is main-map only */
  isWarzoneActive?: boolean;
  /** Fishing context: while the player can fish, the round JUMP button becomes the fishing action (CAST / STRIKE / REEL) */
  canFish?: boolean;
  fishingPhase?: FishingPhaseState;
  fishingCastPower?: number;
  fishingBucketFull?: boolean;
  isHoldingReel?: boolean;
  onFishingStartCharge?: () => void;
  onFishingReleaseCharge?: () => void;
  onFishingSetHoldingReel?: (holding: boolean) => void;
  onFishingTriggerAction?: () => void;
  onFishingCancel?: () => void;
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
  forceShowJoystick,
  isWarzoneActive,
  canFish,
  fishingPhase = 'idle',
  fishingCastPower = 0,
  fishingBucketFull = false,
  isHoldingReel = false,
  onFishingStartCharge,
  onFishingReleaseCharge,
  onFishingSetHoldingReel,
  onFishingTriggerAction,
  onFishingCancel,
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
    (viewport.hasTouch || viewport.formFactor !== 'desktop' || viewport.width <= 1024 || Boolean(forceShowJoystick));

  // The controls layer is on for all of gameplay: on desktop the round button
  // (JUMP, or CAST near water) and the VIEW flip must exist even when the
  // joystick pad itself is hidden and the player is far from water.
  const showControlsLayer = isGameplayActive && !isModalBlocking;

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
          aria-label="Rotate Device to Landscape"
          data-portrait-rotate-overlay="true"
          className="fixed inset-0 z-[100000] bg-[#0b0e16]/95 text-white flex flex-col items-center justify-center p-6 pointer-events-auto select-none text-center"
        >
          <div className="w-full max-w-[260px] bg-[#14161d] border-4 border-black ring-4 ring-white shadow-[8px_8px_0_#000] px-6 py-7 flex flex-col items-center gap-4">
            {/* Rotating Device Graphic */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full border-2 border-dashed border-[#38bdf8]/45 animate-spin"
                style={{ animationDuration: '10s' }}
              />
              <div className="relative flex items-center justify-center w-18 h-18 bg-[#1e293b] border-3 border-black ring-2 ring-[#b8ff3c] shadow-[4px_4px_0_#000] rounded-2xl">
                <Smartphone
                  className="w-10 h-10 text-[#b8ff3c] stroke-[2.2] transition-transform duration-700 -rotate-90"
                  aria-hidden="true"
                />
                <RotateCcw
                  className="w-5 h-5 text-[#facc15] stroke-[2.8] absolute -top-2 -right-2 bg-black rounded-full p-0.5 border border-white"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Minimal Heading */}
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-wider text-white leading-tight">
                ROTATE YOUR SCREEN
              </h2>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#b8ff3c]">
                Landscape Mode
              </p>
            </div>

            {/* Compact Dismiss Button */}
            <button
              type="button"
              data-dismiss-portrait-overlay-btn="true"
              onClick={() => {
                soundEngine.playUiClick();
                setDismissedPortraitOverlay(true);
              }}
              className="-skew-x-6 w-full py-2 px-4 bg-[#1e293b] hover:bg-[#334155] text-white/90 font-black text-[11px] uppercase tracking-wider border-2 border-black shadow-[3px_3px_0_#000] cursor-pointer active:scale-95 transition-all"
            >
              <span className="skew-x-6 inline-block">SKIP</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. MOBILE & TABLET VIRTUAL MOVEMENT JOYSTICK (BOTTOM-LEFT, RAISED ABOVE CHAT BAR)
             + SEMI-TRANSPARENT TOUCH QUICK-ACTION BUTTONS (BOTTOM-RIGHT)
         ===================================================================== */}
      {showControlsLayer && (
        <div
          aria-label="Mobile & Tablet Touch Controls"
          data-mobile-controls-layer="true"
          data-device-form-factor={viewport.formFactor}
          className="fixed inset-0 pointer-events-none z-[25] select-none overflow-hidden"
        >
          <div
            className={`pointer-events-auto fixed ${
              !showMobileJoystick
                ? 'bottom-[64px] left-3'
                : isCompactLandscape
                  ? 'bottom-[64px] left-3.5'
                  : 'bottom-[74px] left-4 sm:bottom-20 sm:left-6'
            } flex flex-col items-center gap-1 touch-none transition-opacity duration-150 ${
              !showMobileJoystick
                ? 'opacity-95'
                : isJoystickActive
                  ? 'opacity-90'
                  : 'opacity-65 hover:opacity-85'
            }`}
          >
            {/* Camera View Flip (main map only): instant 180-degree side swap, not a rotation */}
            {!isWarzoneActive && (
              <button
                type="button"
                data-camera-flip-btn="true"
                aria-label="Flip camera view"
                title="Flip camera view (North <-> South)"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playUiClick();
                  window.dispatchEvent(new CustomEvent('camera-flip-view'));
                }}
                className={
                  showMobileJoystick
                    ? `${
                        isCompactLandscape ? 'w-9 h-9' : 'w-11 h-11'
                      } rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md active:scale-90 border border-white/40 text-white flex flex-col items-center justify-center cursor-pointer transition-all shadow-[0_6px_18px_rgba(8,12,20,0.35)]`
                    : '-skew-x-12 px-2.5 h-8 bg-white/15 hover:bg-white/25 backdrop-blur-md active:scale-95 border border-white/40 ring-1 ring-white/20 text-white flex items-center justify-center cursor-pointer transition-all shadow-[0_6px_18px_rgba(8,12,20,0.35)]'
                }
              >
                {showMobileJoystick ? (
                  <>
                    <ArrowUpDown className="w-4 h-4" aria-hidden="true" />
                    <span className="text-[6.5px] font-black uppercase tracking-wider leading-none mt-0.5">
                      View
                    </span>
                  </>
                ) : (
                  <span className="skew-x-12 flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#38bdf8]" aria-hidden="true" />
                    <span className="text-[10px] font-black uppercase tracking-wider leading-none">
                      VIEW
                    </span>
                  </span>
                )}
              </button>
            )}

            {/* Circular Semi-Transparent Joystick Touch Pad */}
            {showMobileJoystick && (
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
                isCompactLandscape ? 'w-24 h-24' : 'w-28 h-28 sm:w-30 sm:h-30'
              } rounded-full border-2 ${
                isSprinting
                  ? 'bg-[#14161d]/75 border-[#facc15] shadow-[0_0_12px_rgba(250,204,21,0.35)]'
                  : isJoystickActive
                    ? 'bg-[#14161d]/70 border-[#b8ff3c] shadow-[0_0_10px_rgba(184,255,60,0.3)]'
                    : 'bg-[#14161d]/60 border-white/50'
              } flex items-center justify-center cursor-grab active:cursor-grabbing transition-all`}
            >
              {/* Inner Crosshair Ring & Cardinal Direction Indicators */}
              <div className="absolute inset-3 rounded-full border border-dashed border-white/20 pointer-events-none" />
              <ArrowUp
                className="w-3 h-3 text-white/40 absolute top-1.5 left-1/2 -translate-x-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <ArrowDown
                className="w-3 h-3 text-white/40 absolute bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <ArrowLeft
                className="w-3 h-3 text-white/40 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <ArrowRight
                className="w-3 h-3 text-white/40 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />

              {/* Semi-Transparent Draggable Thumb Stick Knob */}
              <div
                data-mobile-joystick-knob="true"
                style={{
                  transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                }}
                className={`${
                  isCompactLandscape ? 'w-9 h-9' : 'w-11 h-11 sm:w-12 sm:h-12'
                } rounded-full ${
                  isSprinting
                    ? 'bg-[#facc15]/85 text-black border-2 border-white'
                    : isJoystickActive
                      ? 'bg-[#b8ff3c]/85 text-black border-2 border-white'
                      : 'bg-white/35 text-white border-2 border-white/65'
                } flex items-center justify-center font-black text-[8.5px] uppercase tracking-tighter pointer-events-none transition-colors`}
              >
                {isSprinting ? 'RUN' : 'MOVE'}
              </div>
            </div>
            )}
          </div>

          {/* BOTTOM-RIGHT: Mobile Touch Action Buttons (and Cast button when near water on any device) */}
          {(showMobileJoystick || canFish) && (
            <div
              className={`pointer-events-auto fixed ${
                !showMobileJoystick
                  ? isWarzoneActive
                    ? 'bottom-[96px] right-4'
                    : 'bottom-[68px] right-4'
                  : isCompactLandscape
                    ? 'bottom-[64px] right-3.5'
                    : 'bottom-[74px] right-4 sm:bottom-20 sm:right-6'
              } flex flex-col items-end gap-2 touch-none`}
            >
              {primaryContextualAction && showMobileJoystick && (
                <button
                  type="button"
                  data-mobile-interact-btn="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEngine.playUiClick();
                    onTriggerBuddyAction(primaryContextualAction.actionEvent);
                  }}
                  className="-skew-x-6 px-3 py-1.5 bg-[#facc15]/90 hover:bg-[#fde047] active:scale-95 text-black border-2 border-[#0d0f12] shadow-[3px_3px_0_#0d0f12] font-black text-[11px] uppercase tracking-wider cursor-pointer"
                >
                  <span className="skew-x-6 inline-block">
                    {primaryContextualAction.label}
                  </span>
                </button>
              )}

              {canFish ? (
                <button
                  type="button"
                  data-mobile-cast-btn="true"
                  disabled={
                    fishingPhase === 'casting' || (fishingPhase === 'idle' && fishingBucketFull)
                  }
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (fishingPhase === 'fighting') {
                      onFishingSetHoldingReel?.(true);
                    } else if (fishingPhase === 'idle' && !fishingBucketFull) {
                      onFishingStartCharge?.();
                    }
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (fishingPhase === 'fighting') {
                      onFishingSetHoldingReel?.(false);
                    } else if (fishingPhase === 'charging') {
                      onFishingReleaseCharge?.();
                    }
                  }}
                  onPointerLeave={() => {
                    if (fishingPhase === 'fighting') onFishingSetHoldingReel?.(false);
                  }}
                  onPointerCancel={() => {
                    if (fishingPhase === 'fighting') onFishingSetHoldingReel?.(false);
                  }}
                  onClick={() => onFishingTriggerAction?.()}
                  aria-label="Fishing action"
                  className={`${
                    isCompactLandscape ? 'w-16 h-16' : 'w-20 h-20'
                  } rounded-full active:scale-90 text-white border-2 font-black uppercase tracking-wider flex items-center justify-center cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,0,0,0.4)] ${
                    fishingPhase === 'bite'
                      ? 'bg-[#f59e0b]/95 border-white ring-4 ring-[#fde047] text-[11px]'
                      : fishingPhase === 'fighting'
                        ? 'bg-[#0d9488]/85 hover:bg-[#14b8a6]/90 border-white/80 text-[11.5px]'
                        : 'bg-[#0284c7]/85 hover:bg-[#0ea5e9]/90 border-white/80 text-[12.5px]'
                  }`}
                >
                  {fishingPhase === 'fighting'
                    ? isHoldingReel
                      ? 'REEL'
                      : 'HOLD'
                    : fishingPhase === 'bite'
                      ? 'STRIKE'
                      : fishingPhase === 'charging'
                        ? `${Math.round(fishingCastPower * 100)}%`
                        : fishingPhase === 'casting' || fishingPhase === 'nibble'
                          ? 'WAIT'
                          : fishingBucketFull
                            ? 'FULL'
                            : 'CAST'}
                </button>
              ) : showMobileJoystick ? (
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
                    isCompactLandscape ? 'w-16 h-16 text-[11.5px]' : 'w-20 h-20 text-[13px]'
                  } rounded-full bg-[#0284c7]/75 hover:bg-[#0ea5e9]/90 active:scale-90 text-white border-2 border-white/75 font-black uppercase tracking-wider flex items-center justify-center cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,0,0,0.35)]`}
                >
                  JUMP
                </button>
              ) : null}

              {canFish && (fishingPhase === 'casting' || fishingPhase === 'nibble') && (
                <button
                  type="button"
                  data-mobile-fishing-stop-btn="true"
                  aria-label="Stop fishing"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFishingCancel?.();
                  }}
                  className="mr-1.5 flex flex-col items-center gap-0.5 cursor-pointer active:scale-90 transition-all"
                >
                  <span className="w-10 h-10 rounded-full bg-[#ef4444]/95 hover:bg-[#ef4444] border-2 border-white/85 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                    <X className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    Stop
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
