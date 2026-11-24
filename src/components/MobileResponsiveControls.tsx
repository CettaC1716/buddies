import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import type { FishingPhaseState } from '../game/buddiesFishingMarket';
import { useAdaptiveViewport } from '../lib/useAdaptiveViewport';

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
  /** True while the player is in the Warzone map */
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
  const adaptive = useAdaptiveViewport();
  const formFactor: DeviceFormFactor =
    adaptive.device === 'phone' ? 'mobile' : adaptive.device;

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

  // Reset joystick whenever gameplay pauses or a blocking modal opens
  useEffect(() => {
    if (!isGameplayActive || isModalBlocking) {
      resetJoystick();
    }
  }, [isGameplayActive, isModalBlocking, resetJoystick]);

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
    (adaptive.showTouchControls || Boolean(forceShowJoystick));

  // Render touch controls during active gameplay whenever the joystick pad or shoreline fishing Cast button is active.
  const showControlsLayer =
    isGameplayActive && !isModalBlocking && (showMobileJoystick || canFish);

  const isCompactLandscape = adaptive.isCompactHeight;
  const isPhonePortrait = adaptive.isPhonePortrait;
  const isTablet = adaptive.isTablet;

  return (
    <>
      {/* =====================================================================
          MOBILE & TABLET VIRTUAL MOVEMENT JOYSTICK (BOTTOM-LEFT, RAISED ABOVE CHAT BAR)
          + SEMI-TRANSPARENT TOUCH QUICK-ACTION BUTTONS (BOTTOM-RIGHT)
          Works natively in both Portrait and Landscape with safe-area insets.
         ===================================================================== */}
      {showControlsLayer && (
        <div
          aria-label="Mobile & Tablet Touch Controls"
          data-mobile-controls-layer="true"
          data-device-form-factor={formFactor}
          data-device-orientation={adaptive.orientation}
          className="fixed inset-0 pointer-events-none z-[25] select-none overflow-hidden"
        >
          {showMobileJoystick && (
            <div
              style={{
                left: isTablet
                  ? 'max(1.25rem, var(--safe-left))'
                  : 'max(0.75rem, var(--safe-left))',
                bottom: isCompactLandscape
                  ? 'calc(58px + var(--safe-bottom))'
                  : isPhonePortrait
                    ? 'calc(68px + var(--safe-bottom))'
                    : isTablet
                      ? 'calc(92px + var(--safe-bottom))'
                      : 'calc(104px + var(--safe-bottom))',
              }}
              className="pointer-events-auto fixed flex flex-col items-start gap-2.5 touch-none"
            >
              <div className="flex flex-col items-center gap-2">
                {showMobileJoystick && (
                  <div
                    className={`transition-opacity duration-150 ${
                      isJoystickActive ? 'opacity-90' : 'opacity-65 hover:opacity-85'
                    }`}
                  >
                    {/* Circular Semi-Transparent Joystick Touch Pad */}
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
                        isCompactLandscape
                          ? 'w-24 h-24'
                          : isPhonePortrait
                            ? 'w-[104px] h-[104px]'
                            : 'w-28 h-28 sm:w-30 sm:h-30'
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOTTOM-RIGHT: Mobile Touch Action Buttons (and Cast button when near water on any device) */}
          {(showMobileJoystick || canFish) && (
            <div
              style={{
                right: isTablet
                  ? 'max(1.25rem, var(--safe-right))'
                  : 'max(0.75rem, var(--safe-right))',
                bottom: !showMobileJoystick
                  ? isWarzoneActive
                    ? '96px'
                    : '68px'
                  : isCompactLandscape
                    ? 'calc(18px + var(--safe-bottom))'
                    : isPhonePortrait
                      ? 'calc(72px + var(--safe-bottom))'
                      : isTablet
                        ? 'calc(126px + var(--safe-bottom))'
                        : 'calc(76px + var(--safe-bottom))',
              }}
              className="pointer-events-auto fixed flex flex-col items-end gap-2 touch-none"
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
                  className="px-3.5 py-1.5 rounded-full bg-[#0d1118]/78 hover:bg-[#171e2b]/90 backdrop-blur-sm active:scale-95 text-white border border-white/25 shadow-[0_8px_24px_rgba(0,0,0,0.45)] font-semibold text-[11px] tracking-wide cursor-pointer"
                >
                  <span>{primaryContextualAction.label}</span>
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
