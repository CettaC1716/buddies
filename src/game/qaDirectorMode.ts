import {
  NAMED_NPC_IDS,
  applyClosenessDecay,
  createEmptyNpcClosenessRecord,
  getClosenessBand,
  getEffectiveClosenessScore,
  getUnlockedFeaturesForScore,
  type ClosenessBand,
  type ClosenessUnlockId,
  type NpcClosenessRecord,
  type NpcClosenessStore,
  type NpcId,
} from './npcClosenessEngine';
import type { NpcEmotionTag } from './npcPersonaRegistry';
import {
  CITY_RENTAL_LOTS,
  DEFAULT_COMMERCIAL_CONFIG,
  SHOP_BUILDING_FORMS,
  STANDARD_SHOP_FOOTPRINT_SPEC,
  computeStandardShopPlacementForLot,
  type CityRentalLotSpec,
  type CityRentalLotStatus,
  type ShopBuildingFormId,
  type ShopBuildingFormSpec,
  type StandardShopPlacementBounds,
} from './buddiesCityRentalLotsRules';
import {
  resolveLotLifecycleStatus,
  type LotRentalRecord,
  type LotRentalStore,
} from './shopRentalEngine';
import { MS_PER_DAY } from '../lib/cerriaBrand';

/**
 * Dev-Only QA Director Mode (Non-Destructive)
 * ============================================
 * Enables rapid quality-control testing of:
 * 1. All catalog items (Wardrobe/Poses, Vehicles, Furniture/Shops, Cafe Gifts)
 *    via an in-memory virtual override layer that NEVER mutates real persisted saves.
 * 2. Virtual Test Wallet (+LUL QA session bonus) with clean snapshot/restore.
 * 3. Instant NPC closeness presets, decay simulation, emotion triggers, proactive topic
 *    starters, world clock overrides, and live sensor/pathfinder telemetry.
 * 4. Shop Building QA: 16-lot instant placement/swap of all 3 forms, lease lifecycle
 *    simulation, rooftop billboard UV/lighting test patterns, 3D bounds overlay,
 *    sidewalk teleportation, and architectural fit compliance checks.
 *
 * Strictly gated to development builds (`import.meta.env.DEV`) so zero debug UI or
 * hidden closeness values can ever leak into production player-facing UI.
 */

export const QA_DIRECTOR_ARENA_CMD_EVENT = 'qa-director-arena-cmd';
export const QA_DIRECTOR_TELEMETRY_EVENT = 'qa-director-telemetry';
export const NPC_PROACTIVE_TOPIC_EVENT = 'npc-proactive-topic-trigger';
export const NPC_EMOTION_REACT_EVENT = 'npc-emotion-react';

export interface QaDirectorState {
  /** Master switch for non-destructive QA overrides (virtual items, wallet bonus, closeness editing). */
  enabled: boolean;
  /** Whether the QA drawer UI is currently expanded. */
  drawerOpen: boolean;
  /** Virtual ownership override switches (never written to localStorage/Supabase). */
  previewApparelAndPoses: boolean;
  previewVehicles: boolean;
  previewMerchantAndShops: boolean;
  previewCafeGifts: boolean;
  /** Extra virtual LUL available during QA session (0 when QA disabled). */
  qaBonusLul: number;
  /** Active 3D A* path & avoidance ring debug overlay in Three.js scene. */
  debugPathfinder3D: boolean;
  /** Preview all 16 commercial lots simultaneously with cycling shop building forms. */
  previewAllShopBuildings: boolean;
  /** Render 3D 15m lot perimeter, 14m package cap, and avenue-facing arrows on all lots. */
  debugShopBounds3D: boolean;
  /** Optional world clock hour override (0-23) for schedule/lighting QA; null = live clock. */
  worldHourOverride: number | null;
}

export interface QaClosenessPreset {
  id: ClosenessBand;
  label: string;
  shortLabel: string;
  score: number;
  unlockHint: string;
}

