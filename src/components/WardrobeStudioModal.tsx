import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Download,
  Eye,
  Flame,
  Footprints,
  Hand,
  Lock,
  Maximize2,
  Music,
  Palette,
  PersonStanding,
  Play,
  Redo2,
  RotateCcw,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  User,
  UserRound,
  Users,
  Wind,
  X,
} from 'lucide-react';
import studioBackdropUrl from '../assets/images/wardrobe_dressing_room_studio_1795152181264.jpg';
import { useAdaptiveViewport } from '../lib/useAdaptiveViewport';
import {
  computeWardrobeStudioLayout,
  type WardrobeStudioAdaptiveLayout,
} from '../game/buddiesAdaptiveViewportRules';
import {
  applyBuddyRigBodyShape,
  applyCitizenClothingTint,
  getCachedLoadedBlitzAssets,
  loadAndAttachExternalStyleAnimationClip,
  loadModularApparelGltf,
  setBlitzStylizedCharViewportSize,
  setBuddyRigModularOutfitUrls,
  upgradeBuddyRigWithCharBuddiesGlb,
  type BuddyCharacterRig,
} from '../game/buddiesBlitzShadersAndAssets';
import {
  applyBuddyRigFaceCustomization,
  drawStylizedEyeOnCanvas,
  drawStylizedEyebrowOnCanvas,
  drawStylizedLipsOnCanvas,
  drawStylizedNoseOnCanvas,
} from '../game/buddiesFaceCompositor';
import {
  DEFAULT_MALE_UNDERWEAR_ITEM_ID,
  DEFAULT_WARDROBE_ANIM_SET_ID,
  EMPTY_WARDROBE_DRAFT,
  WARDROBE_CLOTHING_TINT_SWATCHES,
  WARDROBE_STUDIO_ITEMS,
  applyItemSelectionToDraft,
  collectUnownedItemsInDraft,
  createSavedPresetFromDraft,
  createWardrobeHistory,
  getExternalWardrobeCatalogCount,
  getVisibleBuiltInWardrobePresets,
  getWardrobeCatalogItemById,
  getWardrobeCatalogItemPriceCyon,
  isWardrobeItemCompatibleWithGender,
  isWardrobeItemOwned,
  loadExternalWardrobeCatalogs,
  loadSavedWardrobePresets,
  partitionWardrobeCategoryItems,
  persistSavedWardrobePresets,
  pushWardrobeDraft,
  redoWardrobeDraft,
  resolveWardrobeDraftAnimStyle,
  resolveWardrobeDraftBodyShape,
  resolveWardrobeDraftFaceCustomization,
  resolveWardrobeDraftToModularOutfitUrls,
  resolveWardrobeGlassSurfaceMode,
  sanitizeDraftToOwnedOnly,
  shouldFlipWardrobeThumbY,
  undoWardrobeDraft,
  type WardrobeBottomTabId,
  type WardrobeCameraFraming,
  type WardrobeCatalogItem,
  type WardrobeDanceKind,
  type WardrobeFaceCategoryId,
  type WardrobeFilterMode,
  type WardrobeGlassPreference,
  type WardrobeHistoryState,
  type WardrobeOutfitDraft,
  type WardrobeSavedPreset,
  type WardrobeSortMode,
  type WardrobeStudioCategoryId,
  type WardrobeStyleCategoryId,
} from '../game/buddiesWardrobeStudioRules';
import { soundEngine } from '../game/audio';
import {
  getCachedWardrobeItemThumbnail,
  renderWardrobeItemThumbnail,
} from './wardrobe3dThumbnailRasterizer';
import {
  MOTION_SILHOUETTE_ORB_BG,
  MotionSilhouetteThumb,
} from './MotionSilhouetteThumb';

export interface WardrobeStudioModalProps {
  isOpen: boolean;
  accountKey: string;
  characterGender: 'male' | 'female';
  lulBalance: number;
  ownedApparelIds: string[];
  initialDraft: WardrobeOutfitDraft;
  initialDraftByGender?: Record<'male' | 'female', WardrobeOutfitDraft>;
  onChangeGender: (gender: 'male' | 'female') => void;
  onPurchaseItem: (item: WardrobeCatalogItem) => { ok: boolean; errorMessage?: string };
  onSyncAnimSet?: (animSetId: string) => void;
  onComplete: (
    committedOwnedDraft: WardrobeOutfitDraft,
    committedByGender?: Record<'male' | 'female', WardrobeOutfitDraft>,
  ) => void;
  onClose: () => void;
}

function BraToggleIcon({
  slashed = false,
  className = 'w-4 h-4',
}: {
  slashed?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7.2 9.6 L7.8 4.8" />
      <path d="M16.8 9.6 L16.2 4.8" />
      <path d="M3.4 13.8 C3.4 11.1 5.3 9.4 7.4 9.6 C9.4 9.8 11 11.8 12 13.3 C13 11.8 14.6 9.8 16.6 9.6 C18.7 9.4 20.6 11.1 20.6 13.8 C20.6 16.3 18.4 17.6 15.6 17.6 C13.8 17.6 12.6 16.6 12 15.4 C11.4 16.6 10.2 17.6 8.4 17.6 C5.6 17.6 3.4 16.3 3.4 13.8 Z" />
      {slashed && <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" />}
    </svg>
  );
}

function createStudioDummyBuddyRig(rootGroup: THREE.Group, isSoftwareGl: boolean): BuddyCharacterRig {
  const emptyGeo = new THREE.BufferGeometry();
  const emptyMat = new THREE.MeshBasicMaterial({ visible: false });
  const headMesh = new THREE.Mesh(emptyGeo, emptyMat);
  const weaponMesh = new THREE.Mesh(emptyGeo, emptyMat);
  const leftArmPivot = new THREE.Group();
  const rightArmPivot = new THREE.Group();
  const leftLegPivot = new THREE.Group();
  const rightLegPivot = new THREE.Group();
  const weaponRigGroup = new THREE.Group();
  const pistolGroup = new THREE.Group();
  const rifleGroup = new THREE.Group();
  const bazookaGroup = new THREE.Group();
  const laserGroup = new THREE.Group();
  const gatlingGroup = new THREE.Group();
  const fishingRodGroup = new THREE.Group();
  const bazookaFrontFlash = new THREE.Group();
  const bazookaBackblastGroup = new THREE.Group();
  weaponRigGroup.visible = false;

  return {
    headMesh,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    weaponMesh,
    weaponRigGroup,
    pistolGroup,
    rifleGroup,
    bazookaGroup,
    laserGroup,
    gatlingGroup,
    fishingRodGroup,
    bazookaFrontFlash,
    bazookaBackblastGroup,
    bodyGroupRef: rootGroup,
    teamRef: 'blue',
    isSoftwareGlRef: isSoftwareGl,
  };
}

function createSoftStudioFloorShadowTex(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(12, 8, 12, 0.56)');
    grad.addColorStop(0.55, 'rgba(18, 12, 16, 0.24)');
    grad.addColorStop(1, 'rgba(18, 12, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const CAMERA_FRAMING_SPECS: Record<
  WardrobeCameraFraming,
  { dist: number; targetY: number; camY: number; fov: number }
> = {
  full: { dist: 6.15, targetY: 1.7, camY: 1.9, fov: 35 },
  upper: { dist: 3.45, targetY: 2.52, camY: 2.58, fov: 32 },
  face: { dist: 2.0, targetY: 3.04, camY: 3.06, fov: 28 },
};

const UnderwearGlyphIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3.5 7.5H20.5V11.2C20.5 13.4 17.8 14.4 15.6 15.6L13.3 18.2C12.6 19 11.4 19 10.7 18.2L8.4 15.6C6.2 14.4 3.5 13.4 3.5 11.2V7.5Z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
    <path d="M3.5 10.2H20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const CATEGORY_RAIL_ITEMS: ReadonlyArray<{
  id: WardrobeStudioCategoryId;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'top', label: 'Top', Icon: Shirt },
  { id: 'bottoms', label: 'Bottoms', Icon: UserRound },
  { id: 'set', label: 'Set', Icon: Crown },
  { id: 'hair', label: 'Hair', Icon: Wind },
  { id: 'shoes', label: 'Shoes', Icon: Footprints },
  { id: 'underwear', label: 'Underwear', Icon: UnderwearGlyphIcon },
];

const STYLE_RAIL_ITEMS: ReadonlyArray<{
  id: WardrobeStyleCategoryId;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'style_anim', label: 'Anim Set', Icon: Play },
  { id: 'style_dance', label: 'Dance', Icon: Music },
  { id: 'style_pose', label: 'Pose', Icon: PersonStanding },
  { id: 'style_action', label: 'Action', Icon: Hand },
  { id: 'style_paired', label: 'Paired', Icon: Users },
  { id: 'style_tint', label: 'Dye', Icon: Palette },
];

const BrowGlyphIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3 14.5C6.5 9.5 13 8.5 21 12.2"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  </svg>
);

const LipGlyphIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3.5 12.5C6.5 8.5 9.6 8.8 12 10.6C14.4 8.8 17.5 8.5 20.5 12.5C17.8 16.5 14.8 17.5 12 17.5C9.2 17.5 6.2 16.5 3.5 12.5Z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
    <path d="M5.5 12.6Q12 14.1 18.5 12.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const NoseGlyphIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 4V13.8C12 15.6 10.6 17 8.8 17C7.3 17 6.2 16 6.2 15"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M12 13.8C12 15.6 13.4 17 15.2 17C16.7 17 17.8 16 17.8 15"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const TuningGlyphIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M4 6H14M18 6H20M14 4V8M4 18H6M10 18H20M10 16V20M4 12H10M14 12H20M10 10V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const HeadScaleGlyphIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M7 20C8.2 18 9.8 17 12 17C14.2 17 15.8 18 17 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const FACE_RAIL_ITEMS: ReadonlyArray<{
  id: WardrobeFaceCategoryId;
  label: string;
  Icon: React.FC<{ className?: string }>;
  maleOnly?: boolean;
}> = [
  { id: 'face_tuning', label: 'Tuning', Icon: TuningGlyphIcon },
  { id: 'face_nose', label: 'Nose', Icon: NoseGlyphIcon },
  { id: 'face_head', label: 'Head', Icon: HeadScaleGlyphIcon },
  { id: 'face_eyes', label: 'Eyes', Icon: Eye },
  { id: 'face_brows', label: 'Brows', Icon: BrowGlyphIcon },
  { id: 'face_lips', label: 'Lips', Icon: LipGlyphIcon },
  { id: 'face_eyeshadow', label: 'Shadow', Icon: Sparkles },
  { id: 'face_blush', label: 'Blush', Icon: Flame },
  { id: 'face_facepaint', label: 'Makeup', Icon: Palette },
  { id: 'face_beard', label: 'Beard', Icon: User, maleOnly: true },
];

