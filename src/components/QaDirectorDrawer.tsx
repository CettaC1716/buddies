import React, { useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  Compass,
  ExternalLink,
  MapPin,
  Package,
  RotateCcw,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  CLOSENESS_UNLOCK_ORDER,
  NAMED_NPC_IDS,
  type NpcClosenessStore,
  type NpcId,
} from '../game/npcClosenessEngine';
import { NPC_EMOTION_TAGS, type NpcEmotionTag } from '../game/npcPersonaRegistry';
import {
  CITY_RENTAL_LOTS,
  SHOP_BUILDING_FORMS,
  SHOP_BUILDING_FORM_IDS,
  type ShopBuildingFormId,
} from '../game/buddiesCityRentalLotsRules';
import { resolveLotLifecycleStatus, type LotRentalStore } from '../game/shopRentalEngine';
import {
  QA_CLOSENESS_PRESETS,
  buildQaNpcClosenessDiagnostic,
  evaluateQaShopLotDiagnostic,
  type QaArenaTelemetrySnapshot,
  type QaBillboardTestPreset,
  type QaDirectorState,
  type QaShopLeaseStatePreset,
} from '../game/qaDirectorMode';

type QaTabId = 'items' | 'director' | 'shops' | 'sensors';

const NPC_DISPLAY_LABELS: Record<NpcId, { name: string; role: string }> = {
  hana: { name: 'Hana', role: 'West Merchant' },
  kai: { name: 'Kai', role: 'Harbor Host' },
  mira: { name: 'Mira', role: 'Beach Dancer' },
  nadia: { name: 'Nadia', role: 'Central Merchant' },
  tari: { name: 'Tari', role: 'Cafe Staff' },
  bima: { name: 'Bima', role: 'City Citizen' },
  kenji: { name: 'Kenji', role: 'City Citizen' },
  raka: { name: 'Raka', role: 'Beach Security' },
};

const WORLD_HOUR_PRESETS: Array<{ label: string; hour: number | null }> = [
  { label: 'Auto', hour: null },
  { label: '08:00', hour: 8 },
  { label: '13:00', hour: 13 },
  { label: '18:30', hour: 18.5 },
  { label: '22:30', hour: 22.5 },
];

const SHOP_FORM_SHORT_LABELS: Record<ShopBuildingFormId, { short: string; tag: string }> = {
  glass_corner_3story: { short: 'Glass Corner', tag: '3F · 13.4m' },
  canopy_storefront_2story: { short: 'Canopy Store', tag: '2F · 13.3m' },
  brick_rooftop_deck: { short: 'Brick Deck', tag: '2F · 12.6m' },
};

const SHOP_LEASE_PRESETS: Array<{ id: QaShopLeaseStatePreset; label: string }> = [
  { id: 'available', label: 'Available' },
  { id: 'rented_30d', label: 'Rented 30d' },
  { id: 'expiring_soon', label: '<24h Left' },
  { id: 'grace_3d', label: 'Grace 3d' },
  { id: 'expired_freeing', label: 'Expired' },
];

const SHOP_BILLBOARD_PRESETS: Array<{ id: QaBillboardTestPreset; label: string }> = [
  { id: 'blank', label: 'Blank' },
  { id: 'uv_grid', label: 'UV Grid' },
  { id: 'brand_day', label: 'Day Brand' },
  { id: 'neon_night', label: 'Night Neon' },
];