export const QA_CLOSENESS_PRESETS: readonly QaClosenessPreset[] = [
  {
    id: 'stranger',
    label: 'Stranger (0)',
    shortLabel: 'Stranger',
    score: 0,
    unlockHint: 'Brief chat only',
  },
  {
    id: 'acquaintance',
    label: 'Acquaintance (24)',
    shortLabel: 'Acquaint',
    score: 24,
    unlockHint: 'Long chat unlocked',
  },
  {
    id: 'friendly',
    label: 'Friendly (48)',
    shortLabel: 'Friendly',
    score: 48,
    unlockHint: 'Pair Pose unlocked',
  },
  {
    id: 'close',
    label: 'Close (72)',
    shortLabel: 'Close',
    score: 72,
    unlockHint: 'Walk Together unlocked',
  },
  {
    id: 'trusted',
    label: 'Trusted (92)',
    shortLabel: 'Trusted',
    score: 92,
    unlockHint: 'Ride Together unlocked',
  },
] as const;

export interface QaNpcLiveTelemetryEntry {
  npcId: NpcId | null;
  citizenId: string;
  displayName: string;
  x: number;
  z: number;
  distanceToPlayerM: number;
  visible: boolean;
  activeActivity: string;
  activeStatusLabel: string;
  isMoving: boolean;
  isSitting: boolean;
  speedMps: number;
  stuckTimer: number;
  consecutiveStuckReplans: number;
  navPathLength: number;
  navWaypointIndex: number;
  avoidSide: number;
  avoidTimer: number;
  yieldForHazard: boolean;
  replanCount: number;
  activeEmotion: NpcEmotionTag;
  emotionRemainingSec: number;
}

export type QaShopRenderMode = 'none' | 'procedural' | 'glb';

export interface QaShopLiveTelemetrySummary {
  previewAllBuildings: boolean;
  debugBounds3D: boolean;
  visibleBuildingsCount: number;
  glbLoadedCount: number;
  proceduralFallbackCount: number;
  renderModeBySlotId: Record<string, QaShopRenderMode>;
  activeFormBySlotId: Record<string, ShopBuildingFormId | null>;
}

export interface QaArenaTelemetrySnapshot {
  timestampMs: number;
  worldClockHour: number;
  daytimePhase: 'day' | 'evening' | 'night';
  weatherLabel: string;
  isRaining: boolean;
  playerX: number;
  playerZ: number;
  debugPathfinder3D: boolean;
  npcs: QaNpcLiveTelemetryEntry[];
  shops?: QaShopLiveTelemetrySummary;
}

export type QaArenaCommand =
  | { type: 'teleport_to_npc'; npcId: NpcId }
  | { type: 'summon_npc'; npcId: NpcId }
  | { type: 'trigger_emotion'; npcId: NpcId; emotion: NpcEmotionTag; durationSec?: number }
  | { type: 'set_debug_pathfinder'; enabled: boolean }
  | { type: 'set_world_hour_override'; hour: number | null }
  | { type: 'set_telemetry_active'; active: boolean }
  | { type: 'teleport_to_lot'; lotId: string }
  | { type: 'set_shop_qa_visuals'; previewAllBuildings: boolean; debugBounds3D: boolean };

export type QaShopLeaseStatePreset =
  | 'available'
  | 'rented_30d'
  | 'expiring_soon'
  | 'grace_3d'
  | 'expired_freeing';

export type QaBillboardTestPreset = 'blank' | 'uv_grid' | 'brand_day' | 'neon_night';

export interface QaShopComplianceCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface QaShopLotDiagnostic {
  lotSpec: CityRentalLotSpec;
  formSpec: ShopBuildingFormSpec;
  bounds: StandardShopPlacementBounds;
  lifecycleStatus: CityRentalLotStatus;
  placedFormId: ShopBuildingFormId | null;
  billboardLogoUrl: string | null;
  remainingLeaseHours: number | null;
  checks: QaShopComplianceCheck[];
  allChecksPass: boolean;
}

export interface QaNpcClosenessDiagnostic {
  npcId: NpcId;
  score: number;
  peakScore: number;
  band: ClosenessBand;
  unlocks: ClosenessUnlockId[];
  totalConversations: number;
  totalGifts: number;
  totalActivities: number;
  lastGiftDateKey: string | null;
}

