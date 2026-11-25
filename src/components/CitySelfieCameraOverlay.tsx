import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Grid3x3,
  Image as ImageIcon,
  MapPin,
  RotateCcw,
  RotateCw,
  Send,
  Smile,
  Timer,
  Trash2,
  UserCircle2,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  isExcludedUglyPoseItem,
  type WardrobeCatalogItem,
} from '../game/buddiesWardrobeStudioRules';
import {
  AVATAR_PHOTO_STORAGE_KEY,
  PROFILE_IDENTITY_UPDATED_EVENT,
  STATUS_PHOTO_STORAGE_KEY,
  readStoredAvatarPhotoUrl,
} from './CharacterProfileModal';
import { publishCityFeedPost } from '../lib/cityFeedService';

export type CitySelfieAspect = '1:1' | '4:5' | '16:9';
export type CitySelfieFraming = 'close' | 'selfie' | 'full';
export type CitySelfieFilterId = 'natural' | 'golden' | 'film' | 'cool' | 'noir';

interface StoredSelfieShot {
  id: string;
  dataUrl: string;
  aspect: CitySelfieAspect;
  filterLabel: string;
  location: string;
  createdAtMs: number;
}

const SELFIE_GALLERY_STORAGE_KEY = 'bb_city_selfie_gallery_v1';

const FRAMING_PRESETS: Array<{ id: CitySelfieFraming; label: string; distScale: number }> = [
  { id: 'close', label: 'Close', distScale: 0.6 },
  { id: 'selfie', label: 'Selfie', distScale: 0.88 },
  { id: 'full', label: 'Full', distScale: 1.52 },
];

const ASPECT_PRESETS: Array<{ id: CitySelfieAspect; label: string; ratio: number }> = [
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 0.8 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

const FILTER_PRESETS: Array<{ id: CitySelfieFilterId; label: string; cssFilter: string }> = [
  { id: 'natural', label: 'Natural', cssFilter: 'none' },
  {
    id: 'golden',
    label: 'Golden',
    cssFilter: 'sepia(0.18) saturate(1.22) contrast(1.04) brightness(1.04)',
  },
  {
    id: 'film',
    label: 'Film',
    cssFilter: 'contrast(1.1) saturate(0.88) sepia(0.12) brightness(0.98)',
  },
  {
    id: 'cool',
    label: 'Cool',
    cssFilter: 'hue-rotate(-8deg) saturate(1.12) contrast(1.05) brightness(1.02)',
  },
  {
    id: 'noir',
    label: 'Noir',
    cssFilter: 'grayscale(1) contrast(1.18) brightness(1.02)',
  },
];

function readStoredSelfieGallery(): StoredSelfieShot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SELFIE_GALLERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is StoredSelfieShot =>
          Boolean(item && typeof item === 'object' && item.id && item.dataUrl),
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

function writeStoredSelfieGallery(shots: StoredSelfieShot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SELFIE_GALLERY_STORAGE_KEY,
      JSON.stringify(shots.slice(0, 8)),
    );
  } catch {
    // Fallback if storage quota is tight: keep only latest 3 shots
    try {
      window.localStorage.setItem(
        SELFIE_GALLERY_STORAGE_KEY,
        JSON.stringify(shots.slice(0, 3)),
      );
    } catch {
      // ignore
    }
  }
}

export interface CitySelfieCameraOverlayProps {
  isOpen: boolean;
  locationLabel: string;
  playerDisplayName: string;
  characterGender: 'male' | 'female';
  nearAccountId?: string | null;
  quickPoseItems: WardrobeCatalogItem[];
  activeQuickPoseId: string | null;
  onTriggerQuickPose: (item: WardrobeCatalogItem) => void;
  onStopQuickPose: () => void;
  onTriggerEmote: (emoteId: string) => void;
  onStopEmote: () => void;
  onClose: () => void;
}