function FaceFeaturePreviewGlyph({ item }: { item: WardrobeCatalogItem }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    setRetryAttempt(0);
  }, [item.id, item.thumbUrl]);

  useEffect(() => {
    if (item.thumbUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Warm studio portrait skin backdrop so eye/brow/lip shades read accurately
    const bg = ctx.createRadialGradient(w * 0.45, h * 0.35, 6, w * 0.5, h * 0.5, w * 0.62);
    bg.addColorStop(0, '#f3d4be');
    bg.addColorStop(1, '#d9b196');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (item.slot === 'face_eyes' && item.eyeStyle) {
      ctx.translate(w * 0.5, h * 0.52);
      drawStylizedEyeOnCanvas(ctx, w * 0.34, h * 0.165, item.eyeStyle);
    } else if (item.slot === 'face_brows' && item.browStyle) {
      ctx.translate(w * 0.5, h * 0.56);
      drawStylizedEyebrowOnCanvas(ctx, w * 0.36, h * 0.11, item.browStyle);
    } else if (item.slot === 'face_lips' && item.lipStyle) {
      ctx.translate(w * 0.5, h * 0.52);
      drawStylizedLipsOnCanvas(ctx, w * 0.32, h * 0.16, item.lipStyle);
    } else if (item.slot === 'face_nose') {
      ctx.translate(w * 0.5, h * 0.5);
      drawStylizedNoseOnCanvas(ctx, w * 0.34, h * 0.38, item.id, [233, 197, 171], true);
    }
    ctx.restore();
  }, [item]);

  if (item.thumbUrl) {
    const flipY = shouldFlipWardrobeThumbY(item);
    const resolvedSrc =
      retryAttempt > 0
        ? `${item.thumbUrl}${item.thumbUrl.includes('?') ? '&' : '?'}retry=${retryAttempt}`
        : item.thumbUrl;
    return (
      <div
        className="w-full h-full flex items-center justify-center p-1.5"
        style={{
          background: 'radial-gradient(circle at 45% 35%, #f3d4be, #d9b196)',
        }}
      >
        <div className="w-full h-full flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]">
          <img
            src={resolvedSrc}
            alt={item.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => {
              if (retryAttempt < 2) {
                window.setTimeout(() => {
                  setRetryAttempt((prev) => (prev < 2 ? prev + 1 : prev));
                }, 400 * (retryAttempt + 1));
              }
            }}
            className={`w-full h-full object-contain ${flipY ? '-scale-y-100' : ''}`}
          />
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={128}
      height={128}
      className="w-full h-full object-cover"
      aria-hidden="true"
    />
  );
}

function BodyShapeSilhouetteGlyph({ item }: { item: WardrobeCatalogItem }) {
  const shape = item.bodyShape;
  const w = shape?.widthScale ?? 1.0;
  const h = shape?.heightScale ?? 1.0;
  const waistSlim = shape?.morphWeights?.Waist_Slim ?? 0;
  const hipBoost = shape?.morphWeights?.Hip_Width ?? 0;
  const shoulderBoost = shape?.morphWeights?.Shoulder_Width ?? 0;

  // Parametric clean fashion-studio silhouette figure reflecting real proportions
  const shoulderHalf = Math.max(8, Math.min(16, 10.5 * w + shoulderBoost * 3.2));
  const waistHalf = Math.max(4.5, Math.min(11, 7.6 * w - waistSlim * 2.4));
  const hipHalf = Math.max(7.5, Math.min(15.5, 9.5 * w + hipBoost * 3.8));
  const scaleY = Math.max(0.86, Math.min(1.08, h));

  return (
    <div className="flex items-center justify-center w-full h-full">
      <svg
        viewBox="0 0 48 56"
        className="w-12 h-14 drop-shadow-[0_3px_7px_rgba(0,0,0,0.42)]"
        style={{ transform: `scaleY(${scaleY})` }}
        aria-hidden="true"
      >
        <circle cx="24" cy="9" r="5" fill="rgba(255,255,255,0.95)" />
        <path
          d={`M ${24 - shoulderHalf} 18 Q 24 15.5 ${24 + shoulderHalf} 18 L ${24 + waistHalf} 30 Q ${24 + hipHalf} 35 ${24 + hipHalf * 0.85} 40 L ${24 + hipHalf * 0.56} 53 L ${24 + 2} 53 L 24 41 L ${24 - 2} 53 L ${24 - hipHalf * 0.56} 53 L ${24 - hipHalf * 0.85} 40 Q ${24 - hipHalf} 35 ${24 - waistHalf} 30 Z`}
          fill="rgba(255,255,255,0.93)"
        />
      </svg>
    </div>
  );
}

export const WardrobeStudioModal: React.FC<WardrobeStudioModalProps> = ({
  isOpen,
  accountKey,
  characterGender,
  ownedApparelIds,
  initialDraft,
  initialDraftByGender,
  onChangeGender,
  onPurchaseItem,
  onSyncAnimSet,
  onComplete,
  onClose,
}) => {
  const [historyByGender, setHistoryByGender] = useState<
    Record<'male' | 'female', WardrobeHistoryState>
  >(() => ({
    male: createWardrobeHistory(
      initialDraftByGender?.male ??
        (characterGender === 'male' ? initialDraft : EMPTY_WARDROBE_DRAFT),
    ),
    female: createWardrobeHistory(
      initialDraftByGender?.female ??
        (characterGender === 'female' ? initialDraft : EMPTY_WARDROBE_DRAFT),
    ),
  }));
  const history = historyByGender[characterGender];
  const setHistory = useCallback(
    (updater: React.SetStateAction<WardrobeHistoryState>) => {
      setHistoryByGender((prev) => {
        const cur = prev[characterGender];
        const next = typeof updater === 'function' ? updater(cur) : updater;
        if (next === cur) return prev;
        return {
          ...prev,
          [characterGender]: next,
        };
      });
    },
    [characterGender],
  );
  const [activeBottomTab, setActiveBottomTab] = useState<WardrobeBottomTabId>('outfit');
  const [activeCategory, setActiveCategory] = useState<WardrobeStudioCategoryId>('top');
  const [activeFaceCategory, setActiveFaceCategory] = useState<WardrobeFaceCategoryId>('face_eyes');
  const [activeStyleCategory, setActiveStyleCategory] = useState<WardrobeStyleCategoryId>('style_anim');
  const [filterMode, setFilterMode] = useState<WardrobeFilterMode>('all');
  const [sortMode, setSortMode] = useState<WardrobeSortMode>('featured');
  const [cameraFraming, setCameraFraming] = useState<WardrobeCameraFraming>('upper');
  const glassPreference: WardrobeGlassPreference = 'auto';
  const [isSoftwareGlDetected, setIsSoftwareGlDetected] = useState<boolean>(false);
  const [studioFrameMs, setStudioFrameMs] = useState<number>(16.6);
  const [savedPresets, setSavedPresets] = useState<WardrobeSavedPreset[]>([]);
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [externalCatalogRevision, setExternalCatalogRevision] = useState<number>(() =>
    getExternalWardrobeCatalogCount(),
  );
  const [outfitSearchQuery, setOutfitSearchQuery] = useState<string>('');
  const [outfitVisibleLimit, setOutfitVisibleLimit] = useState<number>(36);
  const [animSetPreviewState, setAnimSetPreviewState] = useState<'idle' | 'walk' | 'run' | 'sit'>('idle');
  const [pairedPreviewRole, setPairedPreviewRole] = useState<'initiate' | 'receive'>('initiate');
  const [underwearSubFilter, setUnderwearSubFilter] = useState<'all' | 'underwear' | 'corewear'>('all');
  const [underwearPreviewBare, setUnderwearPreviewBare] = useState<boolean>(true);

  useEffect(() => {
    setOutfitVisibleLimit(36);
  }, [activeCategory, characterGender, outfitSearchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void loadExternalWardrobeCatalogs().then((count) => {
      if (active && count > 0) {
        setExternalCatalogRevision(count);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen]);
  const [webglLost, setWebglLost] = useState<boolean>(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState<boolean>(true);
  const adaptiveViewport = useAdaptiveViewport();
  const [isPortraitSheetCollapsed, setIsPortraitSheetCollapsed] = useState<boolean>(false);
  const studioLayout: WardrobeStudioAdaptiveLayout = useMemo(
    () => computeWardrobeStudioLayout(adaptiveViewport, isPortraitSheetCollapsed),
    [adaptiveViewport, isPortraitSheetCollapsed],
  );
  const studioLayoutRef = useRef<WardrobeStudioAdaptiveLayout>(studioLayout);
  studioLayoutRef.current = studioLayout;

  useEffect(() => {
    if (!isOpen || !studioLayout.isPortraitSheet) {
      setIsPortraitSheetCollapsed(false);
    }
  }, [isOpen, studioLayout.isPortraitSheet]);

  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<BuddyCharacterRig | null>(null);
  const activePoseActionRef = useRef<THREE.AnimationAction | null>(null);
  const framingRef = useRef<WardrobeCameraFraming>('upper');
  const activeDanceRef = useRef<{ kind: WardrobeDanceKind; tempoBpm: number }>({
    kind: 'none',
    tempoBpm: 0,
  });
  const danceClockRef = useRef<number>(0);
  const dragStateRef = useRef({
    dragging: false,
    lastX: 0,
    targetYaw: 0.16,
    currentYaw: 0.16,
    zoomDelta: 0,
    currentZoomDelta: 0,
  });

  const draft = history.present;
  const draftRef = useRef<WardrobeOutfitDraft>(draft);
  draftRef.current = draft;
  const unownedPreviewItems = useMemo(
    () => collectUnownedItemsInDraft(draft, ownedApparelIds, characterGender),
    [draft, ownedApparelIds, characterGender],
  );
  const visibleBuiltInPresets = useMemo(
    () => getVisibleBuiltInWardrobePresets(characterGender),
    [characterGender],
  );
  const resolvedGlassMode = useMemo(
    () =>
      resolveWardrobeGlassSurfaceMode({
        preference: glassPreference,
        isSoftwareGl: isSoftwareGlDetected,
        smoothedFrameMs: studioFrameMs,
      }),
    [glassPreference, isSoftwareGlDetected, studioFrameMs],
  );

  // Unified dark glass surface matching Environment & Audio modal opacity
  const glassSurfaceClass =
    resolvedGlassMode === 'frosted_blur'
      ? 'bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)]'
      : 'bg-gradient-to-b from-[#171d2c]/86 via-[#111622]/84 to-[#0c101a]/88 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_24px_70px_rgba(0,0,0,0.58)]';

  const glassPillClass =
    resolvedGlassMode === 'frosted_blur'
      ? 'bg-[#111622]/86 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_28px_rgba(0,0,0,0.45)]'
      : 'bg-[#111622]/86 border border-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_28px_rgba(0,0,0,0.45)]';

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
  }, []);

  useEffect(() => {
    if (!statusNotice) return;
    const t = window.setTimeout(() => {
      setStatusNotice(null);
    }, 3200);
    return () => window.clearTimeout(t);
  }, [statusNotice]);

  // Sync framing ref for smooth animation loop interpolation
  useEffect(() => {
    framingRef.current = cameraFraming;
    dragStateRef.current.zoomDelta = 0;
  }, [cameraFraming]);

  // Reset history & load user presets whenever Wardrobe Studio opens or account switches
  const wasOpenRef = useRef<boolean>(false);
  const lastOpenedAccountKeyRef = useRef<string>(accountKey);
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    const accountChanged = lastOpenedAccountKeyRef.current !== accountKey;
    if (justOpened || accountChanged) {
      wasOpenRef.current = true;
      lastOpenedAccountKeyRef.current = accountKey;
      setHistoryByGender({
        male: createWardrobeHistory(
          initialDraftByGender?.male ??
            (characterGender === 'male' ? initialDraft : EMPTY_WARDROBE_DRAFT),
        ),
        female: createWardrobeHistory(
          initialDraftByGender?.female ??
            (characterGender === 'female' ? initialDraft : EMPTY_WARDROBE_DRAFT),
        ),
      });
      setSavedPresets(loadSavedWardrobePresets(accountKey));
      setStatusNotice(null);
    }
  }, [isOpen, initialDraft, initialDraftByGender, characterGender, accountKey]);

  // Keep owned animation set synchronized live between Wardrobe and in-game avatar
  useEffect(() => {
    if (!isOpen || !onSyncAnimSet) return;
    const candidateId = draft.animSetId ?? DEFAULT_WARDROBE_ANIM_SET_ID;
    const item = getWardrobeCatalogItemById(candidateId);
    if (
      item &&
      item.slot === 'style_anim' &&
      isWardrobeItemCompatibleWithGender(item, characterGender) &&
      isWardrobeItemOwned(item, ownedApparelIds)
    ) {
      onSyncAnimSet(item.id);
    }
  }, [
    isOpen,
    draft.animSetId,
    characterGender,
    ownedApparelIds,
    externalCatalogRevision,
    onSyncAnimSet,
  ]);

  // Pause main city world WebGL loop while full-screen Wardrobe Studio is open (0% background GPU cost)
  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new CustomEvent('wardrobe-studio-pause', { detail: { paused: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent('wardrobe-studio-pause', { detail: { paused: false } }));
    };
  }, [isOpen]);

  // Escape key closes cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        soundEngine.playUiClick();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          setHistory((h) => redoWardrobeDraft(h));
        } else {
          setHistory((h) => undoWardrobeDraft(h));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Lazily rasterize real circular 3D thumbnails ONLY for currently visible active-tab GLB items
  // (keeps 1,000+ fitted outfits & hairstyles smooth at 60 FPS with zero upfront WebGL spike)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const activeItems =
      activeCategory !== 'presets'
        ? partitionWardrobeCategoryItems(
            activeCategory,
            ownedApparelIds,
            filterMode,
            sortMode,
            characterGender,
          ).allVisible
        : [];
    const q = outfitSearchQuery.trim().toLowerCase();
    const filteredActive = q
      ? activeItems.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q) ||
            item.collection.toLowerCase().includes(q),
        )
      : activeItems;
    const staticSets = WARDROBE_STUDIO_ITEMS.filter(
      (item) =>
        item.slot === 'set' &&
        Boolean(item.glbPath) &&
        isWardrobeItemCompatibleWithGender(item, characterGender),
    );
    const seenIds = new Set<string>();
    const targets: WardrobeCatalogItem[] = [];
    for (const item of [...filteredActive.slice(0, outfitVisibleLimit), ...staticSets]) {
      if (!item.glbPath || seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      targets.push(item);
    }

    // Prime cached ones synchronously
    const initial: Record<string, string> = {};
    for (const item of targets) {
      const cached = getCachedWardrobeItemThumbnail(item.glbPath);
      if (cached) initial[item.id] = cached;
    }
    if (Object.keys(initial).length > 0) {
      setThumbMap((prev) => ({ ...prev, ...initial }));
    }

    (async () => {
      for (const item of targets) {
        if (cancelled) return;
        if (!item.glbPath || getCachedWardrobeItemThumbnail(item.glbPath)) continue;
        const url = await renderWardrobeItemThumbnail(item.glbPath);
        if (cancelled) return;
        if (url) {
          setThumbMap((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: url }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    characterGender,
    activeCategory,
    ownedApparelIds,
    filterMode,
    sortMode,
    outfitSearchQuery,
    outfitVisibleLimit,
    externalCatalogRevision,
  ]);

  const applyStudioClipCandidates = useCallback((candidates: readonly string[]) => {
    const rig = rigRef.current;
    const controller = rig?.customGlbController;
    if (!controller || !controller.mixer) return;

    // Pick strictly from pre-sanitized, upright, PelvisRoot-retargeted clips prepared by
    // `upgradeBuddyRigWithCharBuddiesGlb` so external raw Z-up/cm tracks can never tip or sink the avatar.
    let targetClip: THREE.AnimationClip | null = null;
    for (const name of candidates) {
      const found = controller.clips.get(name);
      if (found) {
        targetClip = found;
        break;
      }
    }
    if (!targetClip) {
      targetClip =
        controller.clips.get('idle.001') ??
        controller.clips.values().next().value ??
        null;
    }
    if (!targetClip) return;

    const nextAction = controller.mixer.clipAction(targetClip);
    if (activePoseActionRef.current === nextAction && nextAction.isRunning()) {
      return;
    }

    // Stop any initial action started inside upgradeBuddyRigWithCharBuddiesGlb cleanly
    controller.mixer.stopAllAction();
    nextAction.reset();
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.enabled = true;
    nextAction.setEffectiveWeight(1);
    nextAction.play();
    controller.mixer.update(0.016);
    controller.glbRoot.position.y = controller.baseRootY;
    controller.activeClipName = targetClip.name;
    activePoseActionRef.current = nextAction;
  }, []);

  // Dedicated 3D Dressing Room Studio WebGL Stage
  useEffect(() => {
    if (!isOpen) return;
    const host = stageHostRef.current;
    if (!host) return;

    let disposed = false;
    setWebglLost(false);
    setIsAvatarLoading(true);

    const probeGl = document.createElement('canvas').getContext('webgl2');
    const isSoftGl = (() => {
      if (!probeGl) return true;
      const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER;
      const gpu = String(probeGl.getParameter(param) || '');
      probeGl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa OffScreen/i.test(gpu);
    })();
    setIsSoftwareGlDetected(isSoftGl);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftGl,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglLost(true);
      setIsAvatarLoading(false);
      return;
    }

    const dpr = isSoftGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(320, host.clientWidth || window.innerWidth);
    const height = Math.max(240, host.clientHeight || window.innerHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    const canvas = renderer.domElement;
    canvas.className = 'block w-full h-full touch-none select-none cursor-grab active:cursor-grabbing';
    host.innerHTML = '';
    host.appendChild(canvas);

    setBlitzStylizedCharViewportSize(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40);

    // Offset optical center dynamically for Desktop/Tablet split (shift left) and Portrait bottom sheet (shift up)
    let stageWidth = width;
    let stageHeight = height;
    let smoothViewOffsetX = studioLayoutRef.current.cameraShiftRightPx;
    let smoothViewOffsetY = studioLayoutRef.current.cameraShiftDownPx;
    const applyCameraViewOffset = (w: number, h: number, offX: number, offY: number) => {
      camera.aspect = w / h;
      camera.setViewOffset(w, h, Math.round(offX), Math.round(offY), w, h);
      camera.updateProjectionMatrix();
    };
    applyCameraViewOffset(stageWidth, stageHeight, smoothViewOffsetX, smoothViewOffsetY);

    // Three-point warm dressing-room studio lighting matching the ring light on left + golden accent on right
    const hemiLight = new THREE.HemisphereLight('#fff7ee', '#45323c', 1.38);
    scene.add(hemiLight);

    const ringKeyLight = new THREE.DirectionalLight('#fff4e6', 1.85);
    ringKeyLight.position.set(-3.2, 3.8, 4.4);
    scene.add(ringKeyLight);

    const warmRimLight = new THREE.DirectionalLight('#fbd0a8', 1.2);
    warmRimLight.position.set(3.4, 3.0, -2.4);
    scene.add(warmRimLight);

    const coolFillLight = new THREE.DirectionalLight('#c4b5fd', 0.45);
    coolFillLight.position.set(2.2, 1.8, 3.2);
    scene.add(coolFillLight);

    const turntable = new THREE.Group();
    scene.add(turntable);

    // Soft floor contact shadow beneath shoes
    const floorShadowTex = createSoftStudioFloorShadowTex();
    const floorShadowGeo = new THREE.PlaneGeometry(1.85, 1.85);
    const floorShadowMat = new THREE.MeshBasicMaterial({
      map: floorShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const floorShadowMesh = new THREE.Mesh(floorShadowGeo, floorShadowMat);
    floorShadowMesh.rotation.x = -Math.PI / 2;
    floorShadowMesh.position.y = 0.01;
    turntable.add(floorShadowMesh);

    const avatarMountGroup = new THREE.Group();
    turntable.add(avatarMountGroup);

    const studioRig = createStudioDummyBuddyRig(avatarMountGroup, isSoftGl);
    rigRef.current = studioRig;
    activePoseActionRef.current = null;

    // Load base avatar GLB for current gender, then apply active outfit draft & pose
    (async () => {
      const cached = getCachedLoadedBlitzAssets();
      const baseGlbUrl =
        characterGender === 'female'
          ? '/assets/avatars/blitz-female-03.glb'
          : '/assets/avatars/blitz-male-player.glb';
      const baseGltf =
        (characterGender === 'female' ? cached?.playerFemaleGlb : cached?.playerMaleGlb) ??
        (await loadModularApparelGltf(baseGlbUrl));
      if (disposed || !baseGltf) {
        if (!disposed) setIsAvatarLoading(false);
        return;
      }

      upgradeBuddyRigWithCharBuddiesGlb(studioRig, baseGltf, null, null);
      if (disposed) return;

      const currentDraft = draftRef.current;
      const urls = resolveWardrobeDraftToModularOutfitUrls(currentDraft, characterGender);
      await setBuddyRigModularOutfitUrls(studioRig, urls);
      if (disposed) return;

      applyBuddyRigBodyShape(studioRig, resolveWardrobeDraftBodyShape(currentDraft));
      applyBuddyRigFaceCustomization(
        studioRig,
        resolveWardrobeDraftFaceCustomization(currentDraft, characterGender),
        characterGender,
      );

      if (currentDraft.clothingTintHex) {
        applyCitizenClothingTint(studioRig, currentDraft.clothingTintHex, 0.45);
      } else {
        applyCitizenClothingTint(studioRig, '#ffffff', 0.0);
      }

      const animStyle = resolveWardrobeDraftAnimStyle(currentDraft);
      activeDanceRef.current = { kind: animStyle.danceKind, tempoBpm: animStyle.tempoBpm };
      if (animStyle.externalAnimGlbUrl && animStyle.externalClipKey) {
        const extClip = await loadAndAttachExternalStyleAnimationClip(
          studioRig,
          animStyle.externalAnimGlbUrl,
          animStyle.externalClipKey,
        );
        if (!disposed && extClip) {
          applyStudioClipCandidates([extClip.name]);
        } else if (!disposed) {
          applyStudioClipCandidates(animStyle.clipCandidates);
        }
      } else {
        applyStudioClipCandidates(animStyle.clipCandidates);
      }
      if (!disposed) setIsAvatarLoading(false);
    })();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => {
      setWebglLost(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const activePointers = new Map<number, { x: number; y: number }>();
    let lastPinchDist: number | null = null;
    const getPinchDistance = (): number | null => {
      if (activePointers.size < 2) return null;
      const pts = Array.from(activePointers.values());
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture?.(e.pointerId);
      if (activePointers.size === 1) {
        dragStateRef.current.dragging = true;
        dragStateRef.current.lastX = e.clientX;
        lastPinchDist = null;
      } else if (activePointers.size >= 2) {
        dragStateRef.current.dragging = false;
        lastPinchDist = getPinchDistance();
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (activePointers.size >= 2) {
        const dist = getPinchDistance();
        if (dist !== null && lastPinchDist !== null) {
          const delta = lastPinchDist - dist;
          dragStateRef.current.zoomDelta = THREE.MathUtils.clamp(
            dragStateRef.current.zoomDelta + delta * 0.0065,
            -0.85,
            1.6,
          );
        }
        lastPinchDist = dist;
        return;
      }
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.lastX;
      dragStateRef.current.lastX = e.clientX;
      dragStateRef.current.targetYaw += dx * 0.011;
    };
    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        lastPinchDist = null;
      }
      if (activePointers.size === 1) {
        const remaining = Array.from(activePointers.values())[0];
        dragStateRef.current.dragging = true;
        dragStateRef.current.lastX = remaining.x;
      } else if (activePointers.size === 0) {
        dragStateRef.current.dragging = false;
      }
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dragStateRef.current.zoomDelta = THREE.MathUtils.clamp(
        dragStateRef.current.zoomDelta + e.deltaY * 0.0022,
        -0.85,
        1.6,
      );
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!stageHostRef.current || disposed) return;
      const rw = Math.max(320, stageHostRef.current.clientWidth || window.innerWidth);
      const rh = Math.max(240, stageHostRef.current.clientHeight || window.innerHeight);
      stageWidth = rw;
      stageHeight = rh;
      renderer.setSize(rw, rh, false);
      applyCameraViewOffset(rw, rh, smoothViewOffsetX, smoothViewOffsetY);
      setBlitzStylizedCharViewportSize(rw, rh);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    const curSpec = CAMERA_FRAMING_SPECS[framingRef.current];
    let smoothDist = curSpec.dist;
    let smoothCamY = curSpec.camY;
    let smoothTargetY = curSpec.targetY;
    let smoothFov = curSpec.fov;

    let rafId = 0;
    let prevNow = performance.now();
    let localSmoothedMs = 16.6;
    let frameCounter = 0;
    const danceEuler = new THREE.Euler(0, 0, 0, 'XYZ');
    const danceQuat = new THREE.Quaternion();
    const applyAdditiveBoneRot = (
      bone: THREE.Bone | undefined,
      rx: number,
      ry: number,
      rz: number,
    ) => {
      if (!bone) return;
      danceEuler.set(rx, ry, rz, 'XYZ');
      danceQuat.setFromEuler(danceEuler);
      bone.quaternion.multiply(danceQuat);
    };

    const tick = (now: number) => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(tick);

      const rawDt = (now - prevNow) / 1000;
      prevNow = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      if (rawDt > 0.001 && rawDt < 0.25) {
        localSmoothedMs = localSmoothedMs * 0.92 + rawDt * 1000 * 0.08;
        frameCounter++;
        if (frameCounter % 60 === 0) {
          const quantizedMs = localSmoothedMs >= 26 ? Math.round(localSmoothedMs) : 16.6;
          setStudioFrameMs((prev) => (Math.abs(prev - quantizedMs) >= 4 ? quantizedMs : prev));
        }
      }

      const st = dragStateRef.current;
      st.currentYaw = THREE.MathUtils.damp(st.currentYaw, st.targetYaw, 9.0, dt);
      st.currentZoomDelta = THREE.MathUtils.damp(st.currentZoomDelta, st.zoomDelta, 7.5, dt);
      turntable.rotation.y = st.currentYaw;

      const targetSpec = CAMERA_FRAMING_SPECS[framingRef.current];
      const layoutNow = studioLayoutRef.current;
      const desiredDist = THREE.MathUtils.clamp(targetSpec.dist + st.currentZoomDelta, 1.45, 7.2);
      smoothDist = THREE.MathUtils.damp(smoothDist, desiredDist, 6.8, dt);
      smoothCamY = THREE.MathUtils.damp(smoothCamY, targetSpec.camY, 6.8, dt);
      smoothTargetY = THREE.MathUtils.damp(smoothTargetY, targetSpec.targetY, 6.8, dt);
      smoothFov = THREE.MathUtils.damp(
        smoothFov,
        targetSpec.fov + layoutNow.cameraFovDelta,
        6.8,
        dt,
      );

      const prevOffX = smoothViewOffsetX;
      const prevOffY = smoothViewOffsetY;
      smoothViewOffsetX = THREE.MathUtils.damp(
        smoothViewOffsetX,
        layoutNow.cameraShiftRightPx,
        9.0,
        dt,
      );
      smoothViewOffsetY = THREE.MathUtils.damp(
        smoothViewOffsetY,
        layoutNow.cameraShiftDownPx,
        9.0,
        dt,
      );

      const fovChanged = Math.abs(camera.fov - smoothFov) > 0.05;
      const offsetChanged =
        Math.abs(smoothViewOffsetX - prevOffX) > 0.25 ||
        Math.abs(smoothViewOffsetY - prevOffY) > 0.25;

      if (fovChanged || offsetChanged) {
        camera.fov = smoothFov;
        applyCameraViewOffset(stageWidth, stageHeight, smoothViewOffsetX, smoothViewOffsetY);
      }
      camera.position.set(0, smoothCamY, smoothDist);
      camera.lookAt(0, smoothTargetY, 0);

      const ctrl = studioRig.customGlbController;
      if (ctrl) {
        ctrl.mixer.update(dt);
        const head = ctrl.bones.get('Head');
        if (head) {
          const rawHeadScale = draftRef.current?.headScale ?? 1.0;
          const targetHeadScale =
            typeof rawHeadScale === 'number' && Number.isFinite(rawHeadScale)
              ? Math.max(0.78, Math.min(1.06, rawHeadScale))
              : 1.0;
          head.scale.setScalar(targetHeadScale);
        }

        // Live procedural dance & emote pose overlay driven by Style -> Dance selection
        const danceCfg = activeDanceRef.current;
        if (danceCfg.kind !== 'none') {
          danceClockRef.current += dt;
          const beatHz = (danceCfg.tempoBpm || 110) / 60;
          const phase = danceClockRef.current * beatHz * Math.PI;
          const s1 = Math.sin(phase);
          const s2 = Math.sin(phase * 2);
          const c1 = Math.cos(phase);

          const spine2 = ctrl.bones.get('Spine2');
          const head = ctrl.bones.get('Head');
          const rArm = ctrl.bones.get('RightArm');
          const rFore = ctrl.bones.get('RightForeArm');
          const lArm = ctrl.bones.get('LeftArm');
          const lFore = ctrl.bones.get('LeftForeArm');

          if (danceCfg.kind === 'groove') {
            applyAdditiveBoneRot(spine2, 0.04 * s2, 0.14 * s1, 0.12 * c1);
            applyAdditiveBoneRot(head, 0.08 * s2, -0.08 * s1, 0.06 * c1);
            applyAdditiveBoneRot(rArm, -0.35 + 0.25 * s1, 0.15 * c1, -0.22 + 0.16 * s1);
            applyAdditiveBoneRot(rFore, 0.45 + 0.2 * c1, 0, -0.45);
            applyAdditiveBoneRot(lArm, -0.35 - 0.25 * s1, -0.15 * c1, 0.22 - 0.16 * s1);
            applyAdditiveBoneRot(lFore, 0.45 - 0.2 * c1, 0, 0.45);
          } else if (danceCfg.kind === 'wave') {
            applyAdditiveBoneRot(spine2, -0.04, 0.08, -0.05);
            applyAdditiveBoneRot(head, 0.04, -0.06, 0.12 * Math.sin(phase * 0.5));
            applyAdditiveBoneRot(rArm, -1.15, 0.25, -0.68);
            applyAdditiveBoneRot(rFore, -0.2, 0.15, -0.78 + 0.36 * s2);
            applyAdditiveBoneRot(lArm, 0.08, 0, 0.18);
          } else if (danceCfg.kind === 'cheer') {
            applyAdditiveBoneRot(spine2, -0.08 + 0.06 * s2, 0.06 * s1, 0.06 * c1);
            applyAdditiveBoneRot(head, -0.06 + 0.05 * s2, 0, 0.06 * s1);
            applyAdditiveBoneRot(rArm, -1.35 + 0.16 * s2, 0.15, -0.55);
            applyAdditiveBoneRot(rFore, 0.15, 0, -0.25 + 0.18 * s2);
            applyAdditiveBoneRot(lArm, -1.35 - 0.16 * s2, -0.15, 0.55);
            applyAdditiveBoneRot(lFore, 0.15, 0, 0.25 - 0.18 * s2);
          } else if (danceCfg.kind === 'salute') {
            applyAdditiveBoneRot(spine2, -0.05, 0.04, 0);
            applyAdditiveBoneRot(head, 0.02, -0.04, 0);
            applyAdditiveBoneRot(rArm, -0.95, 0.42, -0.58);
            applyAdditiveBoneRot(rFore, -0.32, 0.22, -1.25);
            applyAdditiveBoneRot(lArm, 0.12, 0, 0.12);
          } else if (danceCfg.kind === 'idol_pop') {
            applyAdditiveBoneRot(spine2, 0.07 * s2, 0.2 * s1, 0.15 * c1);
            applyAdditiveBoneRot(head, 0.09 * s2, -0.14 * s1, 0.11 * c1);
            applyAdditiveBoneRot(rArm, -0.82 + 0.34 * s1, 0.22 * c1, -0.45 + 0.22 * c1);
            applyAdditiveBoneRot(rFore, 0.35 + 0.28 * s2, 0, -0.78 + 0.24 * s1);
            applyAdditiveBoneRot(lArm, -0.72 - 0.34 * s1, -0.22 * c1, 0.45 - 0.22 * c1);
            applyAdditiveBoneRot(lFore, 0.35 - 0.28 * s2, 0, 0.78 - 0.24 * s1);
          } else if (danceCfg.kind === 'hiphop') {
            applyAdditiveBoneRot(spine2, 0.14 + 0.11 * s2, 0.18 * s1, 0.16 * c1);
            applyAdditiveBoneRot(head, 0.14 * s2, -0.1 * s1, 0.08 * c1);
            applyAdditiveBoneRot(rArm, -0.48 + 0.32 * s1, 0.28 * c1, -0.35 + 0.18 * s2);
            applyAdditiveBoneRot(rFore, 0.65 + 0.26 * c1, 0, -0.68);
            applyAdditiveBoneRot(lArm, -0.48 - 0.32 * s1, -0.28 * c1, 0.35 - 0.18 * s2);
            applyAdditiveBoneRot(lFore, 0.65 - 0.26 * c1, 0, 0.68);
          }
        }

        ctrl.secondaryPhysics?.update(dt);
      }

      renderer.render(scene, camera);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      studioRig.customGlbController?.secondaryPhysics?.dispose();
      studioRig.customGlbController?.mixer.stopAllAction();
      rigRef.current = null;
      activePoseActionRef.current = null;

      floorShadowGeo.dispose();
      floorShadowMat.dispose();
      floorShadowTex.dispose();
      renderer.dispose();
    };
    // Rebuild studio stage cleanly when opened or gender changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, characterGender]);

  // Async modular GLB garment swap — runs ONLY when modular garment slot IDs change
  useEffect(() => {
    if (!isOpen) return;
    const rig = rigRef.current;
    if (!rig || !rig.customGlbController) return;
    let cancelled = false;
    (async () => {
      const currentDraft = draftRef.current;
      const baseUrls = resolveWardrobeDraftToModularOutfitUrls(currentDraft, characterGender);
      const previewBare =
        activeBottomTab === 'outfit' && activeCategory === 'underwear' && underwearPreviewBare;
      const urls = {
        ...baseUrls,
        hideOuterClothes: Boolean(baseUrls.hideOuterClothes) || previewBare,
      };
      await setBuddyRigModularOutfitUrls(rig, urls);
      if (cancelled) return;
      const latestDraft = draftRef.current;
      applyBuddyRigBodyShape(rig, resolveWardrobeDraftBodyShape(latestDraft));
      applyBuddyRigFaceCustomization(
        rig,
        resolveWardrobeDraftFaceCustomization(latestDraft, characterGender),
        characterGender,
      );
      if (latestDraft.clothingTintHex) {
        applyCitizenClothingTint(rig, latestDraft.clothingTintHex, 0.45);
      } else {
        applyCitizenClothingTint(rig, '#ffffff', 0.0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    draft.setId,
    draft.topId,
    draft.bottomsId,
    draft.shoesId,
    draft.hairId,
    draft.hideOuterForUnderwear,
    characterGender,
    externalCatalogRevision,
    activeBottomTab,
    activeCategory,
    underwearPreviewBare,
  ]);

  // Instant 60 FPS synchronous sync for Face Tuning, Nose, Makeup, Body Shape, Head Scale & Dye
  useEffect(() => {
    if (!isOpen) return;
    const rig = rigRef.current;
    if (!rig || !rig.customGlbController) return;
    applyBuddyRigBodyShape(rig, resolveWardrobeDraftBodyShape(draft));
    applyBuddyRigFaceCustomization(
      rig,
      resolveWardrobeDraftFaceCustomization(draft, characterGender),
      characterGender,
    );
    if (draft.clothingTintHex) {
      applyCitizenClothingTint(rig, draft.clothingTintHex, 0.45);
    } else {
      applyCitizenClothingTint(rig, '#ffffff', 0.0);
    }
  }, [
    isOpen,
    characterGender,
    externalCatalogRevision,
    draft.bodyShapeId,
    draft.headScale,
    draft.eyeStyleId,
    draft.browStyleId,
    draft.lipStyleId,
    draft.eyeshadowId,
    draft.blushId,
    draft.facepaintId,
    draft.beardId,
    draft.underwearId,
    draft.corewearId,
    draft.hideBaseUnderwear,
    draft.hideBaseBra,
    draft.noseStyleId,
    draft.lipScale,
    draft.lipOffsetY,
    draft.eyeSpacing,
    draft.eyeTiltDeg,
    draft.eyeScale,
    draft.browOffsetY,
    draft.browTiltDeg,
    draft.clothingTintHex,
  ]);

  // Animation Set (Idle/Walk/Run/Sit preview), Dance, Pose & Action sync inside the live studio
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const animStyle = resolveWardrobeDraftAnimStyle(draft);
    activeDanceRef.current = { kind: animStyle.danceKind, tempoBpm: animStyle.tempoBpm };

    const isPreviewingAnimSetState =
      activeBottomTab === 'style' &&
      activeStyleCategory === 'style_anim' &&
      !draft.dancePoseId &&
      !draft.stylePoseId &&
      !draft.styleActionId;

    let targetGlbUrl = animStyle.externalAnimGlbUrl;
    let targetClipKey = animStyle.externalClipKey;
    let targetCandidates = animStyle.clipCandidates;

    const pairedItem =
      activeBottomTab === 'style' && activeStyleCategory === 'style_paired'
        ? getWardrobeCatalogItemById(draft.stylePairedId)
        : null;

    if (pairedItem?.pairedAnim) {
      targetGlbUrl =
        pairedPreviewRole === 'receive'
          ? pairedItem.pairedAnim.receiveGlbUrl
          : pairedItem.pairedAnim.initiateGlbUrl;
      targetClipKey = `${pairedItem.id}_${pairedPreviewRole}`;
    } else if (isPreviewingAnimSetState && animSetPreviewState !== 'idle') {
      if (animSetPreviewState === 'walk') {
        targetGlbUrl = animStyle.walkGlbUrl;
        targetClipKey = animStyle.walkClipKey;
        targetCandidates = animStyle.walkClipCandidates.length > 0 ? animStyle.walkClipCandidates : ['walk.001'];
      } else if (animSetPreviewState === 'run') {
        targetGlbUrl = animStyle.runGlbUrl;
        targetClipKey = animStyle.runClipKey;
        targetCandidates = animStyle.runClipCandidates.length > 0 ? animStyle.runClipCandidates : ['run.001'];
      } else if (animSetPreviewState === 'sit') {
        targetGlbUrl = animStyle.sitGlbUrl;
        targetClipKey = animStyle.sitClipKey;
        targetCandidates = animStyle.sitClipCandidates.length > 0 ? animStyle.sitClipCandidates : ['sitting.001'];
      }
    }

    if (targetGlbUrl && targetClipKey) {
      const rig = rigRef.current;
      if (rig && rig.customGlbController) {
        void loadAndAttachExternalStyleAnimationClip(rig, targetGlbUrl, targetClipKey).then(
          (extClip) => {
            if (!cancelled && extClip) {
              applyStudioClipCandidates([extClip.name]);
            }
          },
        );
      }
    } else {
      applyStudioClipCandidates(targetCandidates);
    }
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    isAvatarLoading,
    activeBottomTab,
    activeStyleCategory,
    animSetPreviewState,
    pairedPreviewRole,
    draft.animSetId,
    draft.dancePoseId,
    draft.stylePoseId,
    draft.styleActionId,
    draft.stylePairedId,
    applyStudioClipCandidates,
    draft,
    externalCatalogRevision,
  ]);

  const handleSelectItem = useCallback((item: WardrobeCatalogItem) => {
    soundEngine.playUiClick();
    if (
      item.slot === 'body_shape' ||
      item.slot === 'style_anim' ||
      item.slot === 'style_dance' ||
      item.slot === 'style_pose' ||
      item.slot === 'style_action'
    ) {
      setCameraFraming('full');
    } else if (
      item.slot === 'face_eyes' ||
      item.slot === 'face_brows' ||
      item.slot === 'face_lips' ||
      item.slot === 'face_eyeshadow' ||
      item.slot === 'face_blush' ||
      item.slot === 'face_facepaint' ||
      item.slot === 'face_beard' ||
      item.slot === 'face_nose'
    ) {
      setCameraFraming('face');
    }
    setHistory((prev) => pushWardrobeDraft(prev, applyItemSelectionToDraft(prev.present, item)));
  }, []);

  const handleSelectPreset = useCallback(
    (preset: WardrobeSavedPreset) => {
      soundEngine.playUiConfirm();
      const targetGender: 'male' | 'female' =
        preset.gender === 'male' || preset.gender === 'female' ? preset.gender : characterGender;
      if (targetGender !== characterGender) {
        onChangeGender(targetGender);
      }
      setHistoryByGender((prev) => ({
        ...prev,
        [targetGender]: pushWardrobeDraft(prev[targetGender], {
          ...EMPTY_WARDROBE_DRAFT,
          ...preset.draft,
        }),
      }));
      showNotice(`Loaded character "${preset.name}"`);
    },
    [characterGender, onChangeGender, showNotice],
  );

  const handleSavePreset = useCallback(() => {
    soundEngine.playUiConfirm();
    const newPreset = createSavedPresetFromDraft(
      draft,
      savedPresets.length,
      Date.now(),
      characterGender,
    );
    const next = [newPreset, ...savedPresets].slice(0, 12);
    setSavedPresets(next);
    persistSavedWardrobePresets(accountKey, next);
    showNotice(
      `Saved "${newPreset.name}" (${characterGender === 'female' ? 'Female' : 'Male'})`,
    );
  }, [accountKey, characterGender, draft, savedPresets, showNotice]);

  const handleDeleteSavedPreset = useCallback(
    (presetId: string) => {
      soundEngine.playUiClick();
      const next = savedPresets.filter((p) => p.id !== presetId);
      setSavedPresets(next);
      persistSavedWardrobePresets(accountKey, next);
      showNotice('Removed saved character');
    },
    [accountKey, savedPresets, showNotice],
  );

  const handleRemoveAll = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) => pushWardrobeDraft(prev, { ...EMPTY_WARDROBE_DRAFT }));
    showNotice('Reset outfit to Starter Essentials');
  }, [setHistory, showNotice]);

  const handleBuyPreviewItem = useCallback(
    (item: WardrobeCatalogItem) => {
      const res = onPurchaseItem(item);
      if (res.ok) {
        soundEngine.playUiConfirm();
        showNotice(`Unlocked "${item.name}" and added to Owned Wardrobe`);
      } else {
        soundEngine.playUiClick();
        showNotice(res.errorMessage || 'Not enough CerCoins');
      }
    },
    [onPurchaseItem, showNotice],
  );

  const handleCommitComplete = useCallback(() => {
    soundEngine.playUiConfirm();
    const safeMale = sanitizeDraftToOwnedOnly(
      historyByGender.male.present,
      ownedApparelIds,
      'male',
    );
    const safeFemale = sanitizeDraftToOwnedOnly(
      historyByGender.female.present,
      ownedApparelIds,
      'female',
    );
    const ownedOnly = characterGender === 'male' ? safeMale : safeFemale;
    onComplete(ownedOnly, { male: safeMale, female: safeFemale });
  }, [historyByGender, ownedApparelIds, characterGender, onComplete]);

  const handleCycleFilter = useCallback(() => {
    soundEngine.playUiClick();
    setFilterMode((prev) => (prev === 'all' ? 'owned' : prev === 'owned' ? 'shop' : 'all'));
  }, []);

  const handleCycleSort = useCallback(() => {
    soundEngine.playUiClick();
    setSortMode((prev) =>
      prev === 'featured' ? 'price_asc' : prev === 'price_asc' ? 'price_desc' : 'featured',
    );
  }, []);

  const handleResetFace = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        eyeStyleId: null,
        browStyleId: null,
        lipStyleId: null,
        eyeshadowId: null,
        blushId: null,
        facepaintId: null,
        beardId: null,
        noseStyleId: 'face_nose_default',
        lipScale: 1.0,
        lipOffsetY: 0,
        eyeSpacing: 0,
        eyeTiltDeg: 0,
        eyeScale: 1.0,
        browOffsetY: 0,
        browTiltDeg: 0,
        headScale: 1.0,
      }),
    );
    showNotice('Reset face to Natural Starter');
  }, [showNotice]);

  const handleResetFaceTuning = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        lipScale: 1.0,
        lipOffsetY: 0,
        eyeSpacing: 0,
        eyeTiltDeg: 0,
        eyeScale: 1.0,
        browOffsetY: 0,
        browTiltDeg: 0,
      }),
    );
    showNotice('Reset face fine-tuning');
  }, [showNotice]);

  const handleResetHeadScale = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        headScale: 1.0,
      }),
    );
    showNotice('Reset head scale to 1.00x');
  }, [showNotice]);

  const sliderDragAnchorRef = useRef<WardrobeOutfitDraft | null>(null);
  const beginSliderDrag = useCallback(() => {
    sliderDragAnchorRef.current = { ...draftRef.current };
  }, []);
  const endSliderDrag = useCallback(() => {
    sliderDragAnchorRef.current = null;
  }, []);

  const updateDraftTuning = useCallback(
    (key: keyof WardrobeOutfitDraft, val: number | string | null, liveDrag = false) => {
      setHistory((prev) => {
        const nextPresent: WardrobeOutfitDraft = {
          ...prev.present,
          [key]: val,
        };
        if (liveDrag && sliderDragAnchorRef.current) {
          // Keep ONE clean undo entry for the whole slider drag instead of flooding all 25 slots
          const anchor = sliderDragAnchorRef.current;
          const lastPast = prev.past[prev.past.length - 1];
          const pastHasAnchor = lastPast && lastPast === anchor;
          return {
            past: pastHasAnchor ? prev.past : [...prev.past, anchor].slice(-25),
            present: nextPresent,
            future: [],
          };
        }
        return pushWardrobeDraft(prev, nextPresent);
      });
    },
    [],
  );

  const handleResetBody = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        bodyShapeId: null,
      }),
    );
    showNotice('Reset body shape to Balanced');
  }, [showNotice]);

  const handleResetStyle = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        animSetId: DEFAULT_WARDROBE_ANIM_SET_ID,
        dancePoseId: null,
        stylePoseId: null,
        styleActionId: null,
        stylePairedId: null,
        clothingTintHex: null,
      }),
    );
    showNotice('Reset animation, dance & dye to Classic Core');
  }, [showNotice]);

  const handleBottomTabClick = useCallback(
    (tab: WardrobeBottomTabId) => {
      soundEngine.playUiClick();
      setActiveBottomTab(tab);
      if (tab === 'character') {
        setFilterMode('all');
        setCameraFraming((prev) => (prev === 'face' ? 'upper' : prev));
      } else if (tab === 'face') {
        setFilterMode('all');
        setCameraFraming('face');
      } else if (tab === 'body') {
        setFilterMode('all');
        setCameraFraming('full');
      } else if (tab === 'style') {
        setFilterMode('all');
        setCameraFraming('full');
      } else if (tab === 'outfit') {
        if (activeCategory === 'presets') setActiveCategory('top');
        setFilterMode('all');
        setCameraFraming((prev) => (prev === 'face' ? 'upper' : prev));
      } else if (tab === 'shop') {
        if (activeCategory === 'presets') setActiveCategory('top');
        setFilterMode('shop');
        setCameraFraming((prev) => (prev === 'face' ? 'upper' : prev));
      }
    },
    [activeCategory],
  );

  const isItemSelectedInDraft = useCallback(
    (item: WardrobeCatalogItem): boolean => {
      if (item.slot === 'set') return draft.setId === item.id;
      if (item.slot === 'top') {
        return item.isStarterDefault ? draft.topId === null && draft.setId === null : draft.topId === item.id;
      }
      if (item.slot === 'bottoms') {
        return item.isStarterDefault
          ? draft.bottomsId === null && draft.setId === null
          : draft.bottomsId === item.id;
      }
      if (item.slot === 'shoes') {
        return item.isStarterDefault
          ? draft.shoesId === null && draft.setId === null
          : draft.shoesId === item.id;
      }
      if (item.slot === 'hair') {
        return item.isStarterDefault ? draft.hairId === null : draft.hairId === item.id;
      }
      if (item.slot === 'underwear') {
        if (item.isStarterDefault) {
          return (
            (draft.underwearId ?? null) === null &&
            (draft.corewearId ?? null) === null &&
            Boolean(draft.hideBaseUnderwear)
          );
        }
        if (item.underwearSubSlot === 'corewear') {
          return draft.corewearId === item.id;
        }
        if (
          characterGender === 'male' &&
          item.id === DEFAULT_MALE_UNDERWEAR_ITEM_ID &&
          (draft.underwearId ?? null) === null &&
          !draft.hideBaseUnderwear
        ) {
          return true;
        }
        return draft.underwearId === item.id;
      }
      if (item.slot === 'body_shape') {
        return item.isStarterDefault ? draft.bodyShapeId === null : draft.bodyShapeId === item.id;
      }
      if (item.slot === 'face_eyes') {
        return item.isStarterDefault ? draft.eyeStyleId === null : draft.eyeStyleId === item.id;
      }
      if (item.slot === 'face_brows') {
        return item.isStarterDefault ? draft.browStyleId === null : draft.browStyleId === item.id;
      }
      if (item.slot === 'face_lips') {
        return item.isStarterDefault ? draft.lipStyleId === null : draft.lipStyleId === item.id;
      }
      if (item.slot === 'face_eyeshadow') {
        return item.isStarterDefault
          ? (draft.eyeshadowId ?? null) === null
          : draft.eyeshadowId === item.id;
      }
      if (item.slot === 'face_blush') {
        return item.isStarterDefault
          ? (draft.blushId ?? null) === null
          : draft.blushId === item.id;
      }
      if (item.slot === 'face_facepaint') {
        return item.isStarterDefault
          ? (draft.facepaintId ?? null) === null
          : draft.facepaintId === item.id;
      }
      if (item.slot === 'face_beard') {
        return item.isStarterDefault
          ? (draft.beardId ?? null) === null
          : draft.beardId === item.id;
      }
      if (item.slot === 'face_nose') {
        const currentNose = draft.noseStyleId ?? 'face_nose_default';
        return item.isStarterDefault
          ? currentNose === 'face_nose_default' || !draft.noseStyleId
          : currentNose === item.id;
      }
      if (item.slot === 'style_anim') {
        const effectiveAnimSetId = draft.animSetId ?? DEFAULT_WARDROBE_ANIM_SET_ID;
        return effectiveAnimSetId === item.id;
      }
      if (item.slot === 'style_dance') {
        return item.isStarterDefault ? draft.dancePoseId === null : draft.dancePoseId === item.id;
      }
      if (item.slot === 'style_pose') {
        return item.isStarterDefault
          ? (draft.stylePoseId ?? null) === null
          : draft.stylePoseId === item.id;
      }
      if (item.slot === 'style_action') {
        return item.isStarterDefault
          ? (draft.styleActionId ?? null) === null
          : draft.styleActionId === item.id;
      }
      if (item.slot === 'style_paired') {
        return item.isStarterDefault
          ? (draft.stylePairedId ?? null) === null
          : draft.stylePairedId === item.id;
      }
      return false;
    },
    [draft, characterGender],
  );

  const partitionedSlotItems = useMemo(() => {
    if (activeCategory === 'presets') {
      return { owned: [], shop: [], allVisible: [] };
    }
    const base = partitionWardrobeCategoryItems(
      activeCategory,
      ownedApparelIds,
      filterMode,
      sortMode,
      characterGender,
    );
    const q = outfitSearchQuery.trim().toLowerCase();
    const match = (item: WardrobeCatalogItem) => {
      if (activeCategory === 'underwear' && underwearSubFilter !== 'all' && !item.isStarterDefault) {
        const sub = item.underwearSubSlot ?? 'underwear';
        if (sub !== underwearSubFilter) return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.collection.toLowerCase().includes(q)
      );
    };
    if (!q && (activeCategory !== 'underwear' || underwearSubFilter === 'all')) return base;
    const owned = base.owned.filter(match);
    const shop = base.shop.filter(match);
    return { owned, shop, allVisible: [...owned, ...shop] };
  }, [
    activeCategory,
    ownedApparelIds,
    filterMode,
    sortMode,
    characterGender,
    externalCatalogRevision,
    outfitSearchQuery,
    underwearSubFilter,
  ]);

  const partitionedFaceItems = useMemo(
    () =>
      partitionWardrobeCategoryItems(
        activeFaceCategory,
        ownedApparelIds,
        filterMode,
        sortMode,
        characterGender,
      ),
    [activeFaceCategory, ownedApparelIds, filterMode, sortMode, characterGender, externalCatalogRevision],
  );

  const partitionedBodyShapeItems = useMemo(
    () =>
      partitionWardrobeCategoryItems(
        'body_shape',
        ownedApparelIds,
        filterMode,
        sortMode,
        characterGender,
      ),
    [ownedApparelIds, filterMode, sortMode, characterGender],
  );

  const partitionedStyleItems = useMemo(() => {
    if (activeStyleCategory === 'style_tint') {
      return { owned: [], shop: [], allVisible: [] };
    }
    return partitionWardrobeCategoryItems(
      activeStyleCategory,
      ownedApparelIds,
      filterMode,
      sortMode,
      characterGender,
    );
  }, [activeStyleCategory, ownedApparelIds, filterMode, sortMode, characterGender, externalCatalogRevision]);

  if (!isOpen) return null;

  const panelHeaderTitle =
    activeBottomTab === 'character'
      ? 'Character'
      : activeBottomTab === 'face'
        ? activeFaceCategory === 'face_tuning'
          ? 'Face · Tuning'
          : activeFaceCategory === 'face_nose'
            ? 'Face · Nose'
            : activeFaceCategory === 'face_head'
              ? 'Face · Head'
              : activeFaceCategory === 'face_eyes'
                ? 'Face · Eyes'
                : activeFaceCategory === 'face_brows'
                  ? 'Face · Eyebrows'
                  : activeFaceCategory === 'face_lips'
                    ? 'Face · Lips'
                    : activeFaceCategory === 'face_eyeshadow'
                      ? 'Face · Eyeshadow'
                      : activeFaceCategory === 'face_blush'
                        ? 'Face · Blush'
                        : activeFaceCategory === 'face_beard'
                          ? 'Face · Beard'
                          : 'Face · Makeup'
        : activeBottomTab === 'body'
          ? 'Body Shape'
          : activeBottomTab === 'style'
            ? activeStyleCategory === 'style_anim'
              ? 'Style · Animation Set'
              : activeStyleCategory === 'style_dance'
                ? 'Style · Dance'
                : activeStyleCategory === 'style_pose'
                  ? 'Style · Poses'
                  : activeStyleCategory === 'style_action'
                    ? 'Style · Actions'
                    : activeStyleCategory === 'style_paired'
                      ? 'Style · Paired (Duo)'
                      : 'Style · Garment Dye'
            : activeBottomTab === 'shop'
              ? 'Boutique Shop'
              : activeCategory === 'top'
                ? 'Top'
                : activeCategory === 'bottoms'
                  ? 'Bottoms'
                  : activeCategory === 'set'
                    ? 'Full Set'
                    : activeCategory === 'hair'
                      ? 'Hair'
                      : activeCategory === 'underwear'
                        ? 'Underwear'
                        : 'Shoes';

  const orbSizeClass =
    studioLayout.mode === 'phone_landscape_split'
      ? 'w-[60px] h-[60px]'
      : studioLayout.isPortraitSheet
        ? 'w-[68px] h-[68px] sm:w-[76px] sm:h-[76px]'
        : studioLayout.mode === 'tablet_split'
          ? 'w-[74px] h-[74px]'
          : 'w-[82px] h-[82px]';
  const itemGridClass =
    studioLayout.gridCols === 4
      ? 'grid grid-cols-4 gap-x-2.5 gap-y-3.5'
      : studioLayout.mode === 'phone_landscape_split'
        ? 'grid grid-cols-3 gap-x-2 gap-y-3'
        : 'grid grid-cols-3 gap-x-3 gap-y-4';
  const railBodyWrapperClass = studioLayout.useHorizontalCategoryStrip
    ? 'flex-1 flex flex-col min-h-0'
    : 'flex-1 flex min-h-0';
  const railNavClass = studioLayout.useHorizontalCategoryStrip
    ? 'shrink-0 py-2 px-3 border-b border-white/[0.10] flex flex-row items-center gap-2.5 overflow-x-auto no-scrollbar'
    : studioLayout.mode === 'phone_landscape_split'
      ? 'w-[58px] shrink-0 py-2.5 px-1 border-r border-white/[0.10] flex flex-col items-center gap-2.5 overflow-y-auto no-scrollbar'
      : 'w-[74px] shrink-0 py-3 px-1.5 border-r border-white/[0.10] flex flex-col items-center gap-3 overflow-y-auto no-scrollbar';
  const railBtnClass = studioLayout.useHorizontalCategoryStrip
    ? 'flex flex-col items-center gap-1 shrink-0 min-w-[48px] cursor-pointer group focus-visible:outline-none'
    : 'flex flex-col items-center gap-1 w-full cursor-pointer group focus-visible:outline-none';
  const railIconBubbleClass = studioLayout.mode === 'phone_landscape_split' || studioLayout.useHorizontalCategoryStrip
    ? 'w-9 h-9'
    : 'w-10 h-10';

  const renderCircularItemButton = (item: WardrobeCatalogItem, owned: boolean) => {
    const selected = isItemSelectedInDraft(item);
    const thumbUrl = thumbMap[item.id];
    const isFaceItem =
      item.slot === 'face_eyes' ||
      item.slot === 'face_brows' ||
      item.slot === 'face_lips' ||
      item.slot === 'face_eyeshadow' ||
      item.slot === 'face_blush' ||
      item.slot === 'face_facepaint' ||
      item.slot === 'face_beard' ||
      item.slot === 'face_nose';
    const isStyleMotionItem =
      item.slot === 'style_anim' ||
      item.slot === 'style_dance' ||
      item.slot === 'style_pose' ||
      item.slot === 'style_action' ||
      item.slot === 'style_paired';
    return (
      <button
        key={item.id}
        type="button"
        data-wardrobe-item-btn={item.id}
        onClick={() => handleSelectItem(item)}
        className="group flex flex-col items-center gap-1.5 text-center cursor-pointer focus-visible:outline-none"
        title={`${item.name} · ${owned ? 'Owned' : `${getWardrobeCatalogItemPriceCyon(item)} CerCoins`}`}
      >
        <div
          className={`relative ${orbSizeClass} rounded-full overflow-hidden flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.04] group-active:scale-95 ${
            selected
              ? 'ring-2 ring-white shadow-[0_0_0_4px_rgba(138,216,255,0.35)]'
              : 'ring-1 ring-white/20 group-hover:ring-white/45'
          }`}
          style={{
            background: isStyleMotionItem
              ? MOTION_SILHOUETTE_ORB_BG
              : `radial-gradient(circle at 32% 28%, ${item.swatchGradient[0]}, ${item.swatchGradient[1]})`,
          }}
        >
          {item.slot === 'body_shape' ? (
            <BodyShapeSilhouetteGlyph item={item} />
          ) : isFaceItem ? (
            <FaceFeaturePreviewGlyph item={item} />
          ) : item.slot === 'underwear' ? (
            item.thumbUrl ? (
              <img
                src={item.thumbUrl}
                alt={item.name}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-0.5 text-white/90 drop-shadow-[0_3px_8px_rgba(0,0,0,0.4)]">
                <UnderwearGlyphIcon className="w-7 h-7" />
                <span className="text-[9px] font-semibold tracking-wide uppercase">Bare</span>
              </div>
            )
          ) : isStyleMotionItem ? (
            <MotionSilhouetteThumb
              wardrobeItemId={item.id}
              alt={item.name}
              isPaired={item.slot === 'style_paired'}
            />
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              className="w-[90%] h-[90%] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/90">
              {item.slot === 'top' && <Shirt className="w-7 h-7 stroke-[1.75]" />}
              {item.slot === 'bottoms' && <UserRound className="w-7 h-7 stroke-[1.75]" />}
              {item.slot === 'shoes' && <Footprints className="w-7 h-7 stroke-[1.75]" />}
              {item.slot === 'hair' && <Wind className="w-7 h-7 stroke-[1.75]" />}
              {item.slot === 'set' && <Crown className="w-7 h-7 stroke-[1.75]" />}
            </div>
          )}

          {!owned && (
            <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-[#151115]/90 border border-white/25 flex items-center justify-center text-amber-300">
              <Lock className="w-2.5 h-2.5" />
            </span>
          )}
          {selected && owned && (
            <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-[#8ad8ff] text-slate-950 flex items-center justify-center shadow">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
          )}
        </div>

        <div className="w-full px-0.5">
          <div className="text-[11px] font-medium text-white/92 truncate leading-tight">
            {item.name}
          </div>
          <div className="text-[10px] text-white/55 tabular-nums leading-tight mt-0.5">
            {owned
              ? item.isStarterDefault
                ? 'Starter'
                : item.priceLul === 0
                  ? 'Free'
                  : 'Owned'
              : `${getWardrobeCatalogItemPriceCyon(item)} CerCoins`}
          </div>
        </div>
      </button>
    );
  };

  const studioToolbarPill = (
    <div
      className={`inline-flex w-fit items-center gap-0.5 px-1.5 sm:px-2 py-1 rounded-full shrink-0 ${glassPillClass}`}
    >
      <button
        type="button"
        onClick={() => {
          soundEngine.playUiClick();
          setCameraFraming('upper');
        }}
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
          cameraFraming === 'upper'
            ? 'bg-white text-slate-950'
            : 'text-white/85 hover:text-white hover:bg-white/12'
        }`}
        title="Upper Body Portrait"
        aria-label="Upper Body Portrait"
      >
        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          soundEngine.playUiClick();
          setCameraFraming('full');
        }}
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
          cameraFraming === 'full'
            ? 'bg-white text-slate-950'
            : 'text-white/85 hover:text-white hover:bg-white/12'
        }`}
        title="Full Body View"
        aria-label="Full Body View"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-4 bg-white/15 mx-0.5 sm:mx-1 shrink-0" aria-hidden="true" />

      <button
        type="button"
        disabled={history.past.length === 0}
        onClick={() => {
          soundEngine.playUiClick();
          setHistory((h) => undoWardrobeDraft(h));
        }}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
      <button
        type="button"
        disabled={history.future.length === 0}
        onClick={() => {
          soundEngine.playUiClick();
          setHistory((h) => redoWardrobeDraft(h));
        }}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {characterGender === 'female' && (
        <>
          <span className="w-px h-4 bg-white/15 mx-0.5 sm:mx-1 shrink-0" aria-hidden="true" />
          <button
            type="button"
            data-wardrobe-bra-toggle="true"
            aria-pressed={Boolean(draft.hideBaseBra)}
            onClick={() => {
              soundEngine.playUiClick();
              const nextNoBra = !Boolean(draft.hideBaseBra);
              setHistory((prev) =>
                pushWardrobeDraft(prev, {
                  ...prev.present,
                  hideBaseBra: nextNoBra,
                }),
              );
              showNotice(nextNoBra ? 'No Bra active' : 'Bra restored');
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              draft.hideBaseBra
                ? 'bg-white text-slate-950'
                : 'text-white/85 hover:text-white hover:bg-white/12'
            }`}
            title={draft.hideBaseBra ? 'No Bra (Click to Show Bra)' : 'Bra On (Click for No Bra)'}
            aria-label={draft.hideBaseBra ? 'No Bra' : 'Toggle No Bra'}
          >
            <BraToggleIcon
              slashed={Boolean(draft.hideBaseBra)}
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            />
          </button>
        </>
      )}
    </div>
  );

  const studioBalanceAndClose = (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <button
        type="button"
        data-wardrobe-close-btn="true"
        onClick={() => {
          soundEngine.playUiClick();
          onClose();
        }}
        className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-full bg-white hover:bg-slate-100 text-slate-950 text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-colors cursor-pointer whitespace-nowrap"
      >
        <X className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden sm:inline">Exit Wardrobe</span>
        <span className="sm:hidden">Exit</span>
      </button>
    </div>
  );

  const panelPositionClass = studioLayout.isPortraitSheet
    ? `left-2 right-2 sm:left-4 sm:right-4 bottom-[calc(58px+var(--safe-bottom))] transition-[height] duration-200 ease-out ${
        isPortraitSheetCollapsed ? 'h-[46px]' : 'h-[45dvh] max-h-[450px] min-h-[250px]'
      }`
    : studioLayout.mode === 'phone_landscape_split'
      ? 'top-[50px] right-[max(0.625rem,var(--safe-right))] bottom-[52px]'
      : studioLayout.mode === 'tablet_split'
        ? 'top-[60px] right-4 bottom-[68px]'
        : 'top-[64px] right-5 bottom-[74px] w-[420px] max-w-[calc(100vw-24px)]';

  const panelInlineStyle: React.CSSProperties | undefined =
    !studioLayout.isPortraitSheet && studioLayout.mode !== 'desktop_split'
      ? { width: `${studioLayout.panelWidthPx}px` }
      : undefined;

  return (
    <div
      data-wardrobe-studio-modal="true"
      data-wardrobe-layout-mode={studioLayout.mode}
      className="fixed inset-0 z-[95] overflow-hidden select-none text-white"
      style={{ fontFamily: '"Plus Jakarta Sans", "Outfit", system-ui, sans-serif' }}
    >
      {/* 1. Dedicated Cozy Warm Dressing Room Studio Backdrop */}
      <div className="absolute inset-0 bg-[#1a1316]">
        <img
          src={studioBackdropUrl}
          alt="Wardrobe Dressing Room"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center scale-[1.03] brightness-[0.94] contrast-[1.03]"
        />
        {/* Subtle studio cinematic vignette & reading scrim */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 34% 48%, rgba(255,232,208,0.06) 0%, rgba(18,12,16,0.34) 62%, rgba(12,8,12,0.72) 100%)',
          }}
        />
      </div>

      {/* 2. Live Interactive 3D Avatar Viewport */}
      <div ref={stageHostRef} className="absolute inset-0 z-[5]" />

      {/* Loading / WebGL fallback indicator */}
      {(isAvatarLoading || webglLost) && (
        <div
          className={`pointer-events-none absolute z-[8] flex items-center justify-center ${
            studioLayout.isPortraitSheet
              ? 'top-14 inset-x-0 bottom-[50dvh]'
              : 'inset-y-0 left-0 right-0 md:right-[430px]'
          }`}
        >
          <div className={`px-4 py-2 rounded-full text-xs font-medium text-white/90 ${glassPillClass}`}>
            {webglLost ? 'Avatar preview paused — graphics unavailable' : 'Loading avatar preview…'}
          </div>
        </div>
      )}

      {/* 3 & 4. Adaptive Top Bar: unified non-colliding bar on mobile/tablet; classic split on desktop */}
      {studioLayout.isCompactTopBar ? (
        <div
          className="absolute inset-x-2.5 sm:inset-x-4 z-20 flex items-center justify-between gap-2 pointer-events-none"
          style={{ top: 'max(0.5rem, var(--safe-top))' }}
        >
          <div className="pointer-events-auto min-w-0 flex-1 overflow-x-auto no-scrollbar">
            {studioToolbarPill}
          </div>
          <div className="pointer-events-auto shrink-0">{studioBalanceAndClose}</div>
        </div>
      ) : (
        <>
          <div className="absolute top-4 left-[35%] -translate-x-1/2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-full">
            {studioToolbarPill}
          </div>
          <div className="absolute top-4 right-5 z-20">{studioBalanceAndClose}</div>
        </>
      )}

      {/* Subtle status toast under top toolbar */}
      {statusNotice && (
        <div
          className={`pointer-events-none absolute z-20 left-1/2 -translate-x-1/2 max-w-[calc(100vw-1.5rem)] ${
            studioLayout.isCompactTopBar
              ? 'top-[52px]'
              : 'top-[62px] md:left-[35%]'
          }`}
        >
          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium text-white/95 flex items-center gap-2 ${glassPillClass}`}
          >
            <span className="truncate">{statusNotice}</span>
          </div>
        </div>
      )}

      {/* Drag hint subtle unobtrusive bottom-left helper above bottom bar */}
      {!studioLayout.isPortraitSheet && studioLayout.mode !== 'phone_landscape_split' && (
        <div className="hidden md:flex pointer-events-none absolute bottom-[78px] left-6 z-10 items-center gap-2 text-[11px] text-white/60">
          <span>Drag avatar to rotate 360°</span>
          <span aria-hidden="true">·</span>
          <span>Scroll to zoom</span>
        </div>
      )}

      {/* 5. Adaptive Smoked-Glass Wardrobe Panel (Right Panel on Desktop/Landscape, Bottom Sheet on Portrait) */}
      <aside
        data-wardrobe-glass-panel="true"
        data-wardrobe-glass-mode={resolvedGlassMode}
        style={panelInlineStyle}
        className={`absolute z-20 rounded-2xl flex flex-col overflow-hidden ${panelPositionClass} ${glassSurfaceClass}`}
      >
        {/* Panel Header */}
        <div className="px-4 sm:px-5 py-2.5 sm:pt-4 sm:pb-3 border-b border-white/[0.14] flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {studioLayout.isPortraitSheet && (
              <button
                type="button"
                data-wardrobe-sheet-toggle="true"
                onClick={() => {
                  soundEngine.playUiClick();
                  setIsPortraitSheetCollapsed((prev) => !prev);
                }}
                aria-label={isPortraitSheetCollapsed ? 'Expand Wardrobe Panel' : 'Collapse Wardrobe Panel'}
                title={isPortraitSheetCollapsed ? 'Expand Panel' : 'Full Avatar View'}
                className="w-7 h-7 rounded-full bg-white/[0.10] hover:bg-white/[0.20] text-white/90 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                {isPortraitSheetCollapsed ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
            <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-wide text-white truncate">
              {panelHeaderTitle}
            </h2>
          </div>
          <div className="flex items-center gap-1 text-white/75 shrink-0">
            <button
              type="button"
              onClick={handleRemoveAll}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Reset Outfit to Default"
              aria-label="Reset Outfit"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={handleCycleSort}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={`Sort: ${sortMode === 'featured' ? 'Featured' : sortMode === 'price_asc' ? 'Price Low-High' : 'Price High-Low'}`}
              aria-label="Sort Items"
            >
              <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={handleCycleFilter}
              className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterMode !== 'all'
                  ? 'bg-white/18 text-white'
                  : 'hover:text-white hover:bg-white/10 text-white/75'
              }`}
              title="Filter: All / Owned / Shop"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{filterMode === 'all' ? 'All' : filterMode === 'owned' ? 'Owned' : 'Shop'}</span>
            </button>
          </div>
        </div>

        {/* Panel Body: Character | Face | Body Shape | Style (Anim/Dance/Dye) | Outfit & Shop */}
        {isPortraitSheetCollapsed ? null : activeBottomTab === 'character' ? (
          <div
            data-wardrobe-character-panel="true"
            className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
          >
            {/* Avatar Frame / Gender Switcher (Male / Female) */}
            <section className="space-y-2">
              <div className="text-xs font-medium text-white/65">Avatar Frame</div>
              <div className="grid grid-cols-2 gap-2.5">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    data-wardrobe-gender-btn={g}
                    onClick={() => {
                      soundEngine.playUiClick();
                      onChangeGender(g);
                    }}
                    className={`h-10 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      characterGender === g
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] text-white/85 border border-white/[0.12]'
                    }`}
                  >
                    {g === 'male' ? 'Male Character' : 'Female Character'}
                  </button>
                ))}
              </div>
            </section>

            {/* Sub-action row */}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleRemoveAll}
                className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Character</span>
              </button>
              <span className="text-[11px] text-white/50 tabular-nums">
                {savedPresets.length} saved · {visibleBuiltInPresets.length} curated
              </span>
            </div>

            {/* Saved Characters Grid */}
            <section className="space-y-2.5">
              <div className="text-[11px] font-semibold text-white/65 flex items-center gap-1.5">
                <span>Saved Characters</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{savedPresets.length}</span>
              </div>
              <div className={itemGridClass}>
                {/* White Circular Save Character Button */}
                <button
                  type="button"
                  data-wardrobe-save-preset-btn="true"
                  onClick={handleSavePreset}
                  className="group flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <div className={`${orbSizeClass} rounded-full bg-white hover:bg-slate-100 text-slate-950 flex flex-col items-center justify-center gap-1 shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-transform group-hover:scale-[1.04] group-active:scale-95`}>
                    <Download className="w-5 h-5 stroke-[2.2]" />
                    <span className="text-[11px] font-semibold">Save</span>
                  </div>
                  <span className="text-[11px] text-white/75">Save Character</span>
                </button>

                {savedPresets.map((preset) => (
                  <div key={preset.id} className="relative flex flex-col items-center gap-1.5 group">
                    <button
                      type="button"
                      data-wardrobe-saved-character-btn={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`relative ${orbSizeClass} rounded-full ring-1 ring-white/25 hover:ring-white flex flex-col items-center justify-center text-white transition-transform hover:scale-[1.04] cursor-pointer`}
                      style={{
                        background: `radial-gradient(circle at 30% 25%, ${preset.accentGradient[0]}, ${preset.accentGradient[1]})`,
                      }}
                    >
                      <Sparkles className="w-6 h-6 drop-shadow" />
                      {preset.gender && preset.gender !== 'unisex' && (
                        <span className="mt-1 px-1.5 py-0.5 rounded-full bg-black/40 text-[9px] font-semibold uppercase tracking-wide text-white/90">
                          {preset.gender === 'female' ? 'Female' : 'Male'}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedPreset(preset.id)}
                      className="absolute top-0 right-1 w-5 h-5 rounded-full bg-[#151115]/90 border border-white/25 text-white/75 hover:text-rose-300 flex items-center justify-center opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Delete Saved Character"
                      aria-label={`Delete ${preset.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] text-white/90 truncate max-w-[84px]">
                      {preset.name}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Curated Characters (Starter + Gender-Matched NPC Presets) */}
            <section className="space-y-2.5">
              <div className="text-[11px] font-semibold text-white/65 flex items-center gap-1.5">
                <span>Curated Characters</span>
                <span aria-hidden="true">·</span>
                <span>{characterGender === 'female' ? 'Female' : 'Male'}</span>
              </div>
              <div className={itemGridClass}>
                {visibleBuiltInPresets.map((preset) => {
                  const lockedCount = collectUnownedItemsInDraft(
                    preset.draft,
                    ownedApparelIds,
                    characterGender,
                  ).length;
                  const primaryId = preset.draft.setId ?? preset.draft.topId;
                  const thumbUrl = primaryId ? thumbMap[primaryId] : null;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-wardrobe-curated-character-btn={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className="group flex flex-col items-center gap-1.5 cursor-pointer"
                    >
                      <div
                        className={`relative ${orbSizeClass} rounded-full overflow-hidden ring-1 ring-white/22 group-hover:ring-white/60 flex items-center justify-center transition-transform group-hover:scale-[1.04]`}
                        style={{
                          background: `radial-gradient(circle at 32% 28%, ${preset.accentGradient[0]}, ${preset.accentGradient[1]})`,
                        }}
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={preset.name}
                            referrerPolicy="no-referrer"
                            className="w-[88%] h-[88%] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
                          />
                        ) : (
                          <Shirt className="w-7 h-7 text-white/90" />
                        )}
                        {lockedCount > 0 && (
                          <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-[#151115]/90 border border-white/25 flex items-center justify-center text-amber-300">
                            <Lock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-center">
                        <div className="text-[11px] font-medium text-white/90 truncate max-w-[84px]">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {lockedCount === 0 ? 'Owned' : `Try-On · ${lockedCount} shop`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : activeBottomTab === 'face' ? (
          <div className={railBodyWrapperClass}>
            {/* Face Feature Rail (Vertical on Desktop/Landscape, Horizontal Strip on Portrait) */}
            <nav
              aria-label="Face features"
              className={railNavClass}
            >
              {FACE_RAIL_ITEMS.filter((it) => !it.maleOnly || characterGender === 'male').map(({ id, label, Icon }) => {
                const isActive = activeFaceCategory === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-wardrobe-face-cat-btn={id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveFaceCategory(id);
                      if (id === 'face_head') {
                        setCameraFraming('upper');
                      } else {
                        setCameraFraming('face');
                      }
                    }}
                    className={railBtnClass}
                  >
                    <span
                      className={`${railIconBubbleClass} rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-[#8ad8ff] text-slate-950 shadow-[0_4px_14px_rgba(138,216,255,0.38)]'
                          : 'bg-white/[0.08] text-white/80 group-hover:bg-white/[0.16] group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span
                      className={`text-[10px] leading-tight text-center ${
                        isActive ? 'text-white font-semibold' : 'text-white/65'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Right Face Feature Content (Precision Tuning / Circular Items Grid) */}
            <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3.5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                {activeFaceCategory === 'face_tuning' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleResetFaceTuning}
                      className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Tuning</span>
                    </button>
                    <span className="text-[11px] text-white/50">Aesthetic Bounds</span>
                  </>
                ) : activeFaceCategory === 'face_head' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleResetHeadScale}
                      className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Head</span>
                    </button>
                    <span className="text-[11px] text-white/50">Proportion</span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleResetFace}
                      className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Face</span>
                    </button>
                    <span className="text-[11px] text-white/50 tabular-nums">
                      {partitionedFaceItems.owned.length} owned · {partitionedFaceItems.shop.length} shop
                    </span>
                  </>
                )}
              </div>

              {activeFaceCategory === 'face_tuning' ? (
                <div data-wardrobe-face-tuning="true" className="space-y-4 pb-4">
                  {/* Lips Group */}
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                      <div className="flex items-center gap-2">
                        <LipGlyphIcon className="w-4 h-4 text-[#8ad8ff]" />
                        <span className="text-xs font-semibold text-white/90">Lips</span>
                      </div>
                      <span className="text-[10px] text-white/50">Size & Height</span>
                    </div>

                    {/* Lip Scale */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Lip Size</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {(draft.lipScale ?? 1.0).toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">0.72x</span>
                        <input
                          type="range"
                          aria-label="Lip Size"
                          data-tuning-slider="lipScale"
                          min={0.72}
                          max={1.18}
                          step={0.01}
                          value={draft.lipScale ?? 1.0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('lipScale', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">1.18x</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('lipScale', 1.0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 1.00x"
                        >
                          1.0x
                        </button>
                      </div>
                    </div>

                    {/* Lip Offset Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Lip Vertical Position</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {((draft.lipOffsetY ?? 0) * 0.25) > 0
                            ? `+${((draft.lipOffsetY ?? 0) * 0.25).toFixed(2)}`
                            : ((draft.lipOffsetY ?? 0) * 0.25).toFixed(2)}{' '}
                          cm
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">Lower</span>
                        <input
                          type="range"
                          aria-label="Lip Vertical Position"
                          data-tuning-slider="lipOffsetY"
                          min={-6}
                          max={6}
                          step={0.5}
                          value={draft.lipOffsetY ?? 0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('lipOffsetY', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">Raise</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('lipOffsetY', 0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 0"
                        >
                          0
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Eyes Group */}
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-[#8ad8ff]" />
                        <span className="text-xs font-semibold text-white/90">Eyes</span>
                      </div>
                      <span className="text-[10px] text-white/50">Spacing, Tilt, Size</span>
                    </div>

                    {/* Eye Spacing */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Eye Spacing</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {(draft.eyeSpacing ?? 0) > 0
                            ? `+${(draft.eyeSpacing ?? 0).toFixed(1)}`
                            : (draft.eyeSpacing ?? 0).toFixed(1)}{' '}
                          px
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">Close</span>
                        <input
                          type="range"
                          aria-label="Eye Spacing"
                          data-tuning-slider="eyeSpacing"
                          min={-5}
                          max={10}
                          step={0.5}
                          value={draft.eyeSpacing ?? 0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('eyeSpacing', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">Wide</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('eyeSpacing', 0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 0"
                        >
                          0
                        </button>
                      </div>
                    </div>

                    {/* Eye Tilt */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Eye Tilt</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {(draft.eyeTiltDeg ?? 0) > 0
                            ? `+${(draft.eyeTiltDeg ?? 0).toFixed(1)}`
                            : (draft.eyeTiltDeg ?? 0).toFixed(1)}
                          °
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">Soft</span>
                        <input
                          type="range"
                          aria-label="Eye Tilt"
                          data-tuning-slider="eyeTiltDeg"
                          min={-8}
                          max={10}
                          step={0.5}
                          value={draft.eyeTiltDeg ?? 0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('eyeTiltDeg', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">Foxy</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('eyeTiltDeg', 0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 0°"
                        >
                          0°
                        </button>
                      </div>
                    </div>

                    {/* Eye Scale */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Eye Size</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {(draft.eyeScale ?? 1.0).toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">0.82x</span>
                        <input
                          type="range"
                          aria-label="Eye Size"
                          data-tuning-slider="eyeScale"
                          min={0.82}
                          max={1.22}
                          step={0.01}
                          value={draft.eyeScale ?? 1.0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('eyeScale', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">1.22x</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('eyeScale', 1.0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 1.00x"
                        >
                          1.0x
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Eyebrows Group */}
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                      <div className="flex items-center gap-2">
                        <BrowGlyphIcon className="w-4 h-4 text-[#8ad8ff]" />
                        <span className="text-xs font-semibold text-white/90">Eyebrows</span>
                      </div>
                      <span className="text-[10px] text-white/50">Height & Angle</span>
                    </div>

                    {/* Brow Offset Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Brow Height</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {(draft.browOffsetY ?? 0) > 0
                            ? `+${(draft.browOffsetY ?? 0).toFixed(1)}`
                            : (draft.browOffsetY ?? 0).toFixed(1)}{' '}
                          px
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">Lower</span>
                        <input
                          type="range"
                          aria-label="Brow Height"
                          data-tuning-slider="browOffsetY"
                          min={-7}
                          max={6}
                          step={0.5}
                          value={draft.browOffsetY ?? 0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('browOffsetY', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">Raise</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('browOffsetY', 0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 0"
                        >
                          0
                        </button>
                      </div>
                    </div>

                    {/* Brow Tilt */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Brow Tilt</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {(draft.browTiltDeg ?? 0) > 0
                            ? `+${(draft.browTiltDeg ?? 0).toFixed(1)}`
                            : (draft.browTiltDeg ?? 0).toFixed(1)}
                          °
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">Soft</span>
                        <input
                          type="range"
                          aria-label="Brow Tilt"
                          data-tuning-slider="browTiltDeg"
                          min={-10}
                          max={12}
                          step={0.5}
                          value={draft.browTiltDeg ?? 0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('browTiltDeg', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">Arch</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('browTiltDeg', 0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 0°"
                        >
                          0°
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeFaceCategory === 'face_head' ? (
                <div data-wardrobe-head-tuning="true" className="space-y-4 pb-4">
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
                      <div className="flex items-center gap-2">
                        <HeadScaleGlyphIcon className="w-4 h-4 text-[#8ad8ff]" />
                        <span className="text-xs font-semibold text-white/90">Head Size (Proportion)</span>
                      </div>
                      <span className="text-[10px] text-white/50">Body Proportion</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/75">Head Scale</span>
                        <span className="text-[#8ad8ff] font-mono tabular-nums font-semibold">
                          {(draft.headScale ?? 1.0).toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8">0.78x</span>
                        <input
                          type="range"
                          aria-label="Head Scale"
                          data-tuning-slider="headScale"
                          min={0.78}
                          max={1.06}
                          step={0.01}
                          value={draft.headScale ?? 1.0}
                          onPointerDown={beginSliderDrag}
                          onPointerUp={endSliderDrag}
                          onChange={(e) => updateDraftTuning('headScale', parseFloat(e.target.value), true)}
                          className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#8ad8ff]"
                        />
                        <span className="text-[10px] text-white/40 w-8 text-right">1.06x</span>
                        <button
                          type="button"
                          onClick={() => updateDraftTuning('headScale', 1.0)}
                          className="text-[10px] text-white/50 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] cursor-pointer"
                          title="Reset to 1.00x"
                        >
                          1.0x
                        </button>
                      </div>
                    </div>

                    <div
                      className={`grid gap-1.5 pt-1 ${
                        studioLayout.mode === 'phone_landscape_split' ? 'grid-cols-2' : 'grid-cols-4'
                      }`}
                    >
                      {[
                        { label: 'Model', sub: '0.84x', val: 0.84 },
                        { label: 'Anime', sub: '0.90x', val: 0.9 },
                        { label: 'Balanced', sub: '1.00x', val: 1.0 },
                        { label: 'Cute', sub: '1.05x', val: 1.05 },
                      ].map((preset) => {
                        const isSelected = Math.abs((draft.headScale ?? 1.0) - preset.val) < 0.005;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              updateDraftTuning('headScale', preset.val);
                            }}
                            className={`py-1.5 px-1 text-[10px] rounded-xl border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#8ad8ff]/20 border-[#8ad8ff] text-white font-semibold'
                                : 'bg-white/[0.05] border-white/10 text-white/75 hover:bg-white/[0.10]'
                            }`}
                          >
                            {preset.label}
                            <span className="block text-[9px] text-white/50 mt-0.5 tabular-nums">
                              {preset.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {partitionedFaceItems.owned.length > 0 && (
                    <section className="space-y-2.5">
                      <div className="text-[11px] font-semibold text-white/65 flex items-center gap-1.5">
                        <span>Owned</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{partitionedFaceItems.owned.length}</span>
                      </div>
                      <div className={itemGridClass}>
                        {partitionedFaceItems.owned.map((item) =>
                          renderCircularItemButton(item, true),
                        )}
                      </div>
                    </section>
                  )}

                  {partitionedFaceItems.shop.length > 0 && (
                    <section className="space-y-2.5">
                      <div className="text-[11px] font-semibold text-amber-200/85 flex items-center gap-1.5">
                        <ShoppingBag className="w-3 h-3" />
                        <span>Shop</span>
                        <span aria-hidden="true">·</span>
                        <span>Click to Try On</span>
                      </div>
                      <div className={itemGridClass}>
                        {partitionedFaceItems.shop.map((item) =>
                          renderCircularItemButton(item, isWardrobeItemOwned(item, ownedApparelIds)),
                        )}
                      </div>
                    </section>
                  )}

                  {partitionedFaceItems.allVisible.length === 0 && (
                    <div className="py-10 text-center text-xs text-white/55">
                      No face styles match this filter yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : activeBottomTab === 'body' ? (
          <div
            data-wardrobe-body-panel="true"
            className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 sm:py-4 space-y-5"
          >
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResetBody}
                className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Body</span>
              </button>
              <span className="text-[11px] text-white/50 tabular-nums">
                {partitionedBodyShapeItems.owned.length} owned · {partitionedBodyShapeItems.shop.length} shop
              </span>
            </div>

            {partitionedBodyShapeItems.owned.length > 0 && (
              <section className="space-y-2.5">
                <div className="text-[11px] font-semibold text-white/65 flex items-center gap-1.5">
                  <span>Owned</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{partitionedBodyShapeItems.owned.length}</span>
                </div>
                <div className={itemGridClass}>
                  {partitionedBodyShapeItems.owned.map((item) =>
                    renderCircularItemButton(item, true),
                  )}
                </div>
              </section>
            )}

            {partitionedBodyShapeItems.shop.length > 0 && (
              <section className="space-y-2.5">
                <div className="text-[11px] font-semibold text-amber-200/85 flex items-center gap-1.5">
                  <ShoppingBag className="w-3 h-3" />
                  <span>Shop</span>
                  <span aria-hidden="true">·</span>
                  <span>Click to Try On</span>
                </div>
                <div className={itemGridClass}>
                  {partitionedBodyShapeItems.shop.map((item) =>
                    renderCircularItemButton(item, isWardrobeItemOwned(item, ownedApparelIds)),
                  )}
                </div>
              </section>
            )}

            {partitionedBodyShapeItems.allVisible.length === 0 && (
              <div className="py-10 text-center text-xs text-white/55">
                No body shapes match this filter yet.
              </div>
            )}
          </div>
        ) : activeBottomTab === 'style' ? (
          <div data-wardrobe-style-panel="true" className={railBodyWrapperClass}>
            {/* Style Rail (Vertical on Desktop/Landscape, Horizontal Strip on Portrait) */}
            <nav
              aria-label="Style categories"
              className={railNavClass}
            >
              {STYLE_RAIL_ITEMS.map(({ id, label, Icon }) => {
                const isActive = activeStyleCategory === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-wardrobe-style-cat-btn={id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveStyleCategory(id);
                      setCameraFraming('full');
                    }}
                    className={railBtnClass}
                  >
                    <span
                      className={`${railIconBubbleClass} rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-[#8ad8ff] text-slate-950 shadow-[0_4px_14px_rgba(138,216,255,0.38)]'
                          : 'bg-white/[0.08] text-white/80 group-hover:bg-white/[0.16] group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span
                      className={`text-[10px] leading-tight text-center ${
                        isActive ? 'text-white font-semibold' : 'text-white/65'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Right Pane: Animation Sets / Dance & Emotes / Garment Dye */}
            <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3.5 space-y-4">
              {activeStyleCategory === 'style_tint' ? (
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/65">Garment Dye Tint</span>
                    <span className="text-[11px] text-white/50">
                      {WARDROBE_CLOTHING_TINT_SWATCHES.find((s) => s.hex === draft.clothingTintHex)
                        ?.label ?? 'Original'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {WARDROBE_CLOTHING_TINT_SWATCHES.map((swatch) => {
                      const isSelected = draft.clothingTintHex === swatch.hex;
                      return (
                        <button
                          key={swatch.id}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setHistory((prev) =>
                              pushWardrobeDraft(prev, {
                                ...prev.present,
                                clothingTintHex: swatch.hex,
                              }),
                            );
                          }}
                          className="flex flex-col items-center gap-1.5 cursor-pointer group"
                          title={swatch.label}
                        >
                          <span
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${
                              isSelected
                                ? 'ring-2 ring-white shadow-[0_0_0_3px_rgba(138,216,255,0.4)]'
                                : 'ring-1 ring-white/25'
                            }`}
                            style={{ backgroundColor: swatch.previewHex }}
                          >
                            {isSelected && <Check className="w-4 h-4 text-slate-950 stroke-[3]" />}
                          </span>
                          <span className="text-[10px] text-white/75 truncate max-w-full">
                            {swatch.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={handleResetStyle}
                        className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Style</span>
                      </button>
                      <span className="text-[11px] text-white/50 tabular-nums">
                        {partitionedStyleItems.owned.length} owned · {partitionedStyleItems.shop.length} shop
                      </span>
                    </div>
                    {activeStyleCategory === 'style_anim' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['idle', 'walk', 'run', 'sit'] as const).map((st) => {
                          const active = animSetPreviewState === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                soundEngine.playUiClick();
                                setAnimSetPreviewState(st);
                              }}
                              className={`h-7 rounded-full text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                                active
                                  ? 'bg-[#8ad8ff] text-slate-950 shadow'
                                  : 'bg-white/[0.08] text-white/75 hover:bg-white/[0.15] hover:text-white'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {activeStyleCategory === 'style_paired' && (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: 'initiate', label: 'Preview: Initiator' },
                              { id: 'receive', label: 'Preview: Receiver' },
                            ] as const
                          ).map((role) => {
                            const active = pairedPreviewRole === role.id;
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  setPairedPreviewRole(role.id);
                                }}
                                className={`h-7 rounded-full text-[10.5px] font-semibold transition-all cursor-pointer ${
                                  active
                                    ? 'bg-[#fb7185] text-slate-950 shadow'
                                    : 'bg-white/[0.08] text-white/75 hover:bg-white/[0.15] hover:text-white'
                                }`}
                              >
                                {role.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-white/55 leading-snug">
                          Approach a player or NPC in the city and select <span className="text-white/85 font-semibold">Interact</span> for paired poses.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-5">
                    {partitionedStyleItems.owned.length > 0 && (
                      <section className="space-y-2.5">
                        <div className="text-[11px] font-semibold text-white/65 flex items-center gap-1.5">
                          <span>Owned</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{partitionedStyleItems.owned.length}</span>
                        </div>
                        <div className={itemGridClass}>
                          {partitionedStyleItems.owned.map((item) =>
                            renderCircularItemButton(item, true),
                          )}
                        </div>
                      </section>
                    )}

                    {partitionedStyleItems.shop.length > 0 && (
                      <section className="space-y-2.5">
                        <div className="text-[11px] font-semibold text-amber-200/85 flex items-center gap-1.5">
                          <ShoppingBag className="w-3 h-3" />
                          <span>Shop</span>
                          <span aria-hidden="true">·</span>
                          <span>Click to Try On</span>
                        </div>
                        <div className={itemGridClass}>
                          {partitionedStyleItems.shop.map((item) =>
                            renderCircularItemButton(
                              item,
                              isWardrobeItemOwned(item, ownedApparelIds),
                            ),
                          )}
                        </div>
                      </section>
                    )}

                    {partitionedStyleItems.allVisible.length === 0 && (
                      <div className="py-10 text-center text-xs text-white/55">
                        No animations or dances match this filter yet.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className={railBodyWrapperClass}>
            {/* Garment Rail (Vertical on Desktop/Landscape, Horizontal Strip on Portrait) */}
            <nav
              aria-label="Wardrobe categories"
              className={railNavClass}
            >
              {CATEGORY_RAIL_ITEMS.map(({ id, label, Icon }) => {
                const isActive = activeCategory === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-wardrobe-cat-btn={id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveCategory(id);
                      if (id === 'underwear') {
                        setCameraFraming('full');
                      }
                    }}
                    className={railBtnClass}
                  >
                    <span
                      className={`${railIconBubbleClass} rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-[#8ad8ff] text-slate-950 shadow-[0_4px_14px_rgba(138,216,255,0.38)]'
                          : 'bg-white/[0.08] text-white/80 group-hover:bg-white/[0.16] group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span
                      className={`text-[10px] leading-tight text-center ${
                        isActive ? 'text-white font-semibold' : 'text-white/65'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Right 3-Column Circular Grid */}
            <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3.5 space-y-4">
              {/* Top sub-action bar: Search + Remove All + Underwear controls */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={outfitSearchQuery}
                  onChange={(e) => setOutfitSearchQuery(e.target.value)}
                  placeholder={`Search ${panelHeaderTitle.toLowerCase()}...`}
                  className="w-full h-8 px-3 rounded-full bg-white/[0.08] border border-white/[0.14] text-xs text-white placeholder:text-white/45 focus:outline-none focus:border-[#8ad8ff]/70"
                />
                {activeCategory === 'underwear' && (
                  <div className="space-y-2 pt-0.5">
                    <div
                      data-wardrobe-underwear-subfilter="true"
                      className="grid grid-cols-3 gap-1.5"
                    >
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'underwear', label: 'Underwear' },
                          {
                            id: 'corewear',
                            label: characterGender === 'female' ? 'Bustier' : 'Singlet',
                          },
                        ] as const
                      ).map((pill) => {
                        const active = underwearSubFilter === pill.id;
                        return (
                          <button
                            key={pill.id}
                            type="button"
                            onClick={() => {
                              soundEngine.playUiClick();
                              setUnderwearSubFilter(pill.id);
                            }}
                            className={`h-7 rounded-full text-[10px] font-semibold transition-colors cursor-pointer px-2 truncate ${
                              active
                                ? 'bg-[#8ad8ff] text-slate-950 shadow-sm'
                                : 'bg-white/[0.08] text-white/75 hover:bg-white/[0.15] hover:text-white'
                            }`}
                          >
                            {pill.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        data-wardrobe-underwear-preview-toggle="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setUnderwearPreviewBare((prev) => !prev);
                        }}
                        className={`h-7 rounded-full text-[10px] font-medium transition-colors cursor-pointer px-2.5 truncate ${
                          underwearPreviewBare
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-white/[0.06] text-white/65 border border-white/10 hover:bg-white/[0.12]'
                        }`}
                        title="Temporarily hide outer clothing to preview underwear"
                      >
                        {underwearPreviewBare ? 'Preview: Outer Off' : 'Preview: Outer On'}
                      </button>
                      <button
                        type="button"
                        data-wardrobe-underwear-save-bare-toggle="true"
                        onClick={() => {
                          soundEngine.playUiClick();
                          const nextBare = !Boolean(draft.hideOuterForUnderwear);
                          setHistory((prev) =>
                            pushWardrobeDraft(prev, {
                              ...prev.present,
                              hideOuterForUnderwear: nextBare,
                            }),
                          );
                          showNotice(
                            nextBare
                              ? 'Outerwear-off mode active (bikini/swimsuit/underwear visible in the city)'
                              : 'Outerwear is visible in the city again',
                          );
                        }}
                        className={`h-7 rounded-full text-[10px] font-medium transition-colors cursor-pointer px-2.5 truncate ${
                          draft.hideOuterForUnderwear
                            ? 'bg-[#8ad8ff] text-slate-950 font-semibold'
                            : 'bg-white/[0.06] text-white/70 border border-white/10 hover:bg-white/[0.12]'
                        }`}
                        title="Save without outer top/bottom so bikini, swimsuit, or underwear stays visible in the city"
                      >
                        {draft.hideOuterForUnderwear ? 'In City: Outer Off' : 'In City: Outer On'}
                      </button>
                    </div>
                    <button
                      type="button"
                      data-wardrobe-base-underwear-toggle="true"
                      onClick={() => {
                        soundEngine.playUiClick();
                        const nextRemove = !Boolean(draft.hideBaseUnderwear);
                        setHistory((prev) =>
                          pushWardrobeDraft(prev, {
                            ...prev.present,
                            underwearId: nextRemove ? null : prev.present.underwearId,
                            corewearId: nextRemove ? null : prev.present.corewearId,
                            hideBaseUnderwear: nextRemove,
                            hideBaseBra: nextRemove,
                          }),
                        );
                        showNotice(
                          nextRemove
                            ? 'Underwear removed (clean base skin)'
                            : 'Default base underwear restored',
                        );
                      }}
                      className={`w-full h-7 rounded-full text-[10px] font-medium transition-colors cursor-pointer px-2.5 truncate ${
                        draft.hideBaseUnderwear && !draft.underwearId && !draft.corewearId
                          ? 'bg-[#8ad8ff] text-slate-950 font-semibold'
                          : 'bg-white/[0.06] text-white/75 border border-white/10 hover:bg-white/[0.12]'
                      }`}
                      title="Remove or restore the default white underwear painted on the base avatar"
                    >
                      {draft.hideBaseUnderwear && !draft.underwearId && !draft.corewearId
                        ? 'Underwear: Removed (Click to Restore)'
                        : 'Remove Default Underwear'}
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleRemoveAll}
                    className="inline-flex items-center gap-1.5 text-white/75 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Remove All</span>
                  </button>
                  <span className="text-[11px] text-white/50 tabular-nums">
                    {partitionedSlotItems.owned.length} owned · {partitionedSlotItems.shop.length} shop
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                {/* OWNED SECTION */}
                {partitionedSlotItems.owned.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="text-[11px] font-semibold text-white/65 flex items-center gap-1.5">
                      <span>Owned</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{partitionedSlotItems.owned.length}</span>
                    </div>
                    <div className={itemGridClass}>
                      {partitionedSlotItems.owned
                        .slice(0, outfitVisibleLimit)
                        .map((item) => renderCircularItemButton(item, true))}
                    </div>
                    {partitionedSlotItems.owned.length > outfitVisibleLimit && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setOutfitVisibleLimit((prev) => prev + 36);
                        }}
                        className="w-full h-9 rounded-full bg-white/[0.10] hover:bg-white/[0.18] border border-white/[0.16] text-xs font-medium text-white/90 transition-colors cursor-pointer"
                      >
                        Load More (+36) · {partitionedSlotItems.owned.length - outfitVisibleLimit} more
                      </button>
                    )}
                  </section>
                )}

                {/* SHOP / LOCKED SECTION */}
                {partitionedSlotItems.shop.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="text-[11px] font-semibold text-amber-200/85 flex items-center gap-1.5">
                      <ShoppingBag className="w-3 h-3" />
                      <span>Shop</span>
                      <span aria-hidden="true">·</span>
                      <span>Click to Try On</span>
                    </div>
                    <div className={itemGridClass}>
                      {partitionedSlotItems.shop.map((item) =>
                        renderCircularItemButton(item, isWardrobeItemOwned(item, ownedApparelIds)),
                      )}
                    </div>
                  </section>
                )}

                {partitionedSlotItems.allVisible.length === 0 && (
                  <div className="py-10 text-center text-xs text-white/55">
                    No items match this filter yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inline Boutique Unlock Bar when previewing locked Shop items */}
        {!isPortraitSheetCollapsed && unownedPreviewItems.length > 0 && (
          <div className="px-4 py-2.5 sm:py-3 border-t border-white/[0.14] bg-[#120d11]/85 flex items-center justify-between gap-2.5 shrink-0">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-amber-200 truncate">
                Try-On Preview · {unownedPreviewItems[0].name}
                {unownedPreviewItems.length > 1 ? ` +${unownedPreviewItems.length - 1}` : ''}
              </div>
              <div className="text-[10px] text-white/60 tabular-nums">
                Unlock to wear in city · {getWardrobeCatalogItemPriceCyon(unownedPreviewItems[0])} CerCoins
              </div>
            </div>
            <button
              type="button"
              data-wardrobe-buy-btn={unownedPreviewItems[0].id}
              onClick={() => handleBuyPreviewItem(unownedPreviewItems[0])}
              className="px-3.5 py-1.5 rounded-full bg-amber-300 hover:bg-amber-200 text-slate-950 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Buy · {getWardrobeCatalogItemPriceCyon(unownedPreviewItems[0])} CerCoins
            </button>
          </div>
        )}
      </aside>

      {/* 6. Adaptive Bottom Floating Navigation Bar + Complete CTA */}
      <div
        className="absolute left-2.5 right-2.5 sm:left-6 sm:right-5 z-20 flex items-center justify-between gap-2 sm:gap-4"
        style={{ bottom: 'max(0.5rem, var(--safe-bottom))' }}
      >
        <div
          className={`flex items-center gap-0.5 p-1 rounded-full overflow-x-auto no-scrollbar min-w-0 max-w-full ${glassPillClass}`}
        >
          {(
            [
              { id: 'character', label: 'Character' },
              { id: 'face', label: 'Face' },
              { id: 'body', label: 'Body' },
              { id: 'style', label: 'Style' },
              { id: 'outfit', label: 'Outfit' },
              { id: 'shop', label: 'Shop' },
            ] as const
          ).map((tab) => {
            const active = activeBottomTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-wardrobe-bottom-tab={tab.id}
                onClick={() => {
                  if (isPortraitSheetCollapsed) setIsPortraitSheetCollapsed(false);
                  handleBottomTabClick(tab.id);
                }}
                className={`h-8 px-2.5 sm:px-3.5 rounded-full text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 font-semibold shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          data-wardrobe-complete-btn="true"
          onClick={handleCommitComplete}
          className="h-9 sm:h-10 px-4 sm:px-8 rounded-full bg-[#9ad8ff] hover:bg-[#bae6fd] text-slate-950 text-xs font-semibold shadow-[0_10px_28px_rgba(138,216,255,0.28)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Complete
        </button>
      </div>
    </div>
  );
};