/**
 * Returns true ONLY in Vite dev preview (or when explicitly forced in unit tests).
 * In production builds `import.meta.env.DEV` is statically replaced with `false`.
 */
export function isQaDirectorAvailable(devFlagOverride?: boolean): boolean {
  if (typeof devFlagOverride === 'boolean') return devFlagOverride;
  try {
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

export function createInitialQaDirectorState(devAvailable: boolean = isQaDirectorAvailable()): QaDirectorState {
  return {
    enabled: devAvailable,
    drawerOpen: false,
    previewApparelAndPoses: devAvailable,
    previewVehicles: devAvailable,
    previewMerchantAndShops: devAvailable,
    previewCafeGifts: devAvailable,
    qaBonusLul: 0,
    debugPathfinder3D: false,
    previewAllShopBuildings: false,
    debugShopBounds3D: false,
    worldHourOverride: null,
  };
}

/**
 * Pure non-destructive virtual ownership resolver.
 * Never mutates `realOwnedIds`; when QA preview is off, returns `realOwnedIds` unchanged.
 */
export function resolveQaEffectiveIds(
  realOwnedIds: readonly string[],
  allCatalogIds: readonly string[],
  qaPreviewActive: boolean,
): string[] {
  if (!qaPreviewActive) {
    return realOwnedIds.slice();
  }
  const merged = new Set<string>(realOwnedIds);
  for (let i = 0; i < allCatalogIds.length; i++) {
    merged.add(allCatalogIds[i]);
  }
  return Array.from(merged);
}

/**
 * Deep-clones an NpcClosenessStore for clean snapshot/restore when toggling QA mode.
 */
export function cloneNpcClosenessStore(store: NpcClosenessStore): NpcClosenessStore {
  const records = {} as Record<NpcId, NpcClosenessRecord>;
  for (const npcId of NAMED_NPC_IDS) {
    const rec = store.records[npcId] ?? createEmptyNpcClosenessRecord();
    records[npcId] = {
      ...rec,
      lastActivityDateByKind: { ...rec.lastActivityDateByKind },
    };
  }
  return {
    version: 1,
    records,
  };
}

/**
 * Deep-clones a LotRentalStore so QA shop building overrides never corrupt persisted saves.
 */
export function cloneLotRentalStore(store: LotRentalStore): LotRentalStore {
  const rentalsByLotId: Record<string, LotRentalRecord> = {};
  for (const [lotId, rec] of Object.entries(store.rentalsByLotId)) {
    rentalsByLotId[lotId] = { ...rec };
  }
  return {
    version: 1,
    rentalsByLotId,
    returnedToMyThings: (store.returnedToMyThings ?? []).map((entry) => ({ ...entry })),
  };
}

/**
 * Computes a safe sidewalk inspection position directly in front of the target
 * commercial lot, facing straight toward the shop entrance & rooftop billboard.
 */
export function computeQaLotTeleportPose(
  lotId: string,
): { x: number; z: number; yaw: number } | null {
  const lot = CITY_RENTAL_LOTS.find((item) => item.slotId === lotId);
  if (!lot) return null;
  // Stand 2.4m outside the 10.0m front boundary (center of the 4.80m curbed avenue block sidewalk facing the facade)
  const standDistFromCenter = lot.width * 0.5 + 2.4;
  const x = +(lot.x + lot.frontDirX * standDistFromCenter).toFixed(3);
  const z = +(lot.z + lot.frontDirZ * standDistFromCenter).toFixed(3);
  const yaw = Math.atan2(-(lot.z - z), lot.x - x);
  return { x, z, yaw };
}

/**
 * Generates crisp 3.2:1 (1024x320) SVG data URL test patterns for rooftop billboard QA.
 * Works identically in Node tests and Three.js TextureLoader without needing DOM Canvas.
 */
export function generateQaBillboardTestDataUrl(
  preset: QaBillboardTestPreset,
  lotShortCode: string = 'N-01',
): string | null {
  if (preset === 'blank') return null;

  const safeCode = lotShortCode.replace(/[^A-Za-z0-9\- ]/g, '').slice(0, 12) || 'SHOP';
  let svg = '';

  if (preset === 'uv_grid') {
    svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="320" viewBox="0 0 1024 320">',
      '<rect width="1024" height="320" fill="#0f172a"/>',
      '<g stroke="#334155" stroke-width="2">',
      '<line x1="128" y1="0" x2="128" y2="320"/><line x1="256" y1="0" x2="256" y2="320"/>',
      '<line x1="384" y1="0" x2="384" y2="320"/><line x1="512" y1="0" x2="512" y2="320"/>',
      '<line x1="640" y1="0" x2="640" y2="320"/><line x1="768" y1="0" x2="768" y2="320"/>',
      '<line x1="896" y1="0" x2="896" y2="320"/><line x1="0" y1="80" x2="1024" y2="80"/>',
      '<line x1="0" y1="160" x2="1024" y2="160"/><line x1="0" y1="240" x2="1024" y2="240"/>',
      '</g>',
      '<rect x="8" y="8" width="1008" height="304" fill="none" stroke="#22d3ee" stroke-width="10"/>',
      '<rect x="28" y="28" width="968" height="264" fill="none" stroke="#a3e635" stroke-width="4" stroke-dasharray="16 10"/>',
      '<text x="512" y="138" text-anchor="middle" fill="#f8fafc" font-family="monospace" font-weight="900" font-size="60">UV QA · 3.2:1 · LOT ' +
        safeCode +
        '</text>',
      '<text x="512" y="210" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-weight="700" font-size="34">LEFT ← TOP UP · RIGHT →</text>',
      '<text x="48" y="64" fill="#a3e635" font-family="monospace" font-weight="700" font-size="24">TL</text>',
      '<text x="944" y="64" fill="#a3e635" font-family="monospace" font-weight="700" font-size="24">TR</text>',
      '<text x="48" y="280" fill="#fbbf24" font-family="monospace" font-weight="700" font-size="24">BL</text>',
      '<text x="944" y="280" fill="#fbbf24" font-family="monospace" font-weight="700" font-size="24">BR</text>',
      '</svg>',
    ].join('');
  } else if (preset === 'brand_day') {
    svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="320" viewBox="0 0 1024 320">',
      '<rect width="1024" height="320" fill="#fffbeb"/>',
      '<rect x="14" y="14" width="996" height="292" rx="18" fill="none" stroke="#d97706" stroke-width="10"/>',
      '<circle cx="136" cy="160" r="64" fill="#f59e0b"/>',
      '<text x="136" y="178" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="52">C</text>',
      '<text x="570" y="146" text-anchor="middle" fill="#1e293b" font-family="sans-serif" font-weight="900" font-size="68">CERRIA ATELIER</text>',
      '<text x="570" y="220" text-anchor="middle" fill="#b45309" font-family="sans-serif" font-weight="700" font-size="34">FLAGSHIP BOUTIQUE · LOT ' +
        safeCode +
        '</text>',
      '</svg>',
    ].join('');
  } else {
    svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="320" viewBox="0 0 1024 320">',
      '<rect width="1024" height="320" fill="#090d1a"/>',
      '<rect x="16" y="16" width="992" height="288" rx="20" fill="none" stroke="#ec4899" stroke-width="10"/>',
      '<rect x="30" y="30" width="964" height="260" rx="14" fill="none" stroke="#22d3ee" stroke-width="4"/>',
      '<text x="512" y="152" text-anchor="middle" fill="#f0abfc" font-family="sans-serif" font-weight="900" font-size="76">NEON ARCADE ' +
        safeCode +
        '</text>',
      '<text x="512" y="228" text-anchor="middle" fill="#67e8f9" font-family="monospace" font-weight="700" font-size="34">OPEN 24H · NIGHT LIGHTING QA</text>',
      '</svg>',
    ].join('');
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Evaluates full architectural compliance, margins, coverage, and lease status for a
 * commercial lot + target shop building form.
 */
export function evaluateQaShopLotDiagnostic(
  store: LotRentalStore,
  lotId: string,
  inspectFormId?: ShopBuildingFormId | null,
  nowMs: number = Date.now(),
): QaShopLotDiagnostic | null {
  const lotSpec = CITY_RENTAL_LOTS.find((l) => l.slotId === lotId);
  if (!lotSpec) return null;

  const rec = store.rentalsByLotId[lotId] ?? null;
  const lifecycleStatus = resolveLotLifecycleStatus(rec, nowMs);
  const placedFormId =
    rec && (lifecycleStatus === 'rented' || lifecycleStatus === 'grace')
      ? rec.placedBuildingFormId
      : null;
  const targetFormId: ShopBuildingFormId =
    inspectFormId ?? placedFormId ?? lotSpec.buildingVariantId;
  const formSpec = SHOP_BUILDING_FORMS[targetFormId];
  const bounds = computeStandardShopPlacementForLot(lotSpec, targetFormId);

  const maxCapW = STANDARD_SHOP_FOOTPRINT_SPEC.width;
  const maxCapD = STANDARD_SHOP_FOOTPRINT_SPEC.depth;
  const minMargin = STANDARD_SHOP_FOOTPRINT_SPEC.sideMarginM;
  const minLotMargin = Math.min(
    bounds.leftMarginM,
    bounds.rightMarginM,
    bounds.rearMarginM,
    bounds.frontApronMarginM,
  );
  const coveragePct = +(bounds.lotCoverageRatio * 100).toFixed(1);
  const maxCoveragePct = +(STANDARD_SHOP_FOOTPRINT_SPEC.maxAllowedCoverageRatio * 100).toFixed(1);

  const checks: QaShopComplianceCheck[] = [
    {
      id: 'package_cap',
      label: 'Footprint Cap',
      pass: bounds.width <= maxCapW && bounds.depth <= maxCapD,
      detail: `${bounds.width.toFixed(2)}×${bounds.depth.toFixed(2)}m / max ${maxCapW}×${maxCapD}m`,
    },
    {
      id: 'margins',
      label: '4-Side Setback',
      pass: minLotMargin >= minMargin,
      detail: `min ${minLotMargin.toFixed(2)}m (req ≥${minMargin.toFixed(2)}m)`,
    },
    {
      id: 'coverage',
      label: 'Lot Coverage',
      pass: bounds.lotCoverageRatio <= STANDARD_SHOP_FOOTPRINT_SPEC.maxAllowedCoverageRatio,
      detail: `${coveragePct}% / max ${maxCoveragePct}%`,
    },
    {
      id: 'strict_fit',
      label: 'No Sidewalk Intrusion',
      pass: bounds.fitsStrictlyInsideLot,
      detail: bounds.fitsStrictlyInsideLot ? 'Strictly inside 20×20m lot' : 'Bounds exceed lot!',
    },
  ];

  const remainingLeaseHours =
    rec && lifecycleStatus !== 'available'
      ? +((rec.expiresAtMs - nowMs) / (60 * 60 * 1000)).toFixed(1)
      : null;

  return {
    lotSpec,
    formSpec,
    bounds,
    lifecycleStatus,
    placedFormId,
    billboardLogoUrl: rec?.billboardLogoUrl ?? null,
    remainingLeaseHours,
    checks,
    allChecksPass: checks.every((c) => c.pass),
  };
}

/**
 * Non-destructive in-memory Shop QA mutation: instantly places or removes any building form
 * on any lot (auto-creating a QA active rental when placing on an empty/expired lot).
 */
export function applyQaShopPlaceBuilding(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
  formId: ShopBuildingFormId | null;
  nowMs?: number;
}): LotRentalStore {
  const nowMs = params.nowMs ?? Date.now();
  const next = cloneLotRentalStore(params.store);
  const existing = next.rentalsByLotId[params.lotId];
  const cfg = DEFAULT_COMMERCIAL_CONFIG;
  const acct = params.accountId.trim() || 'qa_tester';

  if (params.formId === null) {
    if (!existing) return next;
    next.rentalsByLotId[params.lotId] = {
      ...existing,
      placedBuildingFormId: null,
      billboardLogoUrl: null,
    };
    return next;
  }

  const existingStatus = resolveLotLifecycleStatus(existing, nowMs);
  if (!existing || existingStatus === 'available' || existingStatus === 'freeing') {
    next.rentalsByLotId[params.lotId] = {
      lotId: params.lotId,
      renterAccountId: acct,
      lockedRentRespite: 0,
      termDays: cfg.rentTermDays,
      gracePeriodDays: cfg.gracePeriodDays,
      startedAtMs: nowMs,
      expiresAtMs: nowMs + cfg.rentTermDays * MS_PER_DAY,
      placedBuildingFormId: params.formId,
      billboardLogoUrl: null,
    };
  } else {
    next.rentalsByLotId[params.lotId] = {
      ...existing,
      renterAccountId: acct,
      placedBuildingFormId: params.formId,
    };
  }
  return next;
}

