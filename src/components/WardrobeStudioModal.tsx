import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowUpDown,
  Camera,
  Check,
  Crown,
  Download,
  Eye,
  Flame,
  Footprints,
  Hand,
  Layers,
  Lock,
  Maximize2,
  Music,
  Palette,
  PersonStanding,
  Play,
  Redo2,
  RotateCcw,
  ScanFace,
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
} from '../game/buddiesFaceCompositor';
import {
  EMPTY_WARDROBE_DRAFT,
  WARDROBE_CLOTHING_TINT_SWATCHES,
  WARDROBE_STUDIO_ITEMS,
  WARDROBE_STUDIO_POSES,
  applyItemSelectionToDraft,
  collectUnownedItemsInDraft,
  createSavedPresetFromDraft,
  createWardrobeHistory,
  getExternalWardrobeCatalogCount,
  getVisibleBuiltInWardrobePresets,
  getWardrobeCatalogItemById,
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
  type WardrobePoseId,
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

const AVATAR_PHOTO_STORAGE_KEY = 'bb_player_avatar_photo_v1';

export interface WardrobeStudioModalProps {
  isOpen: boolean;
  accountKey: string;
  characterGender: 'male' | 'female';
  lulBalance: number;
  ownedApparelIds: string[];
  initialDraft: WardrobeOutfitDraft;
  onChangeGender: (gender: 'male' | 'female') => void;
  onPurchaseItem: (item: WardrobeCatalogItem) => { ok: boolean; errorMessage?: string };
  onComplete: (committedOwnedDraft: WardrobeOutfitDraft) => void;
  onClose: () => void;
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

const FACE_RAIL_ITEMS: ReadonlyArray<{
  id: WardrobeFaceCategoryId;
  label: string;
  Icon: React.FC<{ className?: string }>;
  maleOnly?: boolean;
}> = [
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
    }
    ctx.restore();
  }, [item]);

  if (item.thumbUrl) {
    return (
      <div
        className="w-full h-full flex items-center justify-center p-1.5"
        style={{
          background: 'radial-gradient(circle at 45% 35%, #f3d4be, #d9b196)',
        }}
      >
        <img
          src={item.thumbUrl}
          alt={item.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]"
        />
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
  lulBalance,
  ownedApparelIds,
  initialDraft,
  onChangeGender,
  onPurchaseItem,
  onComplete,
  onClose,
}) => {
  const [history, setHistory] = useState<WardrobeHistoryState>(() =>
    createWardrobeHistory(initialDraft),
  );
  const [activeBottomTab, setActiveBottomTab] = useState<WardrobeBottomTabId>('outfit');
  const [activeCategory, setActiveCategory] = useState<WardrobeStudioCategoryId>('top');
  const [activeFaceCategory, setActiveFaceCategory] = useState<WardrobeFaceCategoryId>('face_eyes');
  const [activeStyleCategory, setActiveStyleCategory] = useState<WardrobeStyleCategoryId>('style_anim');
  const [filterMode, setFilterMode] = useState<WardrobeFilterMode>('all');
  const [sortMode, setSortMode] = useState<WardrobeSortMode>('featured');
  const [cameraFraming, setCameraFraming] = useState<WardrobeCameraFraming>('upper');
  const [activePoseId, setActivePoseId] = useState<WardrobePoseId>('runway');
  const [glassPreference, setGlassPreference] = useState<WardrobeGlassPreference>('auto');
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

  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Smoked Pseudo-Glass (0% FPS overhead) vs lightweight Frosted Blur on fast hardware GPUs
  const glassSurfaceClass =
    resolvedGlassMode === 'frosted_blur'
      ? 'bg-[#1a1418]/66 backdrop-blur-md border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_20px_48px_rgba(0,0,0,0.42)]'
      : 'bg-gradient-to-b from-[#211a1e]/86 via-[#171216]/82 to-[#120e12]/88 border border-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_20px_48px_rgba(0,0,0,0.48)]';

  const glassPillClass =
    resolvedGlassMode === 'frosted_blur'
      ? 'bg-[#1a1418]/64 backdrop-blur-md border border-white/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_28px_rgba(0,0,0,0.36)]'
      : 'bg-gradient-to-b from-[#231c20]/88 to-[#161115]/88 border border-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_28px_rgba(0,0,0,0.40)]';

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
  }, []);

  useEffect(() => {
    if (!statusNotice) return;
    const t = window.setTimeout(() => setStatusNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [statusNotice]);

  // Sync framing ref for smooth animation loop interpolation
  useEffect(() => {
    framingRef.current = cameraFraming;
    dragStateRef.current.zoomDelta = 0;
  }, [cameraFraming]);

  // Reset history & load user presets whenever Wardrobe Studio opens
  useEffect(() => {
    if (!isOpen) return;
    setHistory(createWardrobeHistory(initialDraft));
    setSavedPresets(loadSavedWardrobePresets(accountKey));
    setStatusNotice(null);
  }, [isOpen, initialDraft, accountKey]);

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

  const applyStudioPoseClip = useCallback(
    (poseId: WardrobePoseId) => {
      const candidateClipNames: Record<WardrobePoseId, string[]> = {
        runway: ['nadia_idle.001', 'hana_idle.001', 'mira_idle.001', 'idle.001'],
        relaxed: ['hana_idle.001', 'mira_idle.001', 'kai_idle.001', 'idle.001'],
        casual: ['idle.001', 'bima_idle.001', 'kai_idle.001'],
      };
      applyStudioClipCandidates(candidateClipNames[poseId]);
    },
    [applyStudioClipCandidates],
  );

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
    canvasRef.current = canvas;
    host.innerHTML = '';
    host.appendChild(canvas);

    setBlitzStylizedCharViewportSize(width, height);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40);

    // Offset optical center left so avatar frames naturally in the open window space beside the right glass panel
    const applyCameraViewOffset = (w: number, h: number) => {
      const shiftRightPx = w >= 960 ? Math.round(w * 0.145) : 0;
      camera.aspect = w / h;
      camera.setViewOffset(w, h, shiftRightPx, 0, w, h);
      camera.updateProjectionMatrix();
    };
    applyCameraViewOffset(width, height);

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
          ? '/assets/avatars/new-female-player.glb'
          : '/assets/avatars/new-male-player.glb';
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
          applyStudioPoseClip(activePoseId);
        }
      } else if (currentDraft.animSetId) {
        applyStudioClipCandidates(animStyle.clipCandidates);
      } else {
        applyStudioPoseClip(activePoseId);
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

    const onPointerDown = (e: PointerEvent) => {
      dragStateRef.current.dragging = true;
      dragStateRef.current.lastX = e.clientX;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.lastX;
      dragStateRef.current.lastX = e.clientX;
      dragStateRef.current.targetYaw += dx * 0.011;
    };
    const onPointerUp = (e: PointerEvent) => {
      dragStateRef.current.dragging = false;
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
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!stageHostRef.current || disposed) return;
      const rw = Math.max(320, stageHostRef.current.clientWidth || window.innerWidth);
      const rh = Math.max(240, stageHostRef.current.clientHeight || window.innerHeight);
      renderer.setSize(rw, rh, false);
      applyCameraViewOffset(rw, rh);
      setBlitzStylizedCharViewportSize(rw, rh);
    };
    window.addEventListener('resize', onResize);

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
        if (frameCounter % 45 === 0) {
          setStudioFrameMs(localSmoothedMs);
        }
      }

      const st = dragStateRef.current;
      st.currentYaw = THREE.MathUtils.damp(st.currentYaw, st.targetYaw, 9.0, dt);
      st.currentZoomDelta = THREE.MathUtils.damp(st.currentZoomDelta, st.zoomDelta, 7.5, dt);
      turntable.rotation.y = st.currentYaw;

      const targetSpec = CAMERA_FRAMING_SPECS[framingRef.current];
      const desiredDist = THREE.MathUtils.clamp(targetSpec.dist + st.currentZoomDelta, 1.45, 7.2);
      smoothDist = THREE.MathUtils.damp(smoothDist, desiredDist, 6.8, dt);
      smoothCamY = THREE.MathUtils.damp(smoothCamY, targetSpec.camY, 6.8, dt);
      smoothTargetY = THREE.MathUtils.damp(smoothTargetY, targetSpec.targetY, 6.8, dt);
      smoothFov = THREE.MathUtils.damp(smoothFov, targetSpec.fov, 6.8, dt);

      if (Math.abs(camera.fov - smoothFov) > 0.05) {
        camera.fov = smoothFov;
        camera.updateProjectionMatrix();
      }
      camera.position.set(0, smoothCamY, smoothDist);
      camera.lookAt(0, smoothTargetY, 0);

      const ctrl = studioRig.customGlbController;
      if (ctrl) {
        ctrl.mixer.update(dt);

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
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      studioRig.customGlbController?.secondaryPhysics?.dispose();
      studioRig.customGlbController?.mixer.stopAllAction();
      rigRef.current = null;
      activePoseActionRef.current = null;
      canvasRef.current = null;

      floorShadowGeo.dispose();
      floorShadowMat.dispose();
      floorShadowTex.dispose();
      renderer.dispose();
    };
    // Rebuild studio stage cleanly when opened or gender changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, characterGender]);

  // Live multi-slot modular outfit, body shape morphs & clothing dye sync whenever draft updates
  useEffect(() => {
    if (!isOpen) return;
    const rig = rigRef.current;
    if (!rig || !rig.customGlbController) return;
    let cancelled = false;
    (async () => {
      const baseUrls = resolveWardrobeDraftToModularOutfitUrls(draft, characterGender);
      const previewBare =
        activeBottomTab === 'outfit' && activeCategory === 'underwear' && underwearPreviewBare;
      const urls = {
        ...baseUrls,
        hideOuterClothes: Boolean(baseUrls.hideOuterClothes) || previewBare,
      };
      await setBuddyRigModularOutfitUrls(rig, urls);
      if (cancelled) return;
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
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    draft,
    characterGender,
    externalCatalogRevision,
    activeBottomTab,
    activeCategory,
    underwearPreviewBare,
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
    } else if (draft.animSetId || (isPreviewingAnimSetState && animSetPreviewState !== 'idle')) {
      applyStudioClipCandidates(targetCandidates);
    } else {
      applyStudioPoseClip(activePoseId);
    }
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeBottomTab,
    activeStyleCategory,
    animSetPreviewState,
    pairedPreviewRole,
    draft.animSetId,
    draft.dancePoseId,
    draft.stylePoseId,
    draft.styleActionId,
    draft.stylePairedId,
    activePoseId,
    applyStudioClipCandidates,
    applyStudioPoseClip,
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
      item.slot === 'face_beard'
    ) {
      setCameraFraming('face');
    }
    setHistory((prev) => pushWardrobeDraft(prev, applyItemSelectionToDraft(prev.present, item)));
  }, []);

  const handleSelectPreset = useCallback(
    (preset: WardrobeSavedPreset) => {
      soundEngine.playUiConfirm();
      if (
        (preset.gender === 'male' || preset.gender === 'female') &&
        preset.gender !== characterGender
      ) {
        onChangeGender(preset.gender);
      }
      setHistory((prev) => pushWardrobeDraft(prev, { ...EMPTY_WARDROBE_DRAFT, ...preset.draft }));
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
  }, [showNotice]);

  const handleCyclePose = useCallback(() => {
    soundEngine.playUiClick();
    const idx = WARDROBE_STUDIO_POSES.findIndex((p) => p.id === activePoseId);
    const nextPose = WARDROBE_STUDIO_POSES[(idx + 1) % WARDROBE_STUDIO_POSES.length];
    setActivePoseId(nextPose.id);
    showNotice(`Pose: ${nextPose.label}`);
  }, [activePoseId, showNotice]);

  const handleCaptureProfileSnapshot = useCallback(() => {
    const glCanvas = canvasRef.current;
    if (!glCanvas) return;
    soundEngine.playUiConfirm();
    try {
      const out = document.createElement('canvas');
      out.width = 256;
      out.height = 256;
      const ctx = out.getContext('2d');
      if (!ctx) return;

      // Warm studio gradient backing behind transparent avatar capture
      const bg = ctx.createLinearGradient(0, 0, 256, 256);
      bg.addColorStop(0, '#3e2d34');
      bg.addColorStop(1, '#1d1519');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 256, 256);

      const srcW = glCanvas.width;
      const srcH = glCanvas.height;
      const cropSize = Math.min(srcW, srcH) * 0.72;
      const sx = Math.max(0, srcW * 0.37 - cropSize * 0.5);
      const sy = Math.max(0, srcH * 0.14);
      ctx.drawImage(glCanvas, sx, sy, cropSize, cropSize, 0, 0, 256, 256);

      const dataUrl = out.toDataURL('image/jpeg', 0.88);
      window.localStorage.setItem(AVATAR_PHOTO_STORAGE_KEY, dataUrl);
      showNotice('Studio snapshot saved to your Profile Avatar');
    } catch {
      showNotice('Could not save snapshot on this browser');
    }
  }, [showNotice]);

  const handleBuyPreviewItem = useCallback(
    (item: WardrobeCatalogItem) => {
      const res = onPurchaseItem(item);
      if (res.ok) {
        soundEngine.playUiConfirm();
        showNotice(`Unlocked "${item.name}" and added to Owned Wardrobe`);
      } else {
        soundEngine.playUiClick();
        showNotice(res.errorMessage || 'Not enough $LUL');
      }
    },
    [onPurchaseItem, showNotice],
  );

  const handleCommitComplete = useCallback(() => {
    soundEngine.playUiConfirm();
    const ownedOnly = sanitizeDraftToOwnedOnly(draft, ownedApparelIds, characterGender);
    onComplete(ownedOnly);
  }, [draft, ownedApparelIds, characterGender, onComplete]);

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

  const handleCycleGlass = useCallback(() => {
    soundEngine.playUiClick();
    setGlassPreference((prev) => {
      const next: WardrobeGlassPreference =
        prev === 'auto' ? 'smoked_pseudo' : prev === 'smoked_pseudo' ? 'frosted_blur' : 'auto';
      showNotice(
        next === 'smoked_pseudo'
          ? 'Smoked Glass (0% FPS overhead)'
          : next === 'frosted_blur'
            ? 'Frosted Glass Blur'
            : 'Glass: Auto',
      );
      return next;
    });
  }, [showNotice]);

  const handleResetFace = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        eyeStyleId: null,
        browStyleId: null,
        lipStyleId: null,
      }),
    );
    showNotice('Reset face to Natural Starter');
  }, [showNotice]);

  const handleResetBody = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        bodyShapeId: null,
      }),
    );
    showNotice('Reset body shape to Balanced Studio');
  }, [showNotice]);

  const handleResetStyle = useCallback(() => {
    soundEngine.playUiClick();
    setHistory((prev) =>
      pushWardrobeDraft(prev, {
        ...prev.present,
        animSetId: null,
        dancePoseId: null,
        clothingTintHex: null,
      }),
    );
    showNotice('Reset animation, dance & dye to Starter');
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
          return (draft.underwearId ?? null) === null && (draft.corewearId ?? null) === null;
        }
        return item.underwearSubSlot === 'corewear'
          ? draft.corewearId === item.id
          : draft.underwearId === item.id;
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
      if (item.slot === 'style_anim') {
        return item.isStarterDefault ? draft.animSetId === null : draft.animSetId === item.id;
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
    [draft],
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
        ? activeFaceCategory === 'face_eyes'
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
                      ? 'Style · Berpasangan (Duo)'
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
      item.slot === 'face_beard';
    const isStyleDanceOrPose =
      item.slot === 'style_dance' || item.slot === 'style_pose' || item.slot === 'style_action';
    return (
      <button
        key={item.id}
        type="button"
        data-wardrobe-item-btn={item.id}
        onClick={() => handleSelectItem(item)}
        className="group flex flex-col items-center gap-1.5 text-center cursor-pointer focus-visible:outline-none"
        title={`${item.name} · ${owned ? 'Owned' : `${item.priceLul} $LUL`}`}
      >
        <div
          className={`relative w-[82px] h-[82px] rounded-full overflow-hidden flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.04] group-active:scale-95 ${
            selected
              ? 'ring-2 ring-white shadow-[0_0_0_4px_rgba(138,216,255,0.35)]'
              : 'ring-1 ring-white/20 group-hover:ring-white/45'
          }`}
          style={{
            background: `radial-gradient(circle at 32% 28%, ${item.swatchGradient[0]}, ${item.swatchGradient[1]})`,
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
                <span className="text-[9px] font-semibold tracking-wide uppercase">Polos</span>
              </div>
            )
          ) : item.slot === 'style_paired' ? (
            <div className="flex flex-col items-center justify-center gap-1 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
              <Users className="w-6 h-6 stroke-[2]" />
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/90">
                {item.pairedAnim?.vibeTag ?? 'Duo'}
              </span>
            </div>
          ) : item.slot === 'style_anim' ? (
            <div className="flex flex-col items-center justify-center gap-1 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
              <Play className="w-6 h-6 fill-white/90 stroke-[1.75]" />
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/90">
                {item.animSet?.vibeTag ?? 'Anim'}
              </span>
            </div>
          ) : isStyleDanceOrPose ? (
            <div className="flex flex-col items-center justify-center gap-1 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
              {item.slot === 'style_action' ||
              item.dancePose?.danceKind === 'wave' ||
              item.dancePose?.danceKind === 'salute' ? (
                <Hand className="w-6 h-6 stroke-[2]" />
              ) : item.dancePose?.danceKind === 'cheer' || item.dancePose?.danceKind === 'hiphop' ? (
                <Flame className="w-6 h-6 stroke-[2]" />
              ) : item.slot === 'style_pose' ||
                (item.dancePose?.danceKind === 'none' && !item.dancePose?.animGlbUrl) ? (
                <PersonStanding className="w-6 h-6 stroke-[2]" />
              ) : (
                <Music className="w-6 h-6 stroke-[2]" />
              )}
              <span className="text-[9px] font-semibold tracking-wide uppercase text-white/90">
                {item.dancePose?.vibeTag ?? 'Motion'}
              </span>
            </div>
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
              : `${item.priceLul} $LUL`}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div
      data-wardrobe-studio-modal="true"
      className="fixed inset-0 z-[95] overflow-hidden select-none text-white"
      style={{ fontFamily: '"Plus Jakarta Sans", "Outfit", system-ui, sans-serif' }}
    >
      {/* 1. Dedicated Cozy Warm Dressing Room Studio Backdrop */}
      <div className="absolute inset-0 bg-[#1a1316]">
        <img
          src={studioBackdropUrl}
          alt="Dressing Room Studio"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center scale-[1.03] brightness-[0.94] contrast-[1.03]"
        />
        {/* Subtle studio cinematic vignette & right-side reading scrim */}
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
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 md:right-[430px] z-[8] flex items-center justify-center">
          <div className={`px-4 py-2 rounded-full text-xs font-medium text-white/90 ${glassPillClass}`}>
            {webglLost ? 'Studio 3D preview paused — WebGL context unavailable' : 'Preparing studio avatar…'}
          </div>
        </div>
      )}

      {/* 3. Top-Center Floating Studio Toolbar (matching reference) */}
      <div className="absolute top-4 left-1/2 md:left-[35%] -translate-x-1/2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-full">
        <div className={`flex items-center gap-0.5 px-2 py-1 rounded-full ${glassPillClass}`}>
          <button
            type="button"
            onClick={handleCyclePose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
            title={`Switch Pose (${WARDROBE_STUDIO_POSES.find((p) => p.id === activePoseId)?.label})`}
            aria-label="Switch Studio Pose"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCaptureProfileSnapshot}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
            title="Capture Snapshot to Profile Avatar"
            aria-label="Capture Studio Snapshot"
          >
            <Camera className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-white/15 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setCameraFraming('face');
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              cameraFraming === 'face'
                ? 'bg-white text-slate-950'
                : 'text-white/85 hover:text-white hover:bg-white/12'
            }`}
            title="Face Close-Up"
            aria-label="Face Close-Up"
          >
            <ScanFace className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setCameraFraming('upper');
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              cameraFraming === 'upper'
                ? 'bg-white text-slate-950'
                : 'text-white/85 hover:text-white hover:bg-white/12'
            }`}
            title="Upper Body Portrait"
            aria-label="Upper Body Portrait"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setCameraFraming('full');
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              cameraFraming === 'full'
                ? 'bg-white text-slate-950'
                : 'text-white/85 hover:text-white hover:bg-white/12'
            }`}
            title="Full Body View"
            aria-label="Full Body View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-white/15 mx-1" aria-hidden="true" />

          <button
            type="button"
            disabled={history.past.length === 0}
            onClick={() => {
              soundEngine.playUiClick();
              setHistory((h) => undoWardrobeDraft(h));
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={history.future.length === 0}
            onClick={() => {
              soundEngine.playUiClick();
              setHistory((h) => redoWardrobeDraft(h));
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-white/15 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={handleCycleGlass}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
            title={`Glass Style: ${
              resolvedGlassMode === 'smoked_pseudo' ? 'Smoked (0% FPS overhead)' : 'Frosted Blur'
            }`}
            aria-label="Toggle Glass Style"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtle status toast under top toolbar */}
      {statusNotice && (
        <div className="pointer-events-none absolute top-[62px] left-1/2 md:left-[35%] -translate-x-1/2 z-20">
          <div className={`px-3.5 py-1.5 rounded-full text-xs font-medium text-white/95 whitespace-nowrap ${glassPillClass}`}>
            {statusNotice}
          </div>
        </div>
      )}

      {/* 4. Top-Right Balance & Close Pill (matching reference top-right action slot) */}
      <div className="absolute top-4 right-5 z-20 flex items-center gap-2">
        <div className={`h-9 px-3.5 rounded-full flex items-center gap-2 text-xs font-semibold tabular-nums ${glassPillClass}`}>
          <span className="text-amber-300">{Math.floor(lulBalance).toLocaleString()}</span>
          <span className="text-white/65">$LUL</span>
        </div>
        <button
          type="button"
          data-wardrobe-close-btn="true"
          onClick={() => {
            soundEngine.playUiClick();
            onClose();
          }}
          className="h-9 px-3.5 rounded-full bg-white hover:bg-slate-100 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-colors cursor-pointer whitespace-nowrap"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Exit Studio</span>
        </button>
      </div>

      {/* Drag hint subtle unobtrusive bottom-left helper above bottom bar */}
      <div className="hidden md:flex pointer-events-none absolute bottom-[78px] left-6 z-10 items-center gap-2 text-[11px] text-white/60">
        <span>Drag avatar to rotate 360°</span>
        <span aria-hidden="true">·</span>
        <span>Scroll to zoom</span>
      </div>

      {/* 5. Right Floating Smoked-Glass Wardrobe Panel (matching reference two-column layout) */}
      <aside
        data-wardrobe-glass-panel="true"
        data-wardrobe-glass-mode={resolvedGlassMode}
        className={`absolute top-[64px] right-5 bottom-[74px] w-[420px] max-w-[calc(100vw-24px)] z-20 rounded-2xl flex flex-col overflow-hidden ${glassSurfaceClass}`}
      >
        {/* Panel Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/[0.14] flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-wide text-white whitespace-nowrap">
            {panelHeaderTitle}
          </h2>
          <div className="flex items-center gap-1 text-white/75">
            <button
              type="button"
              onClick={handleRemoveAll}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Reset Outfit to Default"
              aria-label="Reset Outfit"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCycleSort}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={`Sort: ${sortMode === 'featured' ? 'Featured' : sortMode === 'price_asc' ? 'Price Low-High' : 'Price High-Low'}`}
              aria-label="Sort Items"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCycleFilter}
              className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
        {activeBottomTab === 'character' ? (
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
              <div className="grid grid-cols-3 gap-x-3 gap-y-4">
                {/* White Circular Save Character Button */}
                <button
                  type="button"
                  data-wardrobe-save-preset-btn="true"
                  onClick={handleSavePreset}
                  className="group flex flex-col items-center gap-1.5 cursor-pointer"
                >
                  <div className="w-[82px] h-[82px] rounded-full bg-white hover:bg-slate-100 text-slate-950 flex flex-col items-center justify-center gap-1 shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-transform group-hover:scale-[1.04] group-active:scale-95">
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
                      className="relative w-[82px] h-[82px] rounded-full ring-1 ring-white/25 hover:ring-white flex flex-col items-center justify-center text-white transition-transform hover:scale-[1.04] cursor-pointer"
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
                      className="absolute top-0 right-1 w-5 h-5 rounded-full bg-[#151115]/90 border border-white/25 text-white/75 hover:text-rose-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
              <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
                        className="relative w-[82px] h-[82px] rounded-full overflow-hidden ring-1 ring-white/22 group-hover:ring-white/60 flex items-center justify-center transition-transform group-hover:scale-[1.04]"
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
          <div className="flex-1 flex min-h-0">
            {/* Left Vertical Face Feature Rail (Eyes / Brows / Lips) */}
            <nav
              aria-label="Face features"
              className="w-[74px] shrink-0 py-3 px-1.5 border-r border-white/[0.10] flex flex-col items-center gap-3 overflow-y-auto"
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
                      setCameraFraming('face');
                    }}
                    className="flex flex-col items-center gap-1 w-full cursor-pointer group focus-visible:outline-none"
                  >
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
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

            {/* Right 3-Column Circular Face Feature Grid */}
            <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3.5 space-y-4">
              <div className="flex items-center justify-between text-xs">
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
              </div>

              <div className="space-y-5">
                {partitionedFaceItems.owned.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="text-[11px] font-semibold text-white/65 flex items-center gap-1.5">
                      <span>Owned</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{partitionedFaceItems.owned.length}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
                    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
            </div>
          </div>
        ) : activeBottomTab === 'body' ? (
          <div
            data-wardrobe-body-panel="true"
            className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
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
                <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
                <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
          <div data-wardrobe-style-panel="true" className="flex-1 flex min-h-0">
            {/* Left Vertical Style Rail (Anim Set / Dance / Dye) */}
            <nav
              aria-label="Style categories"
              className="w-[74px] shrink-0 py-3 px-1.5 border-r border-white/[0.10] flex flex-col items-center gap-3 overflow-y-auto"
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
                    className="flex flex-col items-center gap-1 w-full cursor-pointer group focus-visible:outline-none"
                  >
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
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
                              { id: 'initiate', label: 'Preview: Inisiator' },
                              { id: 'receive', label: 'Preview: Penerima' },
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
                          Dekati Player / NPC di kota lalu pilih <span className="text-white/85 font-semibold">Interaksi</span> untuk pose berpasangan.
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
                        <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
                        <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
          <div className="flex-1 flex min-h-0">
            {/* Left Vertical Garment Rail (Top / Bottoms / Set / Hair / Shoes / Underwear) */}
            <nav
              aria-label="Wardrobe categories"
              className="w-[74px] shrink-0 py-3 px-1.5 border-r border-white/[0.10] flex flex-col items-center gap-3 overflow-y-auto"
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
                    className="flex flex-col items-center gap-1 w-full cursor-pointer group focus-visible:outline-none"
                  >
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
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
                          { id: 'all', label: 'Semua' },
                          { id: 'underwear', label: 'Pakaian Dalam' },
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
                        title="Sembunyikan baju luar sementara untuk melihat pakaian dalam"
                      >
                        {underwearPreviewBare ? 'Preview: Tanpa Baju' : 'Preview: Pakai Baju'}
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
                              ? 'Mode Tanpa Baju Luar aktif (Bikini/Swimsuit/Underwear tampil di kota)'
                              : 'Baju luar kembali tampil di kota',
                          );
                        }}
                        className={`h-7 rounded-full text-[10px] font-medium transition-colors cursor-pointer px-2.5 truncate ${
                          draft.hideOuterForUnderwear
                            ? 'bg-[#8ad8ff] text-slate-950 font-semibold'
                            : 'bg-white/[0.06] text-white/70 border border-white/10 hover:bg-white/[0.12]'
                        }`}
                        title="Simpan tanpa atasan/bawahan luar agar bikini/swimsuit/underwear terlihat saat main di kota"
                      >
                        {draft.hideOuterForUnderwear ? 'Di Kota: Tanpa Baju' : 'Di Kota: Pakai Baju'}
                      </button>
                    </div>
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
                    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
                    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
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
        {unownedPreviewItems.length > 0 && (
          <div className="px-4 py-3 border-t border-white/[0.14] bg-[#120d11]/85 flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-amber-200 truncate">
                Try-On Preview · {unownedPreviewItems[0].name}
                {unownedPreviewItems.length > 1 ? ` +${unownedPreviewItems.length - 1}` : ''}
              </div>
              <div className="text-[10px] text-white/60 tabular-nums">
                Unlock to wear in city · {unownedPreviewItems[0].priceLul} $LUL
              </div>
            </div>
            <button
              type="button"
              data-wardrobe-buy-btn={unownedPreviewItems[0].id}
              onClick={() => handleBuyPreviewItem(unownedPreviewItems[0])}
              className="px-3.5 py-1.5 rounded-full bg-amber-300 hover:bg-amber-200 text-slate-950 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Buy · {unownedPreviewItems[0].priceLul} $LUL
            </button>
          </div>
        )}
      </aside>

      {/* 6. Bottom Floating Navigation Bar + Complete CTA */}
      <div className="absolute bottom-4 left-6 right-5 z-20 flex items-center justify-between gap-4">
        <div className={`inline-flex items-center gap-0.5 p-1 rounded-full ${glassPillClass}`}>
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
                onClick={() => handleBottomTabClick(tab.id)}
                className={`h-8 px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
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
          className="h-10 px-8 rounded-full bg-[#9ad8ff] hover:bg-[#bae6fd] text-slate-950 text-xs font-semibold shadow-[0_10px_28px_rgba(138,216,255,0.28)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Complete
        </button>
      </div>
    </div>
  );
};