export interface QaDirectorDrawerProps {
  qaState: QaDirectorState;
  realGold: number;
  effectiveGold: number;
  closenessStore: NpcClosenessStore;
  lotRentalStore: LotRentalStore;
  telemetry: QaArenaTelemetrySnapshot | null;
  onUpdateQaState: (patch: Partial<QaDirectorState>) => void;
  onAddQaWalletLul: (amount: number) => void;
  onResetQaWalletBonus: () => void;
  onRestoreOriginalSnapshot: () => void;
  onSetNpcClosenessPreset: (target: NpcId | 'all', score: number) => void;
  onSimulateNpcDecay: (target: NpcId | 'all', days: number) => void;
  onTeleportToNpc: (npcId: NpcId) => void;
  onSummonNpc: (npcId: NpcId) => void;
  onTriggerNpcEmotion: (npcId: NpcId, emotion: NpcEmotionTag) => void;
  onTriggerProactiveTopic: (npcId: NpcId) => void;
  onTriggerGiftTest: (npcId: NpcId) => void;
  onTriggerWalkTogether: (npcId: NpcId) => void;
  onTriggerPairPose: (npcId: NpcId) => void;
  onTriggerRideTogether: (npcId: NpcId) => void;
  onQaPlaceShopBuilding: (lotId: string, formId: ShopBuildingFormId | null) => void;
  onQaSetShopLeasePreset: (lotId: string, preset: QaShopLeaseStatePreset) => void;
  onQaSetShopBillboardPreset: (lotId: string, preset: QaBillboardTestPreset) => void;
  onQaTeleportToLot: (lotId: string) => void;
  onQaOpenLotRentalModal: (lotId: string) => void;
  onQaResetShopsOverride: () => void;
}