/**
 * Non-destructive in-memory Shop QA lease lifecycle simulator (Available / Rented 30d /
 * Expiring <24h / Grace 3d / Expired past grace) for instant UI & 3D verification.
 */
export function applyQaShopLotStateMutation(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
  preset: QaShopLeaseStatePreset;
  nowMs?: number;
}): LotRentalStore {
  const nowMs = params.nowMs ?? Date.now();
  const next = cloneLotRentalStore(params.store);
  const existing = next.rentalsByLotId[params.lotId];
  const cfg = DEFAULT_COMMERCIAL_CONFIG;
  const acct = params.accountId.trim() || 'qa_tester';

  if (params.preset === 'available') {
    delete next.rentalsByLotId[params.lotId];
    return next;
  }

  const lotSpec = CITY_RENTAL_LOTS.find((l) => l.slotId === params.lotId);
  const placedForm = existing?.placedBuildingFormId ?? lotSpec?.buildingVariantId ?? 'glass_corner_3story';
  const billboardLogoUrl = existing?.billboardLogoUrl ?? null;

  let startedAtMs = nowMs;
  let expiresAtMs = nowMs + cfg.rentTermDays * MS_PER_DAY;
  if (params.preset === 'expiring_soon') {
    startedAtMs = nowMs - (cfg.rentTermDays - 1) * MS_PER_DAY;
    expiresAtMs = nowMs + 6 * 60 * 60 * 1000; // 6 hours left
  } else if (params.preset === 'grace_3d') {
    startedAtMs = nowMs - (cfg.rentTermDays + 1) * MS_PER_DAY;
    expiresAtMs = nowMs - 12 * 60 * 60 * 1000; // 12h into 3-day grace window
  } else if (params.preset === 'expired_freeing') {
    startedAtMs = nowMs - (cfg.rentTermDays + cfg.gracePeriodDays + 2) * MS_PER_DAY;
    expiresAtMs = nowMs - (cfg.gracePeriodDays + 1) * MS_PER_DAY; // past grace -> freeing
  }

  next.rentalsByLotId[params.lotId] = {
    lotId: params.lotId,
    renterAccountId: acct,
    lockedRentRespite: 0,
    termDays: cfg.rentTermDays,
    gracePeriodDays: cfg.gracePeriodDays,
    startedAtMs,
    expiresAtMs,
    placedBuildingFormId: placedForm,
    billboardLogoUrl,
  };
  return next;
}

