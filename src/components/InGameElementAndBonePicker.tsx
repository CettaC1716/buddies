import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface Hotspot3DNode {
  id: string;
  label: string;
  category: 'WEAPON_PART' | 'BONE' | 'WORLD_ENTITY';
  screenX: number;
  screenY: number;
  distPx: number;
  worldPos: { x: number; y: number; z: number };
  sourceFile: string;
}

export interface Picked3DInfo {
  meshName: string;
  hierarchyPath: string;
  hitPointWorld: { x: number; y: number; z: number } | null;
  screenBounds?: {
    x: number;
    y: number;
    w: number;
    h: number;
    sizeMeters: { w: number; h: number; d: number };
    centerWorld: { x: number; y: number; z: number };
  };
  nearestBoneName: string;
  nearestBoneDistPx: number;
  nearestBoneWorld: { x: number; y: number; z: number };
  nearestBoneLocalRotDeg: { x: number; y: number; z: number };
  activeWeaponId: string;
  fishingPhase: string;
  weaponLocalPos: { x: number; y: number; z: number } | null;
  weaponLocalRotDeg: { x: number; y: number; z: number } | null;
  rodFlexPivotRotXDeg: number | null;
  suggestedSourceFile: string;
  hotspots?: Hotspot3DNode[];
}

export interface WeaponLiveTweak {
  dx: number;
  dy: number;
  dz: number;
  dpitchDeg: number;
  dyawDeg: number;
  drollDeg: number;
  worldObjectScale?: number;
}

export interface InspectorPinItem {
  id: number;
  screenX: number;
  screenY: number;
  screenXPct: number;
  screenYPct: number;
  targetKind: 'UI_DOM' | '3D_BONE_AND_MESH';
  summaryLabel: string;
  sourceFileHint: string;
  domSelector?: string;
  domDataAttrs?: string[];
  domTextSnippet?: string;
  domRect?: { x: number; y: number; w: number; h: number };
  threeInfo?: Picked3DInfo;
  comment: string;
}

function extractDomElementTargetInfo(el: HTMLElement): {
  summaryLabel: string;
  domSelector: string;
  domDataAttrs: string[];
  domTextSnippet: string;
  sourceFileHint: string;
  rect: { x: number; y: number; w: number; h: number };
} {
  const dataAttrs: string[] = [];
  let cur: HTMLElement | null = el;
  let depth = 0;
  let bestTargetEl: HTMLElement = el;

  while (cur && cur !== document.body && depth < 7) {
    if (cur.attributes) {
      for (let i = 0; i < cur.attributes.length; i++) {
        const attr = cur.attributes[i];
        if (attr.name.startsWith('data-') && !attr.name.startsWith('data-inspector-')) {
          const formatted = `${attr.name}="${attr.value}"`;
          if (!dataAttrs.includes(formatted)) {
            dataAttrs.push(formatted);
            if (bestTargetEl === el) {
              bestTargetEl = cur;
            }
          }
        }
      }
    }
    cur = cur.parentElement;
    depth++;
  }

  const r = bestTargetEl.getBoundingClientRect();
  const rect = {
    x: Math.round(r.left),
    y: Math.round(r.top),
    w: Math.round(r.width),
    h: Math.round(r.height),
  };

  const tag = bestTargetEl.tagName.toLowerCase();
  const idPart = bestTargetEl.id ? `#${bestTargetEl.id}` : '';
  const primaryDataAttr = dataAttrs[0] ? `[${dataAttrs[0]}]` : '';
  const ariaLabel = bestTargetEl.getAttribute('aria-label');
  const rawText = (bestTargetEl.innerText || ariaLabel || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48);

  const domSelector = primaryDataAttr
    ? `${tag}${idPart}${primaryDataAttr}`
    : `${tag}${idPart}${ariaLabel ? `[aria-label="${ariaLabel}"]` : ''}`;

  let sourceFileHint = 'src/App.tsx';
  const joinedData = dataAttrs.join(' ').toLowerCase();
  if (joinedData.includes('tidewater-catch')) {
    sourceFileHint = 'src/components/TidewaterCatchShowcaseModal.tsx';
  } else if (
    joinedData.includes('merchant') ||
    joinedData.includes('hana') ||
    joinedData.includes('kai') ||
    joinedData.includes('house')
  ) {
    sourceFileHint = 'src/components/NpcMerchantAndHouseModal.tsx';
  } else if (joinedData.includes('fishing')) {
    sourceFileHint = 'src/App.tsx (Tidewater Fishing HUD Overlay)';
  }

  const summaryLabel = primaryDataAttr
    ? `${primaryDataAttr}${rawText ? ` ("${rawText}")` : ''}`
    : `${tag.toUpperCase()}${rawText ? ` ("${rawText}")` : ''}`;

  return {
    summaryLabel,
    domSelector,
    domDataAttrs: dataAttrs.slice(0, 4),
    domTextSnippet: rawText,
    sourceFileHint,
    rect,
  };
}

