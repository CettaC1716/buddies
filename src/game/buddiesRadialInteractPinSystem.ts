import { soundEngine } from './audio';

export type RadialPinIconKind =
  | 'player'
  | 'npc'
  | 'merchant'
  | 'chair'
  | 'stand_up'
  | 'bed'
  | 'door_enter'
  | 'door_exit'
  | 'shop_scooter'
  | 'shop_fashion'
  | 'shop_estate'
  | 'house_plot'
  | 'transit'
  | 'tram'
  | 'cafe_coffee'
  | 'work_shift'
  | 'atm'
  | 'casino_game';

export type RadialPinAccentKind = 'amber' | 'rose' | 'emerald' | 'sky';

export interface RadialInteractPinDescriptor {
  id: string;
  screenX: number;
  screenY: number;
  inRange: boolean;
  /** Lower distance = higher priority for keyboard [E] hold & overlap sorting */
  distance: number;
  /** Optional priority override (higher wins for keyboard [E] hold, e.g. stand_up/exit) */
  priority?: number;
  icon: RadialPinIconKind;
  label: string;
  accent?: RadialPinAccentKind;
  onTrigger: () => void;
}

export interface RadialPinScreenAnchor {
  screenX: number;
  screenY: number;
  inRange: boolean;
  accent: RadialPinAccentKind;
}

const livePinScreenAnchors = new Map<string, RadialPinScreenAnchor>();

export function getRadialPinScreenAnchor(pinId: string): RadialPinScreenAnchor | null {
  return livePinScreenAnchors.get(pinId) ?? null;
}

export const RADIAL_HOLD_DURATION_MS = 480;
const RADIAL_DRAG_CANCEL_PX = 10;
const RING_RADIUS = 19.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const ACCENT_PALETTES: Record<
  RadialPinAccentKind,
  {
    orbBg: string;
    ringColor: string;
    stemColor: string;
    iconInk: string;
    glowRgba: string;
  }
> = {
  amber: {
    orbBg: '#ff9800',
    ringColor: '#ff9f1c',
    stemColor: '#ff9800',
    iconInk: '#17120a',
    glowRgba: 'rgba(255, 152, 0, 0.55)',
  },
  rose: {
    orbBg: '#fb7185',
    ringColor: '#fda4af',
    stemColor: '#fb7185',
    iconInk: '#1b0b10',
    glowRgba: 'rgba(251, 113, 133, 0.52)',
  },
  emerald: {
    orbBg: '#34d399',
    ringColor: '#6ee7b7',
    stemColor: '#34d399',
    iconInk: '#062018',
    glowRgba: 'rgba(52, 211, 153, 0.5)',
  },
  sky: {
    orbBg: '#38bdf8',
    ringColor: '#7dd3fc',
    stemColor: '#38bdf8',
    iconInk: '#081a28',
    glowRgba: 'rgba(56, 189, 248, 0.5)',
  },
};