/**
 * Non-destructive in-memory Shop QA rooftop billboard preset applier.
 * Ensures a building is mounted on the lot so the billboard test pattern is immediately visible.
 */
export function applyQaShopBillboardPreset(params: {
  store: LotRentalStore;
  lotId: string;
  accountId: string;
  preset: QaBillboardTestPreset;
  nowMs?: number;
}): LotRentalStore {
  const nowMs = params.nowMs ?? Date.now();
  const lotSpec = CITY_RENTAL_LOTS.find((l) => l.slotId === params.lotId);
  const existing = params.store.rentalsByLotId[params.lotId];
  const existingStatus = resolveLotLifecycleStatus(existing, nowMs);
  const needsAutoPlace =
    params.preset !== 'blank' &&
    (!existing ||
      existingStatus === 'available' ||
      existingStatus === 'freeing' ||
      !existing.placedBuildingFormId);

  const baseStore = needsAutoPlace
    ? applyQaShopPlaceBuilding({
        store: params.store,
        lotId: params.lotId,
        accountId: params.accountId,
        formId: existing?.placedBuildingFormId ?? lotSpec?.buildingVariantId ?? 'glass_corner_3story',
        nowMs,
      })
    : cloneLotRentalStore(params.store);

  const rec = baseStore.rentalsByLotId[params.lotId];
  if (!rec) return baseStore;

  const dataUrl = generateQaBillboardTestDataUrl(params.preset, lotSpec?.shortCode ?? params.lotId);
  baseStore.rentalsByLotId[params.lotId] = {
    ...rec,
    billboardLogoUrl: dataUrl,
  };
  return baseStore;
}

