import React from 'react';
import {
  ParticleEmitterConfig,
  createThreePointCurve,
  evaluateParticleCurve,
} from '../game/buddiesParticleSystem';
import { soundEngine } from '../game/audio';

export interface ParticleEmitterUiState {
  emissionRate: number;
  lifetimeMin: number;
  lifetimeMax: number;
  spreadDeg: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  speedMin: number;
  speedMax: number;
  gravityY: number;
  drag: number;
  sizeStart: number;
  sizePeak: number;
  sizeEnd: number;
  opacityStart: number;
  opacityMid: number;
  opacityEnd: number;
  colorStartHex: number;
  colorEndHex: number;
}

export const INITIAL_PARTICLE_UI_STATE: ParticleEmitterUiState = {
  emissionRate: 28,
  lifetimeMin: 0.65,
  lifetimeMax: 1.45,
  spreadDeg: 32,
  dirX: 0,
  dirY: 1,
  dirZ: 0,
  speedMin: 4.5,
  speedMax: 9.5,
  gravityY: -9.8,
  drag: 1.25,
  sizeStart: 0.35,
  sizePeak: 0.95,
  sizeEnd: 0.12,
  opacityStart: 0.95,
  opacityMid: 1.0,
  opacityEnd: 0.0,
  colorStartHex: 0xb8ff3c,
  colorEndHex: 0x00d2ff,
};

export function uiStateToEmitterConfigPatch(
  ui: ParticleEmitterUiState,
): Partial<Omit<ParticleEmitterConfig, 'poolCapacity'>> {
  const minLife = Math.min(ui.lifetimeMin, ui.lifetimeMax);
  const maxLife = Math.max(ui.lifetimeMin, ui.lifetimeMax);
  const minSpd = Math.min(ui.speedMin, ui.speedMax);
  const maxSpd = Math.max(ui.speedMin, ui.speedMax);

  return {
    emissionRate: ui.emissionRate,
    lifetimeRange: [minLife, maxLife],
    direction: { x: ui.dirX, y: ui.dirY, z: ui.dirZ },
    directionSpreadRad: (ui.spreadDeg * Math.PI) / 180,
    speedRange: [minSpd, maxSpd],
    gravity: { x: 0, y: ui.gravityY, z: 0 },
    drag: ui.drag,
    sizeCurve: createThreePointCurve(ui.sizeStart, ui.sizePeak, ui.sizeEnd, 0.35),
    opacityCurve: createThreePointCurve(ui.opacityStart, ui.opacityMid, ui.opacityEnd, 0.35),
    colorStartHex: ui.colorStartHex,
    colorEndHex: ui.colorEndHex,
  };
}

interface ParticleEmitterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  uiState: ParticleEmitterUiState;
  onChangeUiState: (next: ParticleEmitterUiState) => void;
  onTriggerBurst: (count: number) => void;
  onResetPool: () => void;
  activeCount: number;
  poolCapacity: number;
  totalSpawns: number;
}