function getCenterIconSvgInner(icon: RadialPinIconKind): string {
  switch (icon) {
    case 'player':
      return `<circle cx="12" cy="8" r="3.4" fill="currentColor" stroke="none"/><path d="M5.6 19.2c0-3.2 2.9-5.4 6.4-5.4s6.4 2.2 6.4 5.4" fill="currentColor" stroke="none"/>`;
    case 'npc':
      return `<circle cx="9.2" cy="8.2" r="2.7" fill="currentColor" stroke="none"/><path d="M4.2 18.6c0-2.6 2.2-4.4 5-4.4s5 1.8 5 4.4" fill="currentColor" stroke="none"/><circle cx="16.4" cy="9.2" r="2.1" fill="currentColor" stroke="none"/><path d="M14.3 18.6h5.5c-.1-2-1.5-3.4-3.6-3.4-.8 0-1.4.2-1.9.5" fill="currentColor" stroke="none"/>`;
    case 'merchant':
      return `<path d="M4 9.5 5.4 5h13.2L20 9.5a2.3 2.3 0 0 1-4.2 1.2 2.3 2.3 0 0 1-3.8 0 2.3 2.3 0 0 1-3.8 0A2.3 2.3 0 0 1 4 9.5Z"/><path d="M6 12.2V19h12v-6.8"/><path d="M10 19v-4.2h4V19"/>`;
    case 'chair':
      return `<path d="M7 5.5v7.5h10V5.5" stroke-width="2.3"/><path d="M5.5 13h13v2.5h-13z" fill="currentColor" stroke="none"/><path d="M7.5 15.5V20M16.5 15.5V20" stroke-width="2.3"/>`;
    case 'stand_up':
      return `<path d="M12 18.5V6.5" stroke-width="2.4"/><path d="m7.2 11.2 4.8-5 4.8 5" stroke-width="2.4"/><path d="M6.5 20h11" stroke-width="2.2"/>`;
    case 'bed':
      return `<path d="M3.5 18.5V8.5" stroke-width="2.3"/><path d="M3.5 14h17v4.5" stroke-width="2.3"/><path d="M3.5 11.5h6.5a2 2 0 0 1 2 2V14" stroke-width="2.1"/><circle cx="7.4" cy="9.2" r="1.4" fill="currentColor" stroke="none"/><path d="M12 11.2h6.5a2 2 0 0 1 2 2V14" stroke-width="2.1"/>`;
    case 'door_enter':
      return `<path d="M11 4.5h7.5v15H11" stroke-width="2.2"/><path d="M4.5 12h9.5" stroke-width="2.3"/><path d="m10.8 8.5 3.6 3.5-3.6 3.5" stroke-width="2.3"/>`;
    case 'door_exit':
      return `<path d="M13 4.5H5.5v15H13" stroke-width="2.2"/><path d="M10 12h9.5" stroke-width="2.3"/><path d="m16.2 8.5 3.6 3.5-3.6 3.5" stroke-width="2.3"/>`;
    case 'shop_scooter':
      return `<circle cx="6.5" cy="16.5" r="2.6" stroke-width="2.1"/><circle cx="17.5" cy="16.5" r="2.6" stroke-width="2.1"/><path d="M9.1 16.5h4.4l2.1-6.5h-2.6" stroke-width="2.1"/><path d="M14.2 7.5h3.2" stroke-width="2.2"/>`;
    case 'shop_fashion':
      return `<path d="m8.2 5.2 3.8 1.8 3.8-1.8 3.5 2.6-1.8 3.6-2-.9V19h-7v-8.5l-2 .9-1.8-3.6Z" stroke-width="2"/>`;
    case 'shop_estate':
      return `<path d="M4.5 19.5V8.5L12 4.5l7.5 4v11Z" stroke-width="2.1"/><path d="M9.5 19.5v-5h5v5" stroke-width="2.1"/><circle cx="12" cy="9.6" r="1.2" fill="currentColor" stroke="none"/>`;
    case 'house_plot':
      return `<path d="m4 11 8-6.5 8 6.5" stroke-width="2.3"/><path d="M6.2 10.2V19h11.6v-8.8" stroke-width="2.1"/><path d="M10 19v-4.8h4V19" stroke-width="2"/>`;
    case 'transit':
      return `<path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" stroke-width="2.1"/><circle cx="12" cy="10" r="2.1" fill="currentColor" stroke="none"/>`;
    case 'tram':
      return `<rect x="5.5" y="4.5" width="13" height="12" rx="2.4" stroke-width="2.1"/><path d="M5.5 11h13" stroke-width="2"/><circle cx="9" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.1" fill="currentColor" stroke="none"/><path d="m8.5 19.5 1.8-3M15.5 19.5l-1.8-3" stroke-width="2.1"/>`;
    case 'cafe_coffee':
      return `<path d="M4.5 9.5h11.5v5a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5Z" stroke-width="2.1"/><path d="M16 10.5h1.5a2.3 2.3 0 0 1 0 4.6H16" stroke-width="2.1"/><path d="M8 5.2v2M11.8 5.2v2" stroke-width="2"/>`;
    case 'work_shift':
      return `<rect x="5.5" y="5" width="13" height="14.5" rx="2" stroke-width="2.1"/><path d="M9 5V3.8h6V5" stroke-width="2"/><path d="M8.8 10.5h6.4M8.8 14.5h4.2" stroke-width="2.1"/>`;
    case 'atm':
      return `<rect x="3.5" y="6" width="17" height="12" rx="2.2" stroke-width="2.1"/><path d="M3.5 10.5h17" stroke-width="2.2"/><path d="M7.5 14.5h3.5" stroke-width="2.2"/>`;
    case 'casino_game':
      return `<rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke-width="2.1"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/>`;
  }
}