/**
 * Instantly sets closeness score for one NPC or all 7 named NPCs in-memory for QA.
 * Also clears same-day gift/activity locks when `clearDailyLocks` is true so QA can
 * test gift reactions and shared activity triggers repeatedly without waiting 24h.
 */
export function applyQaClosenessPreset(
  store: NpcClosenessStore,
  target: NpcId | 'all',
  score: number,
  options: { nowMs?: number; clearDailyLocks?: boolean } = {},
): NpcClosenessStore {
  const nowMs = options.nowMs ?? Date.now();
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const targets: readonly NpcId[] = target === 'all' ? NAMED_NPC_IDS : [target];
  const next = cloneNpcClosenessStore(store);

  for (const npcId of targets) {
    const prev = next.records[npcId] ?? createEmptyNpcClosenessRecord();
    next.records[npcId] = {
      ...prev,
      score: clamped,
      peakScore: Math.max(prev.peakScore, clamped),
      lastInteractionAtMs: nowMs,
      ...(options.clearDailyLocks
        ? {
            lastGiftDateKey: null,
            lastActivityDateByKind: {},
          }
        : {}),
    };
  }
  return next;
}

/**
 * Simulates multi-day real-time absence to verify the real decay engine
 * (3-day grace window, -1 pt/day thereafter, safe floor of 10 once peak >= 10).
 */