export const CitySelfieCameraOverlay: React.FC<CitySelfieCameraOverlayProps> = ({
  isOpen,
  locationLabel,
  playerDisplayName,
  characterGender,
  nearAccountId = null,
  quickPoseItems,
  activeQuickPoseId,
  onTriggerQuickPose,
  onStopQuickPose,
  onStopEmote,
  onClose,
}) => {
  const [framing, setFraming] = useState<CitySelfieFraming>('selfie');
  const [aspect, setAspect] = useState<CitySelfieAspect>('4:5');
  const [filterId, setFilterId] = useState<CitySelfieFilterId>('natural');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [timerSec, setTimerSec] = useState<0 | 3>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [showPoseStrip, setShowPoseStrip] = useState<boolean>(false);
  const [gallery, setGallery] = useState<StoredSelfieShot[]>(() => readStoredSelfieGallery());
  const [reviewShot, setReviewShot] = useState<StoredSelfieShot | null>(null);
  const [feedCaption, setFeedCaption] = useState<string>('');
  const [isPostingFeed, setIsPostingFeed] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  const countdownTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const activeFilter = useMemo(
    () => FILTER_PRESETS.find((f) => f.id === filterId) ?? FILTER_PRESETS[0],
    [filterId],
  );

  const visibleSelfiePoses = useMemo(
    () =>
      quickPoseItems.filter(
        (item) => Boolean(item.dancePose?.animGlbUrl) && !isExcludedUglyPoseItem(item),
      ),
    [quickPoseItems],
  );

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setActionToast(null);
    }, 2800);
  }, []);

  // Track viewport size for crisp proportional viewfinder frame
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen]);

  // Sync open state & initial framing with Three.js arena camera
  useEffect(() => {
    if (!isOpen) {
      setReviewShot(null);
      setCountdown(null);
      setShowPoseStrip(false);
      if (countdownTimerRef.current !== null) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      window.dispatchEvent(
        new CustomEvent('city-selfie-camera-state', {
          detail: { isOpen: false },
        }),
      );
      return;
    }

    const initialDist =
      FRAMING_PRESETS.find((f) => f.id === framing)?.distScale ?? 0.88;
    window.dispatchEvent(
      new CustomEvent('city-selfie-camera-state', {
        detail: { isOpen: true, distanceScale: initialDist, resetOrbit: true },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent('city-selfie-camera-state', {
          detail: { isOpen: false },
        }),
      );
    };
    // Only open/close lifecycle triggers camera entry/exit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Apply live CSS filter preview directly onto the city WebGL canvas (zero extra GPU passes)
  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-city-arena-canvas="true"]',
    );
    if (!canvas) return;
    if (!isOpen || reviewShot) {
      canvas.style.filter = '';
      return;
    }
    canvas.style.filter = activeFilter.cssFilter === 'none' ? '' : activeFilter.cssFilter;
    return () => {
      canvas.style.filter = '';
    };
  }, [isOpen, reviewShot, activeFilter]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current !== null) {
        window.clearInterval(countdownTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const executeCaptureNow = useCallback(() => {
    setShutterFlash(true);
    window.setTimeout(() => setShutterFlash(false), 180);
    soundEngine.playUiConfirm();

    window.dispatchEvent(
      new CustomEvent('city-selfie-capture-request', {
        detail: {
          aspect,
          cssFilter: activeFilter.cssFilter,
          onCaptured: (dataUrl: string | null) => {
            if (!dataUrl) {
              showToast('Could not capture photo on this browser');
              return;
            }
            const shot: StoredSelfieShot = {
              id: `selfie_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              dataUrl,
              aspect,
              filterLabel: activeFilter.label,
              location: locationLabel,
              createdAtMs: Date.now(),
            };
            setGallery((prev) => {
              const next = [shot, ...prev].slice(0, 8);
              writeStoredSelfieGallery(next);
              return next;
            });
            setFeedCaption(`Selfie at ${locationLabel}`);
            setReviewShot(shot);
          },
        },
      }),
    );
  }, [aspect, activeFilter, locationLabel, showToast]);

  const handleShutterPress = useCallback(() => {
    if (countdown !== null) {
      if (countdownTimerRef.current !== null) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
      return;
    }
    if (timerSec === 0) {
      executeCaptureNow();
      return;
    }
    soundEngine.playUiClick();
    let remaining = timerSec;
    setCountdown(remaining);
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current !== null) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(null);
        executeCaptureNow();
      } else {
        soundEngine.playUiClick();
        setCountdown(remaining);
      }
    }, 1000);
  }, [countdown, timerSec, executeCaptureNow]);

  // Keyboard shortcuts: Esc closes review or camera, Space snaps photo
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (reviewShot) {
          setReviewShot(null);
        } else {
          onClose();
        }
      } else if (e.code === 'Space' && !isTyping && !reviewShot) {
        e.preventDefault();
        handleShutterPress();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, reviewShot, onClose, handleShutterPress]);

  const handleSelectFraming = (next: CitySelfieFraming) => {
    soundEngine.playUiClick();
    setFraming(next);
    const preset = FRAMING_PRESETS.find((f) => f.id === next);
    if (preset) {
      window.dispatchEvent(
        new CustomEvent('city-selfie-camera-state', {
          detail: { distanceScale: preset.distScale },
        }),
      );
    }
  };

  const handleTurnPlayer = (deltaDeg: number) => {
    soundEngine.playUiClick();
    window.dispatchEvent(
      new CustomEvent('city-selfie-camera-state', {
        detail: { turnPlayerDeltaRad: (deltaDeg * Math.PI) / 180 },
      }),
    );
  };

  const handleResetAngle = () => {
    soundEngine.playUiClick();
    const preset = FRAMING_PRESETS.find((f) => f.id === framing);
    window.dispatchEvent(
      new CustomEvent('city-selfie-camera-state', {
        detail: { resetOrbit: true, distanceScale: preset?.distScale ?? 0.88 },
      }),
    );
  };

  const handleSetProfilePhoto = () => {
    if (!reviewShot) return;
    soundEngine.playUiConfirm();
    try {
      window.localStorage.setItem(AVATAR_PHOTO_STORAGE_KEY, reviewShot.dataUrl);
      window.dispatchEvent(new CustomEvent(PROFILE_IDENTITY_UPDATED_EVENT));
      showToast('Saved as Profile Photo');
    } catch {
      showToast('Could not save Profile Photo');
    }
  };

  const handleSetStatusCover = () => {
    if (!reviewShot) return;
    soundEngine.playUiConfirm();
    try {
      window.localStorage.setItem(STATUS_PHOTO_STORAGE_KEY, reviewShot.dataUrl);
      window.dispatchEvent(new CustomEvent(PROFILE_IDENTITY_UPDATED_EVENT));
      showToast('Saved as Status Cover');
    } catch {
      showToast('Could not save Status Cover');
    }
  };

  const handlePostToCityFeed = async () => {
    if (!reviewShot || isPostingFeed) return;
    soundEngine.playUiConfirm();
    setIsPostingFeed(true);
    try {
      const cleanName = playerDisplayName.trim() || 'Buddy';
      const authorAvatarUrl = readStoredAvatarPhotoUrl() || undefined;
      await publishCityFeedPost({
        id: `post_selfie_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        authorId: nearAccountId || `local_${cleanName.toLowerCase().replace(/\s+/g, '_')}`,
        authorNearAccount: nearAccountId,
        authorName: cleanName,
        authorAvatarUrl,
        authorTeam: 'blue',
        authorGender: characterGender,
        text: feedCaption.trim() || `Selfie at ${reviewShot.location}`,
        mood: 'Selfie',
        location: reviewShot.location,
        photoUrl: reviewShot.dataUrl,
        createdAtMs: Date.now(),
        likedByIds: [],
        comments: [],
      });
      showToast('Shared to City Feed');
    } catch {
      showToast('Could not post to City Feed');
    } finally {
      setIsPostingFeed(false);
    }
  };

  const handleDownloadShot = () => {
    if (!reviewShot) return;
    soundEngine.playUiClick();
    const link = document.createElement('a');
    link.href = reviewShot.dataUrl;
    const slug = reviewShot.location.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `city-selfie-${slug}-${reviewShot.createdAtMs}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Photo downloaded');
  };

  const handleDeleteShot = (shotId: string) => {
    soundEngine.playUiClick();
    setGallery((prev) => {
      const next = prev.filter((s) => s.id !== shotId);
      writeStoredSelfieGallery(next);
      return next;
    });
    if (reviewShot?.id === shotId) {
      setReviewShot(null);
    }
  };

  // Compute exact centered viewfinder box matching the crop rectangle used during capture
  const viewfinderRect = useMemo(() => {
    const targetRatio = ASPECT_PRESETS.find((a) => a.id === aspect)?.ratio ?? 0.8;
    const safeH = Math.max(200, viewportSize.h - 160);
    const safeW = Math.max(200, viewportSize.w - 36);
    let w = safeW;
    let h = w / targetRatio;
    if (h > safeH) {
      h = safeH;
      w = h * targetRatio;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }, [aspect, viewportSize]);

  if (!isOpen) return null;

  return (
    <div
      data-city-selfie-camera-overlay="true"
      className="fixed inset-0 z-[72] pointer-events-none select-none text-white"
      style={{ fontFamily: '"Plus Jakarta Sans", "Outfit", system-ui, sans-serif' }}
    >
      {/* White camera shutter flash */}
      {shutterFlash && (
        <div className="fixed inset-0 z-[80] bg-white/75 pointer-events-none transition-opacity duration-150" />
      )}

      {/* Centered Aspect Viewfinder Frame (pointer-events-none so user can freely drag/zoom the 3D scene!) */}
      {!reviewShot && (
        <div className="fixed inset-0 flex items-center justify-center pb-10 pointer-events-none">
          <div
            style={{ width: viewfinderRect.width, height: viewfinderRect.height }}
            className="relative border border-white/25 transition-[width,height] duration-200 ease-out"
          >
            {/* Corner L-brackets */}
            <span className="absolute -top-px -left-px w-5 h-5 border-t-2 border-l-2 border-white/90" />
            <span className="absolute -top-px -right-px w-5 h-5 border-t-2 border-r-2 border-white/90" />
            <span className="absolute -bottom-px -left-px w-5 h-5 border-b-2 border-l-2 border-white/90" />
            <span className="absolute -bottom-px -right-px w-5 h-5 border-b-2 border-r-2 border-white/90" />

            {/* Optional Rule-of-Thirds composition grid */}
            {showGrid && (
              <>
                <span className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-white/15" />
              </>
            )}

            {/* Self-Timer Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl font-bold tabular-nums text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)]">
                  {countdown}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Camera Strip */}
      <div
        className="fixed inset-x-4 top-3.5 z-[74] flex items-center justify-between gap-3 pointer-events-none"
        style={{ top: 'max(0.85rem, var(--safe-top))' }}
      >
        <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0d1118]/84 border border-white/14 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-white whitespace-nowrap">{locationLabel}</span>
          <span className="hidden sm:inline text-white/35" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline text-white/65 whitespace-nowrap">
            Drag to orbit · Scroll to zoom
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setShowGrid((g) => !g);
            }}
            title={showGrid ? 'Hide Grid' : 'Show Rule-of-Thirds Grid'}
            aria-label="Toggle Composition Grid"
            aria-pressed={showGrid}
            className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              showGrid
                ? 'bg-white text-slate-950 border-white'
                : 'bg-[#0d1118]/84 text-white/85 border-white/14 hover:text-white'
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setTimerSec((t) => (t === 0 ? 3 : 0));
            }}
            title={timerSec === 3 ? '3s Self-Timer On' : 'Self-Timer Off'}
            aria-label="Toggle 3s Timer"
            aria-pressed={timerSec === 3}
            className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              timerSec === 3
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-[#0d1118]/84 text-white/85 border-white/14 hover:text-white'
            }`}
          >
            <Timer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{timerSec === 3 ? '3s' : 'Off'}</span>
          </button>

          <button
            type="button"
            data-selfie-camera-close="true"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Exit Selfie Camera"
            className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Confirmation Toast */}
      {actionToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[82] pointer-events-none">
          <div className="px-4 py-2 rounded-xl bg-[#0d1118]/92 border border-emerald-400/40 text-xs font-medium text-white flex items-center gap-2 shadow-[0_10px_28px_rgba(0,0,0,0.5)]">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{actionToast}</span>
          </div>
        </div>
      )}

      {/* Unified Compact Bottom Camera Control Dock (Hidden while reviewing a captured shot) */}
      {!reviewShot && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[74] w-[min(450px,calc(100vw-24px))] flex flex-col items-center gap-1.5 pointer-events-none"
          style={{ bottom: 'max(0.65rem, var(--safe-bottom))' }}
        >
          {/* Optional Collapsible Pose Strip */}
          {showPoseStrip && (
            <div className="pointer-events-auto w-full px-2 py-1.5 rounded-xl bg-[#0d1118]/90 border border-white/14 shadow-[0_10px_26px_rgba(0,0,0,0.48)] flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onStopQuickPose();
                  onStopEmote();
                }}
                className={`px-2.5 py-1 rounded-md text-[10.5px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  !activeQuickPoseId
                    ? 'bg-white text-slate-950'
                    : 'bg-white/[0.08] text-white/80 hover:bg-white/[0.15]'
                }`}
              >
                Natural
              </button>
              {visibleSelfiePoses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onTriggerQuickPose(item);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10.5px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    activeQuickPoseId === item.id
                      ? 'bg-rose-500 text-white'
                      : 'bg-white/[0.08] text-white/80 hover:bg-white/[0.15]'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}

          {/* Main Compact Camera Dock */}
          <div className="pointer-events-auto w-full px-2.5 py-1.5 rounded-xl bg-[#0d1118]/88 border border-white/14 shadow-[0_12px_32px_rgba(0,0,0,0.52)] flex flex-col gap-1.5">
            {/* Row 1: Framing · Aspect · Filters */}
            <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
              {/* Framing segmented control */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-white/[0.06] shrink-0">
                {FRAMING_PRESETS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFraming(f.id)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      framing === f.id
                        ? 'bg-white text-slate-950'
                        : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Aspect ratio segmented control */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-white/[0.06] shrink-0">
                {ASPECT_PRESETS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setAspect(a.id);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      aspect === a.id
                        ? 'bg-white text-slate-950'
                        : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Color filter selector */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-white/[0.06] shrink-0">
                {FILTER_PRESETS.map((flt) => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setFilterId(flt.id);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                      filterId === flt.id
                        ? 'bg-rose-500 text-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Gallery & Pose | Primary Shutter | Turn Backdrop */}
            <div className="flex items-center justify-between gap-1.5">
              {/* Left cluster: Gallery preview + Pose toggle */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {gallery.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setFeedCaption(`Selfie at ${gallery[0].location}`);
                      setReviewShot(gallery[0]);
                    }}
                    title="Open Recent Selfies"
                    aria-label="Open Recent Selfies"
                    className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/30 hover:border-white cursor-pointer shrink-0 transition-transform active:scale-95"
                  >
                    <img
                      src={gallery[0].dataUrl}
                      alt="Latest selfie"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 px-1 rounded-tl bg-black/75 text-[8.5px] font-semibold tabular-nums text-white leading-tight">
                      {gallery.length}
                    </span>
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/35 shrink-0">
                    <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setShowPoseStrip((p) => !p);
                  }}
                  aria-pressed={showPoseStrip}
                  className={`h-7 px-2.5 rounded-lg border text-[10.5px] font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    showPoseStrip || activeQuickPoseId
                      ? 'bg-rose-500 border-rose-400 text-white'
                      : 'bg-white/[0.08] border-white/12 text-white/85 hover:bg-white/[0.15]'
                  }`}
                >
                  <Smile className="w-3 h-3" aria-hidden="true" />
                  <span>Pose</span>
                </button>
              </div>

              {/* Center: Compact Tactile Shutter Button */}
              <button
                type="button"
                data-selfie-shutter-btn="true"
                onClick={handleShutterPress}
                title={countdown !== null ? 'Cancel Timer' : 'Take City Selfie (Space)'}
                aria-label={countdown !== null ? 'Cancel Timer' : 'Take City Selfie'}
                className="w-11 h-11 rounded-full bg-white hover:bg-rose-50 text-slate-950 ring-[3px] ring-white/25 hover:ring-rose-400/45 shadow-[0_4px_16px_rgba(0,0,0,0.45)] flex items-center justify-center cursor-pointer transition-transform active:scale-90 shrink-0"
              >
                {countdown !== null ? (
                  <X className="w-5 h-5 stroke-[2.5] text-rose-600" aria-hidden="true" />
                ) : (
                  <Camera className="w-5 h-5 stroke-[2.1]" aria-hidden="true" />
                )}
              </button>

              {/* Right cluster: Turn avatar to change city backdrop + Reset camera angle */}
              <div className="flex items-center justify-end gap-1 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleTurnPlayer(-30)}
                  title="Turn Left (Change Backdrop)"
                  aria-label="Turn Character Left"
                  className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] border border-white/12 text-white/90 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTurnPlayer(30)}
                  title="Turn Right (Change Backdrop)"
                  aria-label="Turn Character Right"
                  className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] border border-white/12 text-white/90 flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                >
                  <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleResetAngle}
                  title="Reset Camera Angle"
                  aria-label="Reset Camera Angle"
                  className="h-7 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] border border-white/12 text-[10px] font-medium text-white/85 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  Center
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Captured Photo Review & Share Sheet */}
      {reviewShot && (
        <div className="fixed inset-0 z-[76] bg-black/70 flex items-center justify-center p-4 pointer-events-auto">
          <div
            data-selfie-review-modal="true"
            className="w-full max-w-[520px] max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#11151f] border border-white/14 shadow-[0_24px_64px_rgba(0,0,0,0.65)] p-4 flex flex-col gap-3.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white">City Selfie</h3>
                <div className="text-xs text-white/55 flex items-center gap-1.5 mt-0.5">
                  <span>{reviewShot.location}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{reviewShot.aspect}</span>
                  <span aria-hidden="true">·</span>
                  <span>{reviewShot.filterLabel}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setReviewShot(null);
                }}
                aria-label="Back to Camera"
                className="h-8 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-xs font-medium text-white cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                Retake
              </button>
            </div>

            {/* Captured Photo Preview */}
            <div className="w-full rounded-xl bg-[#090c12] border border-white/10 overflow-hidden flex items-center justify-center max-h-[44dvh]">
              <img
                src={reviewShot.dataUrl}
                alt={`City selfie at ${reviewShot.location}`}
                className="max-w-full max-h-[44dvh] object-contain"
              />
            </div>

            {/* Caption for City Feed */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={feedCaption}
                onChange={(e) => setFeedCaption(e.target.value)}
                maxLength={140}
                placeholder={`Write a caption for ${reviewShot.location}...`}
                className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-white/[0.06] border border-white/12 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400/70"
              />
              <button
                type="button"
                disabled={isPostingFeed}
                onClick={() => void handlePostToCityFeed()}
                className="h-9 px-3.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isPostingFeed ? 'Posting…' : 'Post Feed'}</span>
              </button>
            </div>

            {/* Quick Save Actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                data-selfie-set-avatar="true"
                onClick={handleSetProfilePhoto}
                className="h-9 px-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <UserCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Profile Photo</span>
              </button>
              <button
                type="button"
                data-selfie-set-cover="true"
                onClick={handleSetStatusCover}
                className="h-9 px-2.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.18] border border-white/14 text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Status Cover</span>
              </button>
              <button
                type="button"
                data-selfie-download="true"
                onClick={handleDownloadShot}
                className="h-9 px-2.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.18] border border-white/14 text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Download</span>
              </button>
            </div>

            {/* Recent City Selfies Strip */}
            {gallery.length > 1 && (
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-[11px] text-white/55 mb-2">
                  <span>Recent shots ({gallery.length})</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteShot(reviewShot.id)}
                    className="text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    <span>Delete selected</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  {gallery.map((shot) => (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setReviewShot(shot);
                        setFeedCaption(`Selfie at ${shot.location}`);
                      }}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                        shot.id === reviewShot.id
                          ? 'border-rose-400 scale-[1.03]'
                          : 'border-white/15 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={shot.dataUrl}
                        alt={`Selfie at ${shot.location}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