interface PooledPinNode {
  root: HTMLButtonElement;
  ringTrack: SVGCircleElement;
  ringProgress: SVGCircleElement;
  orbDisc: SVGCircleElement;
  iconSvg: SVGSVGElement;
  stemEl: HTMLSpanElement;
  labelEl: HTMLSpanElement;
  inUse: boolean;
  pinId: string;
  lastTransform: string;
  lastInRange: boolean | null;
  lastIcon: RadialPinIconKind | null;
  lastAccent: RadialPinAccentKind | null;
  lastLabel: string;
  lastProgressBucket: number;
  lastHolding: boolean;
  lastHovered: boolean;
  lastPrimary: boolean;
  lastBurst: boolean;
}

export class RadialInteractPinManager {
  private readonly container: HTMLDivElement;
  private readonly onCancelMovement?: () => void;
  private readonly pool: PooledPinNode[] = [];
  private readonly activeNodeById = new Map<string, PooledPinNode>();
  private readonly activeDescById = new Map<string, RadialInteractPinDescriptor>();

  private activeHold: {
    pinId: string;
    source: 'pointer' | 'keyE';
    pointerId: number | null;
    startX: number;
    startY: number;
    startedAtMs: number;
    completed: boolean;
  } | null = null;

  private keyEHeld = false;
  private keyEConsumed = false;
  private primaryInRangePinId: string | null = null;
  private burstPinId: string | null = null;
  private burstUntilMs = 0;

  private readonly handleWindowPointerMove = (e: PointerEvent) => {
    if (
      !this.activeHold ||
      this.activeHold.source !== 'pointer' ||
      this.activeHold.pointerId !== e.pointerId
    ) {
      return;
    }
    const dist = Math.hypot(
      e.clientX - this.activeHold.startX,
      e.clientY - this.activeHold.startY,
    );
    if (dist > RADIAL_DRAG_CANCEL_PX) {
      this.activeHold = null;
    }
  };

  private readonly handleWindowPointerUp = (e: PointerEvent) => {
    if (
      this.activeHold &&
      this.activeHold.source === 'pointer' &&
      this.activeHold.pointerId === e.pointerId
    ) {
      this.activeHold = null;
    }
  };

  private readonly handleWindowBlur = () => {
    this.activeHold = null;
    this.keyEHeld = false;
    this.keyEConsumed = false;
  };