export function simulateQaAbsenceDecay(
  store: NpcClosenessStore,
  target: NpcId | 'all',
  elapsedDays: number,
  nowMs: number = Date.now(),
): NpcClosenessStore {
  const safeDays = Math.max(0, Math.min(365, Number.isFinite(elapsedDays) ? elapsedDays : 0));
  const targets: readonly NpcId[] = target === 'all' ? NAMED_NPC_IDS : [target];
  const next = cloneNpcClosenessStore(store);

  for (const npcId of targets) {
    const prev = next.records[npcId] ?? createEmptyNpcClosenessRecord();
    const baseLastMs = prev.lastInteractionAtMs ?? nowMs;
    const simulatedLastMs = baseLastMs - Math.round(safeDays * MS_PER_DAY);
    const backdated: NpcClosenessRecord = {
      ...prev,
      lastInteractionAtMs: simulatedLastMs,
    };
    const decayed = applyClosenessDecay(backdated, nowMs);
    next.records[npcId] = {
      ...decayed,
      lastInteractionAtMs: nowMs,
    };
  }
  return next;
}

export function buildQaNpcClosenessDiagnostic(
  store: NpcClosenessStore,
  npcId: NpcId,
  nowMs: number = Date.now(),
): QaNpcClosenessDiagnostic {
  const rec = store.records[npcId] ?? createEmptyNpcClosenessRecord();
  const effective = getEffectiveClosenessScore(rec, nowMs);
  return {
    npcId,
    score: effective,
    peakScore: rec.peakScore,
    band: getClosenessBand(effective),
    unlocks: getUnlockedFeaturesForScore(effective),
    totalConversations: rec.totalConversations,
    totalGifts: rec.totalGifts,
    totalActivities: rec.totalActivities,
    lastGiftDateKey: rec.lastGiftDateKey,
  };
}

export function dispatchQaArenaCommand(command: QaArenaCommand): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<QaArenaCommand>(QA_DIRECTOR_ARENA_CMD_EVENT, { detail: command }));
}

export function dispatchNpcEmotionReaction(
  npcId: NpcId,
  emotion: NpcEmotionTag,
  durationSec: number = 4.2,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ npcId: NpcId; emotion: NpcEmotionTag; durationSec: number }>(
      NPC_EMOTION_REACT_EVENT,
      { detail: { npcId, emotion, durationSec } },
    ),
  );
}