export const ParticleEmitterPanel: React.FC<ParticleEmitterPanelProps> = ({
  isOpen,
  onClose,
  uiState,
  onChangeUiState,
  onTriggerBurst,
  onResetPool,
  activeCount,
  poolCapacity,
  totalSpawns,
}) => {
  if (!isOpen) return null;

  const updateField = <K extends keyof ParticleEmitterUiState>(
    key: K,
    value: ParticleEmitterUiState[K],
  ) => {
    onChangeUiState({
      ...uiState,
      [key]: value,
    });
  };

  const applyPreset = (preset: 'fountain' | 'firejet' | 'smoke' | 'sparks') => {
    soundEngine.playUiClick();
    if (preset === 'fountain') {
      onChangeUiState({ ...INITIAL_PARTICLE_UI_STATE });
    } else if (preset === 'firejet') {
      onChangeUiState({
        ...uiState,
        emissionRate: 54,
        lifetimeMin: 0.4,
        lifetimeMax: 0.9,
        spreadDeg: 18,
        dirX: 0,
        dirY: 1,
        dirZ: 0,
        speedMin: 7.0,
        speedMax: 13.5,
        gravityY: 4.5,
        drag: 1.8,
        sizeStart: 0.45,
        sizePeak: 1.25,
        sizeEnd: 0.08,
        opacityStart: 1.0,
        opacityMid: 0.85,
        opacityEnd: 0.0,
        colorStartHex: 0xffe600,
        colorEndHex: 0xff2a00,
      });
    } else if (preset === 'smoke') {
      onChangeUiState({
        ...uiState,
        emissionRate: 22,
        lifetimeMin: 1.2,
        lifetimeMax: 2.4,
        spreadDeg: 26,
        dirX: 0.25,
        dirY: 1,
        dirZ: -0.15,
        speedMin: 2.2,
        speedMax: 4.6,
        gravityY: 1.8,
        drag: 0.95,
        sizeStart: 0.35,
        sizePeak: 1.15,
        sizeEnd: 1.65,
        opacityStart: 0.65,
        opacityMid: 0.8,
        opacityEnd: 0.0,
        colorStartHex: 0xd8dee9,
        colorEndHex: 0x4c566a,
      });
    } else if (preset === 'sparks') {
      onChangeUiState({
        ...uiState,
        emissionRate: 45,
        lifetimeMin: 0.35,
        lifetimeMax: 0.75,
        spreadDeg: 68,
        dirX: 0,
        dirY: 1,
        dirZ: 0,
        speedMin: 8.5,
        speedMax: 16.0,
        gravityY: -18.5,
        drag: 0.6,
        sizeStart: 0.45,
        sizePeak: 0.55,
        sizeEnd: 0.05,
        opacityStart: 1.0,
        opacityMid: 0.95,
        opacityEnd: 0.0,
        colorStartHex: 0xffd700,
        colorEndHex: 0xff5500,
      });
    }
  };

  // Build SVG polyline points for Size & Opacity curves over t ∈ [0, 1]
  const sizeCurve = createThreePointCurve(uiState.sizeStart, uiState.sizePeak, uiState.sizeEnd, 0.35);
  const opacityCurve = createThreePointCurve(
    uiState.opacityStart,
    uiState.opacityMid,
    uiState.opacityEnd,
    0.35,
  );
  const samples = 16;
  const sizePoints: string[] = [];
  const opacityPoints: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = 6 + t * 188;
    const sNorm = Math.min(1, Math.max(0, evaluateParticleCurve(sizeCurve, t) / 2.0));
    const oNorm = Math.min(1, Math.max(0, evaluateParticleCurve(opacityCurve, t)));
    sizePoints.push(`${x.toFixed(1)},${(44 - sNorm * 36).toFixed(1)}`);
    opacityPoints.push(`${x.toFixed(1)},${(44 - oNorm * 36).toFixed(1)}`);
  }

  const poolUsagePct = Math.min(100, Math.round((activeCount / Math.max(1, poolCapacity)) * 100));

  return (
    <section
      aria-label="Particle Emitter System Studio"
      data-testid="particle-emitter-panel"
      className="pointer-events-auto fixed top-16 right-3 z-40 w-80 sm:w-88 max-h-[calc(100vh-5rem)] overflow-y-auto bg-white text-[#14161d] border-3 border-[#14161d] ring-2 ring-white shadow-[6px_6px_0_#14161d] p-3 flex flex-col gap-2.5"
    >
      {/* Header + Close */}
      <div className="flex items-center justify-between border-b-2 border-[#14161d] pb-1.5">
        <div>
          <h2 className="font-black text-xs uppercase tracking-wider text-[#14161d]">
            FIXED-POOL PARTICLE EMITTER
          </h2>
          <p className="text-[10px] font-bold text-[#14161d]/70">
            1 Emitter · Preallocated Pool ({poolCapacity} Slots)
          </p>
        </div>
        <button
          type="button"
          aria-label="Close Particle Emitter Panel"
          onClick={() => {
            soundEngine.playUiClick();
            onClose();
          }}
          className="px-2 py-0.5 bg-[#14161d] hover:bg-[#ff3b30] text-white font-black text-xs border-2 border-[#14161d] cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Live Preallocated Pool Meter */}
      <div className="bg-[#14161d] text-white p-2 border-2 border-[#14161d]">
        <div className="flex items-center justify-between text-[10px] font-mono-tabular font-bold mb-1">
          <span>
            POOL ACTIVE: <strong data-testid="particle-pool-active">{activeCount}</strong> /{' '}
            <span data-testid="particle-pool-capacity">{poolCapacity}</span>
          </span>
          <span className="text-[#b8ff3c]">SPAWNS: {totalSpawns}</span>
        </div>
        <div className="w-full h-2 bg-[#272935] overflow-hidden border border-white/25">
          <div
            className="h-full bg-[#b8ff3c] transition-all duration-75"
            style={{ width: `${poolUsagePct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onTriggerBurst(24);
            }}
            className="flex-1 py-1 bg-[#b8ff3c] hover:bg-[#c7ff72] text-[#14161d] font-black text-[10px] uppercase border border-[#14161d] cursor-pointer"
          >
            BURST +24
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onResetPool();
            }}
            className="px-2.5 py-1 bg-[#ff3b30] hover:bg-[#ff554a] text-white font-black text-[10px] uppercase border border-[#14161d] cursor-pointer"
          >
            CLEAR POOL
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-4 gap-1">
        <button
          type="button"
          onClick={() => applyPreset('fountain')}
          className="py-1 bg-[#b8ff3c] text-[#14161d] font-black text-[9px] uppercase border-2 border-[#14161d] cursor-pointer"
        >
          FOUNTAIN
        </button>
        <button
          type="button"
          onClick={() => applyPreset('firejet')}
          className="py-1 bg-[#fec83e] text-[#14161d] font-black text-[9px] uppercase border-2 border-[#14161d] cursor-pointer"
        >
          FIREJET
        </button>
        <button
          type="button"
          onClick={() => applyPreset('smoke')}
          className="py-1 bg-[#cbd5e1] text-[#14161d] font-black text-[9px] uppercase border-2 border-[#14161d] cursor-pointer"
        >
          SMOKE
        </button>
        <button
          type="button"
          onClick={() => applyPreset('sparks')}
          className="py-1 bg-[#00d2ff] text-[#14161d] font-black text-[9px] uppercase border-2 border-[#14161d] cursor-pointer"
        >
          SPARKS
        </button>
      </div>

      {/* 1. Emission Rate & Lifetime Range */}
      <div className="space-y-1.5 border-t-2 border-[#14161d]/15 pt-1.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#14161d]/80">
          1. EMISSION RATE &amp; LIFETIME RANGE
        </div>
        <label className="block text-[10px] font-bold">
          <div className="flex justify-between font-mono-tabular">
            <span>Emission Rate</span>
            <span>{Math.round(uiState.emissionRate)} /s</span>
          </div>
          <input
            type="range"
            aria-label="Emission Rate"
            min={0}
            max={120}
            step={1}
            value={uiState.emissionRate}
            onChange={(e) => updateField('emissionRate', Number(e.target.value))}
            className="w-full accent-[#14161d] cursor-pointer"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Lifetime Min</span>
              <span>{uiState.lifetimeMin.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              aria-label="Lifetime Min"
              min={0.1}
              max={3.0}
              step={0.05}
              value={uiState.lifetimeMin}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChangeUiState({
                  ...uiState,
                  lifetimeMin: v,
                  lifetimeMax: Math.max(v, uiState.lifetimeMax),
                });
              }}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
          <label className="block text-[10px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Lifetime Max</span>
              <span>{uiState.lifetimeMax.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              aria-label="Lifetime Max"
              min={0.15}
              max={4.0}
              step={0.05}
              value={uiState.lifetimeMax}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChangeUiState({
                  ...uiState,
                  lifetimeMax: v,
                  lifetimeMin: Math.min(uiState.lifetimeMin, v),
                });
              }}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 2. Direction Spread & Initial Speed Range */}
      <div className="space-y-1.5 border-t-2 border-[#14161d]/15 pt-1.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#14161d]/80">
          2. DIRECTION SPREAD &amp; INITIAL SPEED RANGE
        </div>
        <label className="block text-[10px] font-bold">
          <div className="flex justify-between font-mono-tabular">
            <span>Direction Spread</span>
            <span>{Math.round(uiState.spreadDeg)}°</span>
          </div>
          <input
            type="range"
            aria-label="Direction Spread"
            min={0}
            max={180}
            step={1}
            value={uiState.spreadDeg}
            onChange={(e) => updateField('spreadDeg', Number(e.target.value))}
            className="w-full accent-[#14161d] cursor-pointer"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Speed Min</span>
              <span>{uiState.speedMin.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              aria-label="Initial Speed Min"
              min={0.5}
              max={25}
              step={0.5}
              value={uiState.speedMin}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChangeUiState({
                  ...uiState,
                  speedMin: v,
                  speedMax: Math.max(v, uiState.speedMax),
                });
              }}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
          <label className="block text-[10px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Speed Max</span>
              <span>{uiState.speedMax.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              aria-label="Initial Speed Max"
              min={1.0}
              max={35}
              step={0.5}
              value={uiState.speedMax}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChangeUiState({
                  ...uiState,
                  speedMax: v,
                  speedMin: Math.min(uiState.speedMin, v),
                });
              }}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 3. Gravity & Air Drag */}
      <div className="space-y-1.5 border-t-2 border-[#14161d]/15 pt-1.5">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#14161d]/80">
          3. GRAVITY &amp; AIR DRAG
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Gravity Y</span>
              <span>{uiState.gravityY.toFixed(1)} m/s²</span>
            </div>
            <input
              type="range"
              aria-label="Gravity Y"
              min={-25}
              max={10}
              step={0.5}
              value={uiState.gravityY}
              onChange={(e) => updateField('gravityY', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
          <label className="block text-[10px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Air Drag</span>
              <span>{uiState.drag.toFixed(2)} /s</span>
            </div>
            <input
              type="range"
              aria-label="Air Drag"
              min={0}
              max={6}
              step={0.05}
              value={uiState.drag}
              onChange={(e) => updateField('drag', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 4. Size & Opacity Curves over Particle Life */}
      <div className="space-y-1.5 border-t-2 border-[#14161d]/15 pt-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#14161d]/80">
            4. SIZE &amp; OPACITY CURVES OVER LIFE
          </span>
          <span className="text-[9px] font-mono-tabular font-bold text-[#14161d]/65">
            t: 0 → 0.35 → 1
          </span>
        </div>

        {/* Live Curve Preview SVG */}
        <div className="bg-[#14161d] p-1.5 border-2 border-[#14161d]">
          <svg viewBox="0 0 200 50" className="w-full h-11 overflow-visible" aria-hidden="true">
            <line x1="6" y1="44" x2="194" y2="44" stroke="#393b49" strokeWidth="1" />
            <line x1="6" y1="8" x2="194" y2="8" stroke="#272935" strokeWidth="1" strokeDasharray="3 3" />
            <polyline
              fill="none"
              stroke="#b8ff3c"
              strokeWidth="2.5"
              points={sizePoints.join(' ')}
            />
            <polyline
              fill="none"
              stroke="#00d2ff"
              strokeWidth="2"
              strokeDasharray="4 2"
              points={opacityPoints.join(' ')}
            />
          </svg>
          <div className="flex justify-between text-[9px] font-bold px-1">
            <span className="text-[#b8ff3c]">━ SIZE CURVE</span>
            <span className="text-[#00d2ff]">┅ OPACITY CURVE</span>
          </div>
        </div>

        {/* Size Curve Keyframes */}
        <div className="grid grid-cols-3 gap-1.5">
          <label className="block text-[9px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Size Start</span>
              <span>{uiState.sizeStart.toFixed(2)}</span>
            </div>
            <input
              type="range"
              aria-label="Size Curve Start"
              min={0.05}
              max={2.0}
              step={0.05}
              value={uiState.sizeStart}
              onChange={(e) => updateField('sizeStart', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
          <label className="block text-[9px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Size Peak</span>
              <span>{uiState.sizePeak.toFixed(2)}</span>
            </div>
            <input
              type="range"
              aria-label="Size Curve Peak"
              min={0.05}
              max={2.0}
              step={0.05}
              value={uiState.sizePeak}
              onChange={(e) => updateField('sizePeak', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
          <label className="block text-[9px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Size End</span>
              <span>{uiState.sizeEnd.toFixed(2)}</span>
            </div>
            <input
              type="range"
              aria-label="Size Curve End"
              min={0.0}
              max={2.0}
              step={0.05}
              value={uiState.sizeEnd}
              onChange={(e) => updateField('sizeEnd', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
        </div>

        {/* Opacity Curve Keyframes */}
        <div className="grid grid-cols-3 gap-1.5">
          <label className="block text-[9px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Alpha 0%</span>
              <span>{uiState.opacityStart.toFixed(2)}</span>
            </div>
            <input
              type="range"
              aria-label="Opacity Curve Start"
              min={0}
              max={1}
              step={0.05}
              value={uiState.opacityStart}
              onChange={(e) => updateField('opacityStart', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
          <label className="block text-[9px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Alpha 35%</span>
              <span>{uiState.opacityMid.toFixed(2)}</span>
            </div>
            <input
              type="range"
              aria-label="Opacity Curve Mid"
              min={0}
              max={1}
              step={0.05}
              value={uiState.opacityMid}
              onChange={(e) => updateField('opacityMid', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
          <label className="block text-[9px] font-bold">
            <div className="flex justify-between font-mono-tabular">
              <span>Alpha 100%</span>
              <span>{uiState.opacityEnd.toFixed(2)}</span>
            </div>
            <input
              type="range"
              aria-label="Opacity Curve End"
              min={0}
              max={1}
              step={0.05}
              value={uiState.opacityEnd}
              onChange={(e) => updateField('opacityEnd', Number(e.target.value))}
              className="w-full accent-[#14161d] cursor-pointer"
            />
          </label>
        </div>
      </div>
    </section>
  );
};