  constructor(hostOverlay: HTMLElement, onCancelMovement?: () => void) {
    this.onCancelMovement = onCancelMovement;
    this.container = document.createElement('div');
    this.container.setAttribute('data-radial-interact-pins-layer', 'true');
    this.container.style.position = 'absolute';
    this.container.style.inset = '0';
    this.container.style.pointerEvents = 'none';
    this.container.style.overflow = 'hidden';
    this.container.style.zIndex = '18';
    hostOverlay.appendChild(this.container);

    window.addEventListener('pointermove', this.handleWindowPointerMove);
    window.addEventListener('pointerup', this.handleWindowPointerUp);
    window.addEventListener('pointercancel', this.handleWindowPointerUp);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  public hasInRangePin(): boolean {
    return this.primaryInRangePinId !== null;
  }

  public isHoldingPin(): boolean {
    return Boolean(this.activeHold && !this.activeHold.completed);
  }

  public setKeyEHeld(held: boolean, nowMs = performance.now()): boolean {
    if (!held) {
      this.keyEHeld = false;
      this.keyEConsumed = false;
      if (this.activeHold?.source === 'keyE') {
        this.activeHold = null;
      }
      return false;
    }

    this.keyEHeld = true;
    if (this.keyEConsumed) {
      return this.primaryInRangePinId !== null;
    }
    if (this.activeHold?.source === 'keyE') {
      return true;
    }
    if (!this.primaryInRangePinId) {
      return false;
    }
    const target = this.activeDescById.get(this.primaryInRangePinId);
    if (!target || !target.inRange) {
      return false;
    }
    this.activeHold = {
      pinId: target.id,
      source: 'keyE',
      pointerId: null,
      startX: 0,
      startY: 0,
      startedAtMs: nowMs,
      completed: false,
    };
    soundEngine.playUiClick();
    return true;
  }

  public cancelActiveHold(): void {
    this.activeHold = null;
  }

  private acquireNode(): PooledPinNode {
    for (const node of this.pool) {
      if (!node.inUse) {
        node.inUse = true;
        node.root.style.display = 'flex';
        return node;
      }
    }

    const root = document.createElement('button');
    root.type = 'button';
    root.tabIndex = -1;
    root.setAttribute('data-radial-interact-pin', 'true');
    root.style.position = 'absolute';
    root.style.left = '0px';
    root.style.top = '0px';
    root.style.margin = '0';
    root.style.padding = '4px';
    root.style.border = 'none';
    root.style.background = 'transparent';
    root.style.outline = 'none';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'flex-end';
    root.style.userSelect = 'none';
    root.style.touchAction = 'none';
    root.style.willChange = 'transform, opacity';
    root.style.cursor = 'pointer';

    const svgNs = 'http://www.w3.org/2000/svg';
    const orbWrap = document.createElement('span');
    orbWrap.style.position = 'relative';
    orbWrap.style.width = '46px';
    orbWrap.style.height = '46px';
    orbWrap.style.display = 'flex';
    orbWrap.style.alignItems = 'center';
    orbWrap.style.justifyContent = 'center';
    orbWrap.style.pointerEvents = 'none';
    orbWrap.style.transition = 'transform 130ms cubic-bezier(0.22, 1, 0.36, 1)';

    const ringSvg = document.createElementNS(svgNs, 'svg');
    ringSvg.setAttribute('viewBox', '0 0 46 46');
    ringSvg.setAttribute('width', '46');
    ringSvg.setAttribute('height', '46');
    ringSvg.style.position = 'absolute';
    ringSvg.style.inset = '0';
    ringSvg.style.overflow = 'visible';

    const ringTrack = document.createElementNS(svgNs, 'circle');
    ringTrack.setAttribute('cx', '23');
    ringTrack.setAttribute('cy', '23');
    ringTrack.setAttribute('r', String(RING_RADIUS));
    ringTrack.setAttribute('fill', 'none');
    ringTrack.setAttribute('stroke-width', '2.4');
    ringTrack.setAttribute('stroke-linecap', 'round');

    const ringProgress = document.createElementNS(svgNs, 'circle');
    ringProgress.setAttribute('cx', '23');
    ringProgress.setAttribute('cy', '23');
    ringProgress.setAttribute('r', String(RING_RADIUS));
    ringProgress.setAttribute('fill', 'none');
    ringProgress.setAttribute('stroke', '#ffffff');
    ringProgress.setAttribute('stroke-width', '3.6');
    ringProgress.setAttribute('stroke-linecap', 'round');
    ringProgress.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));
    ringProgress.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));
    ringProgress.setAttribute('transform', 'rotate(-90 23 23)');

    const orbDisc = document.createElementNS(svgNs, 'circle');
    orbDisc.setAttribute('cx', '23');
    orbDisc.setAttribute('cy', '23');
    orbDisc.setAttribute('r', '13.4');

    ringSvg.appendChild(ringTrack);
    ringSvg.appendChild(ringProgress);
    ringSvg.appendChild(orbDisc);

    const iconSvg = document.createElementNS(svgNs, 'svg');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('width', '15');
    iconSvg.setAttribute('height', '15');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.setAttribute('stroke', 'currentColor');
    iconSvg.setAttribute('stroke-width', '2.1');
    iconSvg.setAttribute('stroke-linecap', 'round');
    iconSvg.setAttribute('stroke-linejoin', 'round');
    iconSvg.style.position = 'relative';
    iconSvg.style.zIndex = '1';

    orbWrap.appendChild(ringSvg);
    orbWrap.appendChild(iconSvg);

    const stemEl = document.createElement('span');
    stemEl.style.display = 'block';
    stemEl.style.width = '2.2px';
    stemEl.style.height = '24px';
    stemEl.style.marginTop = '-1px';
    stemEl.style.borderRadius = '9999px';
    stemEl.style.pointerEvents = 'none';

    const labelEl = document.createElement('span');
    labelEl.style.position = 'absolute';
    labelEl.style.bottom = '100%';
    labelEl.style.left = '50%';
    labelEl.style.transform = 'translate(-50%, -2px)';
    labelEl.style.padding = '3px 8px';
    labelEl.style.borderRadius = '9999px';
    labelEl.style.background = 'rgba(15, 20, 32, 0.90)';
    labelEl.style.border = '1px solid rgba(255, 255, 255, 0.22)';
    labelEl.style.color = '#ffffff';
    labelEl.style.fontFamily = "'Plus Jakarta Sans', 'Inter', sans-serif";
    labelEl.style.fontSize = '10.5px';
    labelEl.style.fontWeight = '600';
    labelEl.style.lineHeight = '1.2';
    labelEl.style.letterSpacing = '0.01em';
    labelEl.style.whiteSpace = 'nowrap';
    labelEl.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.38)';
    labelEl.style.pointerEvents = 'none';
    labelEl.style.opacity = '0';
    labelEl.style.transition = 'opacity 140ms ease';

    root.appendChild(labelEl);
    root.appendChild(orbWrap);
    root.appendChild(stemEl);

    const node: PooledPinNode = {
      root,
      ringTrack,
      ringProgress,
      orbDisc,
      iconSvg,
      stemEl,
      labelEl,
      inUse: true,
      pinId: '',
      lastTransform: '',
      lastInRange: null,
      lastIcon: null,
      lastAccent: null,
      lastLabel: '',
      lastProgressBucket: -1,
      lastHolding: false,
      lastHovered: false,
      lastPrimary: false,
      lastBurst: false,
    };

    root.onpointerenter = () => {
      node.lastHovered = true;
    };
    root.onpointerleave = () => {
      node.lastHovered = false;
    };
    root.onpointerdown = (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const desc = this.activeDescById.get(node.pinId);
      if (!desc || !desc.inRange) return;
      e.stopPropagation();
      this.onCancelMovement?.();
      this.activeHold = {
        pinId: desc.id,
        source: 'pointer',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startedAtMs: performance.now(),
        completed: false,
      };
      soundEngine.playUiClick();
    };
    root.onclick = (e) => {
      // Prevent accidental single-click propagation; interaction happens ONLY on hold completion
      e.stopPropagation();
      e.preventDefault();
    };

    this.container.appendChild(root);
    this.pool.push(node);
    return node;
  }

  public syncPins(pins: readonly RadialInteractPinDescriptor[], nowMs = performance.now()): void {
    this.activeDescById.clear();
    livePinScreenAnchors.clear();

    // Pick primary nearest in-range pin (for keyboard [E] hold & subtle label visibility)
    let bestPrimary: RadialInteractPinDescriptor | null = null;
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      this.activeDescById.set(p.id, p);
      livePinScreenAnchors.set(p.id, {
        screenX: p.screenX,
        screenY: p.screenY,
        inRange: p.inRange,
        accent: p.accent ?? 'amber',
      });
      if (!p.inRange) continue;
      if (!bestPrimary) {
        bestPrimary = p;
      } else {
        const prioA = p.priority ?? 0;
        const prioB = bestPrimary.priority ?? 0;
        if (prioA > prioB || (prioA === prioB && p.distance < bestPrimary.distance)) {
          bestPrimary = p;
        }
      }
    }
    this.primaryInRangePinId = bestPrimary?.id ?? null;

    // Validate ongoing hold
    let triggeredDescriptor: RadialInteractPinDescriptor | null = null;
    if (this.activeHold) {
      const heldDesc = this.activeDescById.get(this.activeHold.pinId);
      if (!heldDesc || !heldDesc.inRange) {
        this.activeHold = null;
      } else if (!this.activeHold.completed) {
        const elapsed = nowMs - this.activeHold.startedAtMs;
        if (elapsed >= RADIAL_HOLD_DURATION_MS) {
          this.activeHold.completed = true;
          if (this.activeHold.source === 'keyE') {
            this.keyEConsumed = true;
          }
          this.burstPinId = heldDesc.id;
          this.burstUntilMs = nowMs + 240;
          triggeredDescriptor = heldDesc;
        }
      }
    }

    // If keyE is still held without activeHold and not consumed, start holding primary in-range pin
    if (this.keyEHeld && !this.keyEConsumed && !this.activeHold && bestPrimary) {
      this.activeHold = {
        pinId: bestPrimary.id,
        source: 'keyE',
        pointerId: null,
        startX: 0,
        startY: 0,
        startedAtMs: nowMs,
        completed: false,
      };
      soundEngine.playUiClick();
    }

    // Release unused nodes
    for (const [id, node] of this.activeNodeById.entries()) {
      if (!this.activeDescById.has(id)) {
        node.inUse = false;
        node.pinId = '';
        node.lastHovered = false;
        node.root.style.display = 'none';
        this.activeNodeById.delete(id);
      }
    }

    // Update or allocate nodes for current frame's visible pins
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      let node = this.activeNodeById.get(pin.id);
      if (!node) {
        node = this.acquireNode();
        node.pinId = pin.id;
        node.root.setAttribute('data-radial-pin-id', pin.id);
        this.activeNodeById.set(pin.id, node);
      }

      const isHoldingThis =
        Boolean(this.activeHold) &&
        this.activeHold!.pinId === pin.id &&
        !this.activeHold!.completed;
      const isBursting = this.burstPinId === pin.id && nowMs < this.burstUntilMs;
      const isPrimary = pin.id === this.primaryInRangePinId;
      const accent: RadialPinAccentKind = pin.accent ?? 'amber';
      const palette = ACCENT_PALETTES[accent];

      const progress = isBursting
        ? 1
        : isHoldingThis
          ? Math.max(0, Math.min(1, (nowMs - this.activeHold!.startedAtMs) / RADIAL_HOLD_DURATION_MS))
          : 0;

      const scale = isBursting
        ? 1.18
        : isHoldingThis
          ? 1.08 + progress * 0.06
          : pin.inRange
            ? node.lastHovered
              ? 1.06
              : 1.0
            : 0.72;

      const rx = Math.round(pin.screenX * 2) * 0.5;
      const ry = Math.round(pin.screenY * 2) * 0.5;
      const transformStr = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      if (node.lastTransform !== transformStr) {
        node.lastTransform = transformStr;
        node.root.style.transform = transformStr;
      }

      // Layer ordering: holding/primary in-range pins on top of far preview pins
      const zIdx = isHoldingThis ? '30' : isPrimary ? '22' : pin.inRange ? '16' : '6';
      if (node.root.style.zIndex !== zIdx) {
        node.root.style.zIndex = zIdx;
      }

      if (
        node.lastInRange !== pin.inRange ||
        node.lastAccent !== accent ||
        node.lastHolding !== isHoldingThis ||
        node.lastBurst !== isBursting
      ) {
        node.lastInRange = pin.inRange;
        node.lastAccent = accent;
        node.lastHolding = isHoldingThis;
        node.lastBurst = isBursting;

        node.root.style.pointerEvents = pin.inRange ? 'auto' : 'none';
        node.root.style.opacity = pin.inRange ? '1' : '0.62';
        node.root.setAttribute('data-in-range', pin.inRange ? 'true' : 'false');

        if (pin.inRange) {
          node.orbDisc.setAttribute('fill', palette.orbBg);
          node.orbDisc.setAttribute('stroke', 'rgba(255,255,255,0.28)');
          node.orbDisc.setAttribute('stroke-width', '1');
          node.ringTrack.setAttribute('stroke', palette.ringColor);
          node.ringTrack.setAttribute(
            'stroke-opacity',
            isHoldingThis ? '0.45' : '0.92',
          );
          // Slight stylish arc gap on idle ring (matching inZOI radial ring silhouette)
          node.ringTrack.setAttribute(
            'stroke-dasharray',
            isHoldingThis ? 'none' : `${(RING_CIRCUMFERENCE * 0.86).toFixed(1)} ${(RING_CIRCUMFERENCE * 0.14).toFixed(1)}`,
          );
          node.ringTrack.setAttribute('transform', 'rotate(-70 23 23)');
          node.iconSvg.style.color = palette.iconInk;
          node.stemEl.style.height = '24px';
          node.stemEl.style.background = `linear-gradient(to bottom, ${palette.stemColor}, ${palette.stemColor}dd 75%, transparent)`;
          node.root.style.filter = isHoldingThis || isBursting
            ? `drop-shadow(0 0 10px ${palette.glowRgba})`
            : `drop-shadow(0 3px 8px rgba(0,0,0,0.42))`;
        } else {
          node.orbDisc.setAttribute('fill', 'rgba(18, 24, 38, 0.72)');
          node.orbDisc.setAttribute('stroke', 'rgba(255, 255, 255, 0.45)');
          node.orbDisc.setAttribute('stroke-width', '1.2');
          node.ringTrack.setAttribute('stroke', 'rgba(255, 255, 255, 0.55)');
          node.ringTrack.setAttribute('stroke-opacity', '0.6');
          node.ringTrack.setAttribute(
            'stroke-dasharray',
            `${(RING_CIRCUMFERENCE * 0.78).toFixed(1)} ${(RING_CIRCUMFERENCE * 0.22).toFixed(1)}`,
          );
          node.ringTrack.setAttribute('transform', 'rotate(-65 23 23)');
          node.iconSvg.style.color = 'rgba(255, 255, 255, 0.92)';
          node.stemEl.style.height = '18px';
          node.stemEl.style.background =
            'linear-gradient(to bottom, rgba(255,255,255,0.68), rgba(255,255,255,0.22) 78%, transparent)';
          node.root.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,0.32))';
        }
      }

      if (node.lastIcon !== pin.icon) {
        node.lastIcon = pin.icon;
        node.iconSvg.innerHTML = getCenterIconSvgInner(pin.icon);
      }

      const progressBucket = Math.round(progress * 100);
      if (node.lastProgressBucket !== progressBucket) {
        node.lastProgressBucket = progressBucket;
        const offset = RING_CIRCUMFERENCE * (1 - progress);
        node.ringProgress.setAttribute('stroke-dashoffset', offset.toFixed(2));
        node.ringProgress.setAttribute('stroke-opacity', progress > 0.01 ? '1' : '0');
      }

      const displayLabel = isHoldingThis ? `Hold · ${pin.label}` : pin.label;
      if (node.lastLabel !== displayLabel) {
        node.lastLabel = displayLabel;
        node.labelEl.textContent = displayLabel;
        node.root.setAttribute('aria-label', `Hold to interact: ${pin.label}`);
        node.root.title = pin.inRange ? `Tekan & tahan: ${pin.label}` : pin.label;
      }

      const showLabel = pin.inRange && (isHoldingThis || node.lastHovered || isPrimary);
      if (node.lastPrimary !== showLabel) {
        node.lastPrimary = showLabel;
        node.labelEl.style.opacity = showLabel ? '1' : '0';
      }
    }

    if (triggeredDescriptor) {
      soundEngine.playUiClick();
      triggeredDescriptor.onTrigger();
    }
  }

  public clearAll(): void {
    this.activeHold = null;
    this.primaryInRangePinId = null;
    this.activeDescById.clear();
    livePinScreenAnchors.clear();
    for (const [, node] of this.activeNodeById.entries()) {
      node.inUse = false;
      node.pinId = '';
      node.lastHovered = false;
      node.root.style.display = 'none';
    }
    this.activeNodeById.clear();
  }

  public dispose(): void {
    window.removeEventListener('pointermove', this.handleWindowPointerMove);
    window.removeEventListener('pointerup', this.handleWindowPointerUp);
    window.removeEventListener('pointercancel', this.handleWindowPointerUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.clearAll();
    this.container.remove();
  }
}