export const QaDirectorDrawer: React.FC<QaDirectorDrawerProps> = ({
  qaState,
  realGold,
  effectiveGold,
  closenessStore,
  lotRentalStore,
  telemetry,
  onUpdateQaState,
  onAddQaWalletLul,
  onResetQaWalletBonus,
  onRestoreOriginalSnapshot,
  onSetNpcClosenessPreset,
  onSimulateNpcDecay,
  onTeleportToNpc,
  onSummonNpc,
  onTriggerNpcEmotion,
  onTriggerProactiveTopic,
  onTriggerGiftTest,
  onTriggerWalkTogether,
  onTriggerPairPose,
  onTriggerRideTogether,
  onQaPlaceShopBuilding,
  onQaSetShopLeasePreset,
  onQaSetShopBillboardPreset,
  onQaTeleportToLot,
  onQaOpenLotRentalModal,
  onQaResetShopsOverride,
}) => {
  const [activeTab, setActiveTab] = useState<QaTabId>('shops');
  const [selectedNpc, setSelectedNpc] = useState<NpcId>('mira');
  const [selectedLotId, setSelectedLotId] = useState<string>(CITY_RENTAL_LOTS[0]?.slotId ?? 'lot-n-01');
  const [lastActionNote, setLastActionNote] = useState<string>('');

  const note = (msg: string) => setLastActionNote(msg);

  const selectedDiag = useMemo(
    () => buildQaNpcClosenessDiagnostic(closenessStore, selectedNpc),
    [closenessStore, selectedNpc],
  );

  const selectedTelemetry = useMemo(() => {
    if (!telemetry) return null;
    return telemetry.npcs.find((n) => n.npcId === selectedNpc) ?? null;
  }, [telemetry, selectedNpc]);

  const stuckNpcCount = useMemo(() => {
    if (!telemetry) return 0;
    return telemetry.npcs.filter((n) => n.stuckTimer > 0.5 || n.consecutiveStuckReplans > 0).length;
  }, [telemetry]);

  const selectedShopDiag = useMemo(
    () => evaluateQaShopLotDiagnostic(lotRentalStore, selectedLotId),
    [lotRentalStore, selectedLotId],
  );

  const selectedLotRenderMode = telemetry?.shops?.renderModeBySlotId[selectedLotId] ?? 'none';

  const allPreviewOn =
    qaState.previewApparelAndPoses &&
    qaState.previewVehicles &&
    qaState.previewMerchantAndShops &&
    qaState.previewCafeGifts;

  if (!qaState.drawerOpen) {
    return (
      <div className="fixed bottom-3 left-3 z-[65] pointer-events-auto select-none">
        <button
          type="button"
          data-qa-director-toggle="true"
          onClick={() => onUpdateQaState({ drawerOpen: true })}
          title="Open Dev QA Director (Ctrl+Shift+Q)"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d121d]/95 hover:bg-[#161f33] text-slate-100 border border-emerald-400/40 shadow-lg text-[11px] font-semibold tracking-tight cursor-pointer transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>QA Director</span>
          <span className="text-[10px] font-mono text-slate-400">
            {qaState.enabled ? 'ON' : 'OFF'} · Ctrl+Shift+Q
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      data-qa-director-drawer="true"
      aria-label="Dev QA Director"
      className="fixed bottom-3 left-3 z-[65] w-[min(450px,calc(100vw-1.5rem))] max-h-[min(80vh,670px)] flex flex-col rounded-xl bg-[#0c111b]/96 text-slate-100 border border-slate-700/90 shadow-2xl overflow-hidden select-none pointer-events-auto"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#111827] border-b border-slate-700/80">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white leading-tight truncate">
              Cerria QA Director (Dev Only)
            </div>
            <div className="text-[10px] text-slate-400 leading-tight truncate">
              Non-destructive memory overrides · Ctrl+Shift+Q
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onUpdateQaState({ enabled: !qaState.enabled })}
            className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
              qaState.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                : 'bg-slate-800 text-slate-400 border-slate-600'
            }`}
          >
            {qaState.enabled ? 'QA ACTIVE' : 'QA PAUSED'}
          </button>
          <button
            type="button"
            onClick={() => onUpdateQaState({ drawerOpen: false })}
            aria-label="Collapse QA Director"
            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 grid grid-cols-4 border-b border-slate-800 bg-[#0f1624] text-[10.5px] font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={`flex items-center justify-center gap-1 py-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'items'
              ? 'border-emerald-400 text-emerald-300 bg-[#141d2f]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span>Items</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('director')}
          className={`flex items-center justify-center gap-1 py-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'director'
              ? 'border-sky-400 text-sky-300 bg-[#141d2f]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>NPCs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shops')}
          className={`flex items-center justify-center gap-1 py-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'shops'
              ? 'border-lime-400 text-lime-300 bg-[#141d2f]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Store className="w-3.5 h-3.5 shrink-0" />
          <span>Shops QA</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sensors')}
          className={`flex items-center justify-center gap-1 py-2 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'sensors'
              ? 'border-amber-400 text-amber-300 bg-[#141d2f]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span>Sensors{stuckNpcCount > 0 ? ` (${stuckNpcCount}!)` : ''}</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs min-h-0">
        {activeTab === 'items' && (
          <>
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-100">Virtual Item Preview</div>
                  <div className="text-[10px] text-slate-400">
                    Bypasses ownership in memory without editing real saves.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !allPreviewOn;
                    onUpdateQaState({
                      enabled: true,
                      previewApparelAndPoses: nextVal,
                      previewVehicles: nextVal,
                      previewMerchantAndShops: nextVal,
                      previewCafeGifts: nextVal,
                    });
                    note(nextVal ? 'All catalog categories unlocked in QA preview.' : 'All virtual previews disabled.');
                  }}
                  className={`px-2.5 py-1 rounded text-[10.5px] font-bold border cursor-pointer ${
                    qaState.enabled && allPreviewOn
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                      : 'bg-slate-800 text-slate-200 border-slate-600'
                  }`}
                >
                  {qaState.enabled && allPreviewOn ? 'All Unlocked' : 'Unlock All'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {(
                  [
                    ['previewApparelAndPoses', 'Wardrobe, Poses & Paired'],
                    ['previewVehicles', 'Scooters & E-Bikes'],
                    ['previewMerchantAndShops', 'Furniture, Shops & Gear'],
                    ['previewCafeGifts', 'Cafe Foods & Gifts'],
                  ] as const
                ).map(([key, label]) => {
                  const active = qaState.enabled && qaState[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onUpdateQaState({ enabled: true, [key]: !qaState[key] })}
                      className={`px-2.5 py-1.5 rounded text-left text-[11px] font-medium border cursor-pointer transition-colors ${
                        active
                          ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {active ? '✓ ' : '○ '}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-100">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  <span>QA Test Wallet</span>
                </div>
                <span className="font-mono text-[11px] text-amber-300">
                  {effectiveGold.toLocaleString()} CerBucks
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Real saved: {realGold.toLocaleString()} CerBucks · Virtual QA bonus: +
                {(qaState.enabled ? qaState.qaBonusLul : 0).toLocaleString()} CerBucks
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onAddQaWalletLul(50_000);
                    note('Added +50,000 virtual QA CerBucks.');
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-[11px] font-semibold cursor-pointer"
                >
                  +50,000 CerBucks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddQaWalletLul(250_000);
                    note('Added +250,000 virtual QA CerBucks.');
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-[11px] font-semibold cursor-pointer"
                >
                  +250,000 CerBucks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetQaWalletBonus();
                    note('Reset QA wallet bonus to 0.');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[11px] font-semibold cursor-pointer"
                >
                  Reset Bonus
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onRestoreOriginalSnapshot();
                note('Restored real saved closeness, shop lots & reset QA overrides.');
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-400/40 text-[11px] font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Original Save Snapshot &amp; Exit QA Overrides</span>
            </button>
          </>
        )}

        {activeTab === 'director' && (
          <>
            {/* NPC Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-400">
                <span>Target NPC</span>
                <span className="font-mono text-sky-300">
                  {NPC_DISPLAY_LABELS[selectedNpc].name} · score {selectedDiag.score} ({selectedDiag.band})
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {NAMED_NPC_IDS.map((npcId) => (
                  <button
                    key={npcId}
                    type="button"
                    onClick={() => setSelectedNpc(npcId)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors ${
                      selectedNpc === npcId
                        ? 'bg-sky-500/25 text-sky-100 border-sky-400/60'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {NPC_DISPLAY_LABELS[npcId].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Instant Closeness Band Jump */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">Closeness &amp; Unlock Jump</span>
                <button
                  type="button"
                  onClick={() => {
                    onSetNpcClosenessPreset('all', 92);
                    note('All 7 NPCs set to Trusted (92) in QA memory.');
                  }}
                  className="text-[10px] font-semibold text-emerald-300 hover:underline cursor-pointer"
                >
                  Max All 7 NPCs
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {QA_CLOSENESS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={`${preset.label} — ${preset.unlockHint}`}
                    onClick={() => {
                      onSetNpcClosenessPreset(selectedNpc, preset.score);
                      note(`${NPC_DISPLAY_LABELS[selectedNpc].name} -> ${preset.label}`);
                    }}
                    className={`px-1.5 py-1.5 rounded text-center text-[10px] font-semibold border cursor-pointer ${
                      selectedDiag.band === preset.id
                        ? 'bg-sky-500/25 text-sky-100 border-sky-400/60'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <div>{preset.shortLabel}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{preset.score}</div>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400">Absence Decay:</span>
                <button
                  type="button"
                  onClick={() => {
                    onSimulateNpcDecay(selectedNpc, 4);
                    note(`Simulated +4 days absence on ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] cursor-pointer"
                >
                  +4d (-1pt)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSimulateNpcDecay(selectedNpc, 10);
                    note(`Simulated +10 days absence on ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] cursor-pointer"
                >
                  +10d (-7pt)
                </button>
              </div>
            </div>

            {/* Direct World & Chat Triggers */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="font-bold text-slate-100">Direct Actions &amp; Natural Chat QA</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onTeleportToNpc(selectedNpc);
                    note(`Teleported player to ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 text-[11px] font-semibold cursor-pointer"
                >
                  Teleport to NPC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSummonNpc(selectedNpc);
                    note(`Summoned ${NPC_DISPLAY_LABELS[selectedNpc].name} beside player.`);
                  }}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 text-[11px] font-semibold cursor-pointer"
                >
                  Summon NPC Here
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTriggerProactiveTopic(selectedNpc);
                    note(`Triggered proactive topic starter for ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="col-span-2 px-2.5 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 text-[11px] font-semibold cursor-pointer"
                >
                  Trigger Proactive Topic Chat ({NPC_DISPLAY_LABELS[selectedNpc].name})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTriggerWalkTogether(selectedNpc);
                    note(`Requested Walk Together with ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-400/40 text-[10.5px] font-semibold cursor-pointer"
                >
                  Walk Together
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTriggerPairPose(selectedNpc);
                    note(`Requested Pair Pose with ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-400/40 text-[10.5px] font-semibold cursor-pointer"
                >
                  Pair Pose
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTriggerRideTogether(selectedNpc);
                    note(`Requested Ride Together with ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-400/40 text-[10.5px] font-semibold cursor-pointer"
                >
                  Ride Together
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTriggerGiftTest(selectedNpc);
                    note(`Simulated favorite cafe gift to ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                  }}
                  className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/40 text-[10.5px] font-semibold cursor-pointer"
                >
                  Simulate Gift
                </button>
              </div>
            </div>

            {/* Direct Emotion Trigger + World Clock */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="font-bold text-slate-100">Trigger 3D Emotion Reaction</div>
              <div className="flex flex-wrap gap-1">
                {NPC_EMOTION_TAGS.filter((e) => e !== 'neutral').map((emotion) => (
                  <button
                    key={emotion}
                    type="button"
                    onClick={() => {
                      onTriggerNpcEmotion(selectedNpc, emotion);
                      note(`Triggered "${emotion}" on ${NPC_DISPLAY_LABELS[selectedNpc].name}.`);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-medium capitalize cursor-pointer"
                  >
                    {emotion}
                  </button>
                ))}
              </div>
              <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                <span className="text-[10.5px] text-slate-400">Schedule Clock:</span>
                <div className="flex gap-1 flex-wrap">
                  {WORLD_HOUR_PRESETS.map((preset) => {
                    const active = qaState.worldHourOverride === preset.hour;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          onUpdateQaState({ worldHourOverride: preset.hour });
                          note(`World schedule clock -> ${preset.label}`);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                          active
                            ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'shops' && (
          <>
            {/* District Showcase & 3D Bounds Overlay */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-100">
                  <Building2 className="w-3.5 h-3.5 text-lime-400" />
                  <span>District Shop Building QA</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onQaResetShopsOverride();
                    note('Restored real saved rental lots & cleared QA shop overlays.');
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-400/40 text-[10px] font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Shops QA</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-qa-shop-preview-all="true"
                  onClick={() => {
                    const nextVal = !qaState.previewAllShopBuildings;
                    onUpdateQaState({ enabled: true, previewAllShopBuildings: nextVal });
                    note(
                      nextVal
                        ? 'Previewing all 16 lots simultaneously in 3D.'
                        : 'Returned to live placed shop buildings.',
                    );
                  }}
                  className={`px-2.5 py-1.5 rounded text-[10.5px] font-bold border cursor-pointer transition-colors ${
                    qaState.enabled && qaState.previewAllShopBuildings
                      ? 'bg-lime-500/20 text-lime-200 border-lime-400/60'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {qaState.enabled && qaState.previewAllShopBuildings
                    ? '✓ All 16 Lots Preview ON'
                    : '○ Preview All 16 Lots'}
                </button>
                <button
                  type="button"
                  data-qa-shop-bounds-3d="true"
                  onClick={() => {
                    const nextVal = !qaState.debugShopBounds3D;
                    onUpdateQaState({ enabled: true, debugShopBounds3D: nextVal });
                    note(
                      nextVal
                        ? '3D 15m lot / 14m cap / facing arrows enabled.'
                        : '3D lot bounds overlay disabled.',
                    );
                  }}
                  className={`px-2.5 py-1.5 rounded text-[10.5px] font-bold border cursor-pointer transition-colors ${
                    qaState.enabled && qaState.debugShopBounds3D
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {qaState.enabled && qaState.debugShopBounds3D
                    ? '✓ 3D Bounds & Margins ON'
                    : '○ 3D Bounds & Margins'}
                </button>
              </div>
              {telemetry?.shops && (
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                  <span>3D Visible: {telemetry.shops.visibleBuildingsCount}/16</span>
                  <span>
                    GLB: {telemetry.shops.glbLoadedCount} · Shell:{' '}
                    {telemetry.shops.proceduralFallbackCount}
                  </span>
                </div>
              )}
            </div>

            {/* 16-Lot Selector Grid */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-100">Commercial Lots (16)</span>
                {selectedShopDiag && (
                  <span className="font-mono text-[10px] text-lime-300">
                    {selectedShopDiag.lotSpec.shortCode} · {selectedShopDiag.lotSpec.facingRoadLabel}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {CITY_RENTAL_LOTS.map((lot) => {
                  const rec = lotRentalStore.rentalsByLotId[lot.slotId] ?? null;
                  const st = resolveLotLifecycleStatus(rec);
                  const hasBldg = Boolean(rec?.placedBuildingFormId) && (st === 'rented' || st === 'grace');
                  const dotClass = hasBldg
                    ? 'bg-lime-400'
                    : st === 'grace'
                      ? 'bg-amber-400'
                      : st === 'rented'
                        ? 'bg-sky-400'
                        : 'bg-slate-600';
                  const active = selectedLotId === lot.slotId;
                  return (
                    <button
                      key={lot.slotId}
                      type="button"
                      onClick={() => setSelectedLotId(lot.slotId)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-[10.5px] font-mono border cursor-pointer transition-colors ${
                        active
                          ? 'bg-lime-500/20 text-lime-100 border-lime-400/60 font-bold'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <span>{lot.shortCode}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  data-qa-shop-teleport="true"
                  onClick={() => {
                    onQaTeleportToLot(selectedLotId);
                    note(`Teleported to sidewalk facing Lot ${selectedShopDiag?.lotSpec.shortCode ?? selectedLotId}.`);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/50 text-[11px] font-semibold cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Teleport to Lot</span>
                </button>
                <button
                  type="button"
                  data-qa-shop-open-modal="true"
                  onClick={() => {
                    onQaOpenLotRentalModal(selectedLotId);
                    note(`Opened Lot Rental Modal for ${selectedShopDiag?.lotSpec.shortCode ?? selectedLotId}.`);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 text-[11px] font-semibold cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Lot Modal</span>
                </button>
              </div>
            </div>

            {/* Instant 3-Form Swap & Placement */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">Instant Building Form Swap</span>
                <span className="text-[10px] font-mono text-slate-400">
                  {selectedShopDiag?.placedFormId
                    ? SHOP_FORM_SHORT_LABELS[selectedShopDiag.placedFormId].short
                    : 'Empty Lot'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {SHOP_BUILDING_FORM_IDS.map((formId) => {
                  const isPlaced = selectedShopDiag?.placedFormId === formId;
                  return (
                    <button
                      key={formId}
                      type="button"
                      onClick={() => {
                        onQaPlaceShopBuilding(selectedLotId, formId);
                        note(
                          `Placed ${SHOP_BUILDING_FORMS[formId].name} on Lot ${selectedShopDiag?.lotSpec.shortCode ?? selectedLotId}.`,
                        );
                      }}
                      className={`px-2 py-1.5 rounded text-left border cursor-pointer transition-colors ${
                        isPlaced
                          ? 'bg-lime-500/20 text-lime-100 border-lime-400/60'
                          : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-[10.5px] font-bold leading-tight">
                        {SHOP_FORM_SHORT_LABELS[formId].short}
                      </div>
                      <div className="text-[9.5px] font-mono text-slate-400 mt-0.5">
                        {SHOP_FORM_SHORT_LABELS[formId].tag}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  onQaPlaceShopBuilding(selectedLotId, null);
                  note(`Cleared placed building on Lot ${selectedShopDiag?.lotSpec.shortCode ?? selectedLotId}.`);
                }}
                className="w-full py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10.5px] font-semibold cursor-pointer"
              >
                Remove Building (Keep Rental / Test Paving Revert)
              </button>
            </div>

            {/* Lease Lifecycle & Rooftop Billboard QA */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">Lease Lifecycle State QA</span>
                <span className="font-mono text-[10px] text-amber-300 uppercase">
                  {selectedShopDiag?.lifecycleStatus ?? 'available'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {SHOP_LEASE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onQaSetShopLeasePreset(selectedLotId, preset.id);
                      note(`Set Lot ${selectedShopDiag?.lotSpec.shortCode ?? selectedLotId} lease -> ${preset.label}.`);
                    }}
                    className="px-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[9.5px] font-semibold cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100">Rooftop Billboard UV &amp; Lighting</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateQaState({ enabled: true, worldHourOverride: 13 });
                        note('World lighting -> Day (13:00).');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border cursor-pointer ${
                        qaState.worldHourOverride === 13
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateQaState({ enabled: true, worldHourOverride: 22.5 });
                        note('World lighting -> Night (22:30).');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border cursor-pointer ${
                        qaState.worldHourOverride === 22.5
                          ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/60'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      Night
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {SHOP_BILLBOARD_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        onQaSetShopBillboardPreset(selectedLotId, preset.id);
                        note(
                          `Applied "${preset.label}" billboard test to Lot ${selectedShopDiag?.lotSpec.shortCode ?? selectedLotId}.`,
                        );
                      }}
                      className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Architectural Fit & Compliance Diagnostics */}
            {selectedShopDiag && (
              <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-100">
                    Fit &amp; Compliance ({selectedShopDiag.formSpec.stories}F ·{' '}
                    {selectedShopDiag.formSpec.heightM}m H)
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                      selectedShopDiag.allChecksPass
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                        : 'bg-rose-500/15 text-rose-300 border-rose-400/40'
                    }`}
                  >
                    {selectedShopDiag.allChecksPass ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    {selectedShopDiag.allChecksPass ? 'ALL PASS' : 'CHECK FAIL'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  {selectedShopDiag.checks.map((chk) => (
                    <div
                      key={chk.id}
                      className={`px-2 py-1 rounded border ${
                        chk.pass
                          ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-200 border-rose-500/40'
                      }`}
                    >
                      <div className="font-bold">
                        {chk.pass ? '✓ ' : '✕ '}
                        {chk.label}
                      </div>
                      <div className="text-[9.5px] text-slate-300 truncate">{chk.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                  <span>
                    3D Mesh:{' '}
                    <strong className="text-slate-200 uppercase">{selectedLotRenderMode}</strong>
                  </span>
                  <span>
                    Margins L/R/F/B: {selectedShopDiag.bounds.leftMarginM}/
                    {selectedShopDiag.bounds.rightMarginM}/
                    {selectedShopDiag.bounds.frontApronMarginM}/
                    {selectedShopDiag.bounds.rearMarginM}m
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'sensors' && (
          <>
            {/* 3D Pathfinder Debug Toggle */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-slate-100">3D Pathfinder Overlay</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Render A* path lines &amp; avoidance rings in 3D scene
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateQaState({ debugPathfinder3D: !qaState.debugPathfinder3D })
                }
                className={`px-2.5 py-1 rounded text-[10.5px] font-bold border cursor-pointer shrink-0 ${
                  qaState.debugPathfinder3D
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
                    : 'bg-slate-800 text-slate-300 border-slate-600'
                }`}
              >
                {qaState.debugPathfinder3D ? '3D LINES ON' : '3D LINES OFF'}
              </button>
            </div>

            {/* Selected NPC Closeness + Sensor Readout */}
            <div className="p-2.5 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">
                  {NPC_DISPLAY_LABELS[selectedNpc].name} — Closeness &amp; Sensors
                </span>
                <span className="font-mono text-[10.5px] text-sky-300">
                  {selectedDiag.score}/100 · {selectedDiag.band}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                {CLOSENESS_UNLOCK_ORDER.map((unlockId) => {
                  const unlocked = selectedDiag.unlocks.includes(unlockId);
                  return (
                    <div
                      key={unlockId}
                      className={`px-2 py-1 rounded border font-mono ${
                        unlocked
                          ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      {unlocked ? '✓ ' : '✕ '}
                      {unlockId}
                    </div>
                  );
                })}
              </div>

              {selectedTelemetry ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-slate-800 font-mono text-[10.5px] text-slate-300">
                  <div>Dist: {selectedTelemetry.distanceToPlayerM.toFixed(1)}m</div>
                  <div>Speed: {selectedTelemetry.speedMps.toFixed(2)} m/s</div>
                  <div>Activity: {selectedTelemetry.activeActivity}</div>
                  <div>Emotion: {selectedTelemetry.activeEmotion}</div>
                  <div>
                    Nav: {selectedTelemetry.navWaypointIndex}/{selectedTelemetry.navPathLength}
                  </div>
                  <div
                    className={
                      selectedTelemetry.stuckTimer > 0.45 ? 'text-rose-300 font-bold' : ''
                    }
                  >
                    Stuck: {selectedTelemetry.stuckTimer.toFixed(2)}s (esc:{selectedTelemetry.consecutiveStuckReplans})
                  </div>
                  <div>
                    Avoid: side {selectedTelemetry.avoidSide} ({selectedTelemetry.avoidTimer.toFixed(1)}s)
                  </div>
                  <div>
                    Replans: {selectedTelemetry.replanCount} · Yield:{selectedTelemetry.yieldForHazard ? 'YES' : 'no'}
                  </div>
                </div>
              ) : (
                <div className="text-[10.5px] text-slate-400">
                  Waiting for live 3D arena telemetry (visible in City/Plaza mode).
                </div>
              )}
            </div>

            {/* Live Pathfinder Health Table for All NPCs */}
            {telemetry && telemetry.npcs.length > 0 && (
              <div className="p-2 rounded-lg bg-[#131b2c] border border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-1 border-b border-slate-800">
                  <span>ALL NPC PATHFINDER HEALTH</span>
                  <span>
                    {telemetry.worldClockHour.toFixed(1)}h · {telemetry.weatherLabel}
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {telemetry.npcs.map((entry) => {
                    const isWarn = entry.stuckTimer > 0.5 || entry.consecutiveStuckReplans > 0;
                    return (
                      <button
                        key={entry.citizenId}
                        type="button"
                        onClick={() => {
                          if (entry.npcId) setSelectedNpc(entry.npcId);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-left font-mono text-[10px] cursor-pointer ${
                          isWarn
                            ? 'bg-rose-500/15 text-rose-200 border border-rose-500/35'
                            : entry.npcId === selectedNpc
                              ? 'bg-sky-500/15 text-sky-100 border border-sky-400/40'
                              : 'bg-slate-900/80 text-slate-300 border border-slate-800'
                        }`}
                      >
                        <span className="truncate font-semibold">{entry.displayName}</span>
                        <span className="shrink-0">
                          {entry.isSitting
                            ? 'SIT'
                            : entry.isMoving
                              ? `${entry.speedMps.toFixed(1)}m/s`
                              : 'IDLE'}{' '}
                          · stk:{entry.stuckTimer.toFixed(1)}s · nav:{entry.navPathLength}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {lastActionNote && (
          <div className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-[10.5px] text-emerald-300">
            {lastActionNote}
          </div>
        )}
      </div>
    </aside>
  );
};