export const InGameElementAndBonePicker: React.FC = () => {
  const [inspectModeActive, setInspectModeActive] = useState(false);
  const [altKeyHeld, setAltKeyHeld] = useState(false);
  const [pins, setPins] = useState<InspectorPinItem[]>([]);
  const [activePinId, setActivePinId] = useState<number | null>(null);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [liveHotspots, setLiveHotspots] = useState<Hotspot3DNode[]>([]);
  const [showLiveTuner, setShowLiveTuner] = useState(false);
  const [weaponTweak, setWeaponTweak] = useState<WeaponLiveTweak>({
    dx: 0,
    dy: 0,
    dz: 0,
    dpitchDeg: 0,
    dyawDeg: 0,
    drollDeg: 0,
    worldObjectScale: 1.0,
  });
  const [hoverBox, setHoverBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    is3D?: boolean;
  } | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const hasNonZeroTweak =
    weaponTweak.dx !== 0 ||
    weaponTweak.dy !== 0 ||
    weaponTweak.dz !== 0 ||
    weaponTweak.dpitchDeg !== 0 ||
    weaponTweak.dyawDeg !== 0 ||
    weaponTweak.drollDeg !== 0 ||
    (weaponTweak.worldObjectScale !== undefined && Math.abs(weaponTweak.worldObjectScale - 1.0) > 0.005);

  const applyLiveWeaponTweak = useCallback((next: WeaponLiveTweak, reset = false) => {
    setWeaponTweak(next);
    window.dispatchEvent(
      new CustomEvent('bb-inspect-3d-tweak', {
        detail: reset ? { reset: true } : next,
      }),
    );
  }, []);

  const worldObjectScale = weaponTweak.worldObjectScale ?? 1.0;
  const applyLiveWorldObjectScale = useCallback(
    (scaleVal: number) => {
      applyLiveWeaponTweak({ ...weaponTweak, worldObjectScale: scaleVal });
    },
    [applyLiveWeaponTweak, weaponTweak],
  );

  const buildFormattedAgentReport = useCallback(
    (items: InspectorPinItem[]): string => {
      if (items.length === 0) return '';
      const lines: string[] = ['[IN-GAME INSPECTOR REPORT]'];
      items.forEach((p, idx) => {
        const num = idx + 1;
        if (p.targetKind === '3D_BONE_AND_MESH' && p.threeInfo) {
          const info = p.threeInfo;
          lines.push(
            `#${num} [3D_OBJECT_OR_RIG] File: ${info.suggestedSourceFile}`,
            `   - Komentar: ${p.comment || '(lihat target 3D ini)'}`,
            `   - Target 3D: ${info.meshName}`,
            `   - Hierarchy: ${info.hierarchyPath}`,
          );
          if (info.hitPointWorld) {
            lines.push(
              `   - World Hit Coord: [${info.hitPointWorld.x}, ${info.hitPointWorld.y}, ${info.hitPointWorld.z}]${
                info.screenBounds
                  ? ` | BBox Size: ${info.screenBounds.sizeMeters.w}x${info.screenBounds.sizeMeters.h}x${info.screenBounds.sizeMeters.d}m`
                  : ''
              }`,
            );
          }
          lines.push(
            `   - Nearest Bone: ${info.nearestBoneName} (dist=${info.nearestBoneDistPx}px, world=[${info.nearestBoneWorld.x}, ${info.nearestBoneWorld.y}, ${info.nearestBoneWorld.z}], localRotDeg=[${info.nearestBoneLocalRotDeg.x}°, ${info.nearestBoneLocalRotDeg.y}°, ${info.nearestBoneLocalRotDeg.z}°])`,
            `   - Active Weapon: ${info.activeWeaponId} (fishingPhase=${info.fishingPhase})`,
          );
          if (info.weaponLocalPos && info.weaponLocalRotDeg) {
            lines.push(
              `   - WeaponRig LocalPos: [${info.weaponLocalPos.x}, ${info.weaponLocalPos.y}, ${info.weaponLocalPos.z}] | LocalRotDeg: [${info.weaponLocalRotDeg.x}°, ${info.weaponLocalRotDeg.y}°, ${info.weaponLocalRotDeg.z}°]${
                info.rodFlexPivotRotXDeg !== null
                  ? ` | rodFlexPivotRotX=${info.rodFlexPivotRotXDeg}°`
                  : ''
              }`,
            );
          }
          if (hasNonZeroTweak) {
            lines.push(
              `   - LiveTunedDelta: scale=${(weaponTweak.worldObjectScale ?? 1.0).toFixed(2)}x | dPos=[${weaponTweak.dx.toFixed(3)}, ${weaponTweak.dy.toFixed(3)}, ${weaponTweak.dz.toFixed(3)}] | dRotDeg=[${weaponTweak.dpitchDeg}°, ${weaponTweak.dyawDeg}°, ${weaponTweak.drollDeg}°]`,
            );
          }
        } else {
          lines.push(
            `#${num} [UI_DOM] File: ${p.sourceFileHint}`,
            `   - Komentar: ${p.comment || '(lihat elemen UI ini)'}`,
            `   - Selector: ${p.domSelector || p.summaryLabel}`,
            `   - Data Attributes: ${p.domDataAttrs?.length ? p.domDataAttrs.join(', ') : 'none'}`,
            `   - Text/Label: "${p.domTextSnippet || ''}" | Rect: ${
              p.domRect
                ? `${p.domRect.w}x${p.domRect.h} @ (${p.domRect.x},${p.domRect.y})`
                : `${p.screenXPct}%,${p.screenYPct}%`
            }`,
          );
        }
      });
      return lines.join('\n');
    },
    [hasNonZeroTweak, weaponTweak],
  );

  const copyReportToClipboard = useCallback(
    (itemsToCopy: InspectorPinItem[], customToast?: string) => {
      const report = buildFormattedAgentReport(itemsToCopy);
      if (!report) return;
      void navigator.clipboard.writeText(report);
      setCopiedToast(customToast || 'Target kode + komentar disalin ke Clipboard!');
      window.setTimeout(() => {
        setCopiedToast((prev) => (prev ? null : prev));
      }, 2200);
    },
    [buildFormattedAgentReport],
  );

  // Keyboard toggle: Alt + Shift + I, plus track Alt key hold for instant 3D hotspot overlay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltKeyHeld(true);
      }
      if (e.altKey && e.shiftKey && e.code === 'KeyI') {
        e.preventDefault();
        setInspectModeActive((prev) => !prev);
        setHoverBox(null);
      } else if (e.key === 'Escape' && inspectModeActive) {
        setInspectModeActive(false);
        setHoverBox(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltKeyHeld(false);
      }
    };
    const onBlur = () => setAltKeyHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [inspectModeActive]);

  const isOverlayScanningActive = inspectModeActive || altKeyHeld;

  // Live 3D & DOM Hover Scanner when Inspect Mode is ON or Alt is held
  useEffect(() => {
    if (!isOverlayScanningActive) {
      setHoverBox(null);
      setLiveHotspots([]);
      return;
    }

    const triggerScanAt = (clientX: number, clientY: number, target: HTMLElement | null) => {
      if (target && target.closest('[data-inspector-ui-root="true"]')) {
        setHoverBox(null);
        return;
      }
      if (!target || target.tagName.toLowerCase() === 'canvas') {
        let picked3D: Picked3DInfo | null = null;
        window.dispatchEvent(
          new CustomEvent('bb-inspect-3d-pick', {
            detail: {
              clientX,
              clientY,
              onResult: (res: Picked3DInfo) => {
                picked3D = res;
              },
            },
          }),
        );
        if (picked3D) {
          const info = picked3D as Picked3DInfo;
          setLiveHotspots(info.hotspots ?? []);
          const sb = info.screenBounds;
          setHoverBox({
            x: sb ? sb.x : clientX - 24,
            y: sb ? sb.y : clientY - 24,
            w: sb ? sb.w : 48,
            h: sb ? sb.h : 48,
            label: `[3D] ${info.meshName} · Bone: ${info.nearestBoneName}`,
            is3D: true,
          });
        }
        return;
      }

      const domInfo = extractDomElementTargetInfo(target);
      setHoverBox({
        x: domInfo.rect.x,
        y: domInfo.rect.y,
        w: domInfo.rect.w,
        h: domInfo.rect.h,
        label: `[UI] ${domInfo.summaryLabel} → ${domInfo.sourceFileHint}`,
        is3D: false,
      });
    };

    // Perform an initial center-screen hotspot scan right when Alt / Inspect Mode activates
    triggerScanAt(window.innerWidth * 0.5, window.innerHeight * 0.5, null);

    const onPointerMove = (e: PointerEvent) => {
      triggerScanAt(e.clientX, e.clientY, e.target as HTMLElement | null);
    };
    window.addEventListener('pointermove', onPointerMove, true);
    return () => window.removeEventListener('pointermove', onPointerMove, true);
  }, [isOverlayScanningActive]);

  const create3DPinAt = useCallback(
    (screenX: number, screenY: number, overrideHotspot?: Hotspot3DNode) => {
      const screenXPct = Number(((screenX / Math.max(1, window.innerWidth)) * 100).toFixed(1));
      const screenYPct = Number(((screenY / Math.max(1, window.innerHeight)) * 100).toFixed(1));
      const newId = Date.now();

      let picked3D: Picked3DInfo | null = null;
      window.dispatchEvent(
        new CustomEvent('bb-inspect-3d-pick', {
          detail: {
            clientX: screenX,
            clientY: screenY,
            onResult: (res: Picked3DInfo) => {
              picked3D = res;
            },
          },
        }),
      );

      const resolved3D: Picked3DInfo = picked3D ?? {
        meshName: overrideHotspot ? overrideHotspot.label : 'Canvas3D',
        hierarchyPath: overrideHotspot ? `PlayerUnit > ${overrideHotspot.id}` : 'Scene',
        hitPointWorld: overrideHotspot ? overrideHotspot.worldPos : null,
        nearestBoneName: 'none',
        nearestBoneDistPx: 0,
        nearestBoneWorld: { x: 0, y: 0, z: 0 },
        nearestBoneLocalRotDeg: { x: 0, y: 0, z: 0 },
        activeWeaponId: 'unknown',
        fishingPhase: 'idle',
        weaponLocalPos: null,
        weaponLocalRotDeg: null,
        rodFlexPivotRotXDeg: null,
        suggestedSourceFile: overrideHotspot
          ? overrideHotspot.sourceFile
          : 'src/game/BuddiesBlitzArena.tsx',
      };

      if (overrideHotspot) {
        resolved3D.meshName = overrideHotspot.label;
        resolved3D.hierarchyPath = `PlayerUnit > ${overrideHotspot.id}`;
        resolved3D.hitPointWorld = overrideHotspot.worldPos;
        resolved3D.suggestedSourceFile = overrideHotspot.sourceFile;
      }

      const pinItem: InspectorPinItem = {
        id: newId,
        screenX,
        screenY,
        screenXPct,
        screenYPct,
        targetKind: '3D_BONE_AND_MESH',
        summaryLabel: `${resolved3D.meshName}`,
        sourceFileHint: resolved3D.suggestedSourceFile,
        threeInfo: resolved3D,
        comment: '',
      };

      setPins((prev) => {
        const next = [...prev, pinItem];
        copyReportToClipboard(next, 'Target 3D disalin! Ketik komentar lalu tekan Enter.');
        return next;
      });
      setActivePinId(newId);
      window.setTimeout(() => commentInputRef.current?.focus(), 30);
    },
    [copyReportToClipboard],
  );

  // Intercept Click when inspectModeActive OR when Alt + Click is used anywhere
  useEffect(() => {
    const onPointerDownCapture = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-inspector-ui-root="true"]')) {
        return;
      }

      const isQuickAltClick = e.altKey && e.button === 0;
      if (!inspectModeActive && !isQuickAltClick) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const screenX = e.clientX;
      const screenY = e.clientY;

      if (target.tagName.toLowerCase() === 'canvas') {
        create3DPinAt(screenX, screenY);
        return;
      }

      const screenXPct = Number(((screenX / Math.max(1, window.innerWidth)) * 100).toFixed(1));
      const screenYPct = Number(((screenY / Math.max(1, window.innerHeight)) * 100).toFixed(1));
      const newId = Date.now();
      const domInfo = extractDomElementTargetInfo(target);
      const pinItem: InspectorPinItem = {
        id: newId,
        screenX,
        screenY,
        screenXPct,
        screenYPct,
        targetKind: 'UI_DOM',
        summaryLabel: domInfo.summaryLabel,
        sourceFileHint: domInfo.sourceFileHint,
        domSelector: domInfo.domSelector,
        domDataAttrs: domInfo.domDataAttrs,
        domTextSnippet: domInfo.domTextSnippet,
        domRect: domInfo.rect,
        comment: '',
      };

      setPins((prev) => {
        const next = [...prev, pinItem];
        copyReportToClipboard(next, 'Selector UI disalin! Ketik komentar lalu tekan Enter.');
        return next;
      });
      setActivePinId(newId);
      window.setTimeout(() => commentInputRef.current?.focus(), 30);
    };

    window.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => window.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [copyReportToClipboard, create3DPinAt, inspectModeActive]);

  const activePin = pins.find((p) => p.id === activePinId) ?? pins[pins.length - 1] ?? null;

  return (
    <div data-inspector-ui-root="true" className="pointer-events-none fixed inset-0 z-[9999]">
      {/* 1. Hover Bounding Box (Works for BOTH UI DOM Elements AND 3D Scene Objects!) */}
      {isOverlayScanningActive && hoverBox && (
        <div
          style={{
            left: `${hoverBox.x}px`,
            top: `${hoverBox.y}px`,
            width: `${Math.max(28, hoverBox.w)}px`,
            height: `${Math.max(28, hoverBox.h)}px`,
          }}
          className={`fixed border-2 rounded pointer-events-none transition-all duration-75 ${
            hoverBox.is3D
              ? 'border-[#b8ff3c] bg-[#b8ff3c]/10 shadow-[0_0_16px_rgba(184,255,60,0.35)]'
              : 'border-[#38bdf8] bg-[#38bdf8]/15'
          }`}
        >
          <div
            className={`absolute -top-6 left-0 px-2 py-0.5 rounded bg-slate-950/95 border text-[10px] font-mono font-bold whitespace-nowrap shadow ${
              hoverBox.is3D
                ? 'text-[#b8ff3c] border-[#b8ff3c]/60'
                : 'text-[#38bdf8] border-[#38bdf8]/50'
            }`}
          >
            {hoverBox.label}
          </div>
        </div>
      )}

      {/* 2. Clickable 3D Skeleton Bone & Weapon/Rod Hotspot Badges (Shown whenever Alt is held or Inspector is ON) */}
      {isOverlayScanningActive &&
        liveHotspots.map((hs) => {
          const isWeapon = hs.category === 'WEAPON_PART';
          return (
            <button
              key={hs.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                create3DPinAt(hs.screenX, hs.screenY, hs);
              }}
              style={{
                left: `${hs.screenX}px`,
                top: `${hs.screenY}px`,
              }}
              className={`pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full text-[9.5px] font-mono font-black border shadow-md cursor-pointer transition-transform hover:scale-110 flex items-center gap-1 ${
                isWeapon
                  ? 'bg-amber-400/95 text-black border-black z-20'
                  : 'bg-sky-950/90 text-sky-200 border-sky-400/80 z-10'
              }`}
              title={`Klik untuk pilih 3D Node: ${hs.label}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isWeapon ? 'bg-black' : 'bg-sky-300'
                }`}
              />
              <span>{hs.label.replace(/^Bone:\s*mixamorig/i, 'Bone:')}</span>
            </button>
          );
        })}

      {/* 3. Dropped Numbered Pins on Screen */}
      {pins.map((pin, index) => {
        const num = index + 1;
        const isSelected = activePin?.id === pin.id;
        return (
          <button
            key={pin.id}
            type="button"
            onClick={() => {
              setActivePinId(pin.id);
              window.setTimeout(() => commentInputRef.current?.focus(), 20);
            }}
            style={{
              left: `${pin.screenX}px`,
              top: `${pin.screenY}px`,
            }}
            className={`pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full font-black text-xs flex items-center justify-center border-2 shadow-lg cursor-pointer transition-transform z-30 ${
              isSelected
                ? 'bg-[#b8ff3c] text-black border-black scale-110'
                : 'bg-[#38bdf8] text-black border-black hover:scale-105'
            }`}
            title={pin.summaryLabel}
          >
            {num}
          </button>
        );
      })}

      {/* 4. Floating Comment & Live 3D Tuner Card */}
      {activePin && (
        <div className="pointer-events-auto fixed bottom-14 right-3 w-[370px] max-w-[94vw] rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-white/20 p-3.5 text-white shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-[#b8ff3c] text-black font-black text-[10px] uppercase shrink-0">
                Pin #{pins.findIndex((p) => p.id === activePin.id) + 1} ·{' '}
                {activePin.targetKind === '3D_BONE_AND_MESH' ? '3D OBJECT' : 'UI DOM'}
              </span>
              <span className="text-[11px] font-mono text-sky-300 truncate">
                {activePin.summaryLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPins([]);
                setActivePinId(null);
              }}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-red-500/30 text-[10px] font-bold text-slate-300 hover:text-red-200 cursor-pointer shrink-0"
            >
              Reset ({pins.length})
            </button>
          </div>

          <div className="text-[10.5px] font-mono text-slate-300 bg-black/45 rounded-lg p-2 border border-white/10 space-y-0.5">
            <div className="truncate text-emerald-300">File: {activePin.sourceFileHint}</div>
            {activePin.targetKind === '3D_BONE_AND_MESH' && activePin.threeInfo ? (
              <>
                <div className="truncate">
                  3D Target: <b className="text-amber-300">{activePin.threeInfo.meshName}</b>
                </div>
                <div className="truncate">
                  Bone Terdekat: <b className="text-sky-300">{activePin.threeInfo.nearestBoneName}</b> (
                  {activePin.threeInfo.nearestBoneDistPx}px)
                </div>
                {activePin.threeInfo.hitPointWorld && (
                  <div className="truncate text-slate-400">
                    World XYZ: [{activePin.threeInfo.hitPointWorld.x},{' '}
                    {activePin.threeInfo.hitPointWorld.y}, {activePin.threeInfo.hitPointWorld.z}]
                    {activePin.threeInfo.screenBounds
                      ? ` · Size: ${activePin.threeInfo.screenBounds.sizeMeters.w}x${activePin.threeInfo.screenBounds.sizeMeters.h}x${activePin.threeInfo.screenBounds.sizeMeters.d}m`
                      : ''}
                  </div>
                )}
                {activePin.threeInfo.weaponLocalPos && activePin.threeInfo.weaponLocalRotDeg && (
                  <div className="truncate text-slate-300">
                    Weapon Pos: [{activePin.threeInfo.weaponLocalPos.x},{' '}
                    {activePin.threeInfo.weaponLocalPos.y}, {activePin.threeInfo.weaponLocalPos.z}] ·
                    Rot: [{activePin.threeInfo.weaponLocalRotDeg.x}°,{' '}
                    {activePin.threeInfo.weaponLocalRotDeg.y}°,{' '}
                    {activePin.threeInfo.weaponLocalRotDeg.z}°]
                  </div>
                )}
              </>
            ) : (
              <div className="truncate">
                Selector: <b className="text-amber-300">{activePin.domSelector}</b>
              </div>
            )}
          </div>

          {/* Live 3D World Object Scale + Weapon / Rod Offset Sliders when inspecting a 3D target */}
          {activePin.targetKind === '3D_BONE_AND_MESH' && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/10 text-[10px] font-mono">
                <span className="text-amber-300 font-bold">
                  Skala 3D Object: {worldObjectScale.toFixed(2)}x
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.25"
                    max="2.5"
                    step="0.02"
                    value={worldObjectScale}
                    onChange={(e) => applyLiveWorldObjectScale(Number(e.target.value))}
                    className="w-28 accent-amber-400 cursor-pointer"
                  />
                  {Math.abs(worldObjectScale - 1) > 0.005 && (
                    <button
                      type="button"
                      onClick={() => applyLiveWorldObjectScale(1)}
                      className="text-[9.5px] text-red-300 hover:underline cursor-pointer"
                    >
                      1.0x
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowLiveTuner((prev) => !prev)}
                  className="text-[10.5px] font-bold text-[#b8ff3c] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>{showLiveTuner ? '▼' : '▶'} Live 3D Weapon / Joran Tuner (Geser Real-Time)</span>
                </button>
                {hasNonZeroTweak && (
                  <button
                    type="button"
                    onClick={() =>
                      applyLiveWeaponTweak(
                        { dx: 0, dy: 0, dz: 0, dpitchDeg: 0, dyawDeg: 0, drollDeg: 0 },
                        true,
                      )
                    }
                    className="text-[9.5px] text-red-300 hover:underline cursor-pointer"
                  >
                    Reset Geser
                  </button>
                )}
              </div>

              {showLiveTuner && (
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 pt-1 text-[10px] font-mono">
                  <label className="flex flex-col">
                    <span className="text-slate-300">Pos ΔX ({weaponTweak.dx.toFixed(2)}m)</span>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.01"
                      value={weaponTweak.dx}
                      onChange={(e) =>
                        applyLiveWeaponTweak({ ...weaponTweak, dx: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-slate-300">Pos ΔY ({weaponTweak.dy.toFixed(2)}m)</span>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.01"
                      value={weaponTweak.dy}
                      onChange={(e) =>
                        applyLiveWeaponTweak({ ...weaponTweak, dy: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-slate-300">Pos ΔZ ({weaponTweak.dz.toFixed(2)}m)</span>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.01"
                      value={weaponTweak.dz}
                      onChange={(e) =>
                        applyLiveWeaponTweak({ ...weaponTweak, dz: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-slate-300">Pitch ΔX ({weaponTweak.dpitchDeg}°)</span>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      step="1"
                      value={weaponTweak.dpitchDeg}
                      onChange={(e) =>
                        applyLiveWeaponTweak({ ...weaponTweak, dpitchDeg: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-slate-300">Yaw ΔY ({weaponTweak.dyawDeg}°)</span>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      step="1"
                      value={weaponTweak.dyawDeg}
                      onChange={(e) =>
                        applyLiveWeaponTweak({ ...weaponTweak, dyawDeg: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-slate-300">Roll ΔZ ({weaponTweak.drollDeg}°)</span>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      step="1"
                      value={weaponTweak.drollDeg}
                      onChange={(e) =>
                        applyLiveWeaponTweak({ ...weaponTweak, drollDeg: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <input
              ref={commentInputRef}
              type="text"
              value={activePin.comment}
              onChange={(e) => {
                const val = e.target.value;
                setPins((prev) =>
                  prev.map((p) => (p.id === activePin.id ? { ...p, comment: val } : p)),
                );
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  copyReportToClipboard(
                    pins,
                    'Disalin ke Clipboard! Tinggal Paste (⌘V) ke chat Antigravity.',
                  );
                }
              }}
              placeholder="Tulis komentar revisi lalu tekan Enter..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#b8ff3c]"
            />
            <button
              type="button"
              onClick={() =>
                copyReportToClipboard(
                  pins,
                  'Disalin ke Clipboard! Tinggal Paste (⌘V) ke chat Antigravity.',
                )
              }
              className="px-3 py-1.5 rounded-lg bg-[#b8ff3c] hover:bg-[#d9f99d] text-black font-black text-[11px] uppercase cursor-pointer shrink-0"
            >
              Copy
            </button>
          </div>

          {copiedToast && (
            <div className="text-[10.5px] font-bold text-[#b8ff3c]">{copiedToast}</div>
          )}
        </div>
      )}

      {/* 5. Compact Bottom-Right Toggle Pill */}
      <div className="pointer-events-auto fixed bottom-3 right-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setInspectModeActive((prev) => !prev)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border backdrop-blur-md shadow-lg cursor-pointer transition-all flex items-center gap-1.5 ${
            isOverlayScanningActive
              ? 'bg-[#b8ff3c] text-black border-black shadow-[0_0_16px_rgba(184,255,60,0.6)]'
              : 'bg-slate-950/75 hover:bg-slate-900/90 text-slate-200 border-white/20'
          }`}
          title="Tahan Alt untuk menampilkan titik 3D Bone/Weapon, atau klik tombol ini untuk kunci mode Inspector"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOverlayScanningActive ? 'bg-black animate-ping' : 'bg-[#38bdf8]'
            }`}
          />
          <span>
            {inspectModeActive
              ? 'INSPECTOR ON (3D & UI)'
              : altKeyHeld
                ? '3D HOTSPOTS READY (Klik Titik)'
                : 'INSPECT [Tahan Alt / Klik]'}
          </span>
        </button>
      </div>
    </div>
  );
};
