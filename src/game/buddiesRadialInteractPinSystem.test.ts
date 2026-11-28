import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RADIAL_HOLD_DURATION_MS,
  RadialInteractPinManager,
  resolveCharacterSelectedDockState,
} from './buddiesRadialInteractPinSystem';

interface MockListenerMap {
  [event: string]: Array<(e: unknown) => void>;
}

interface MockElement {
  tagName: string;
  type: string;
  tabIndex: number;
  title: string;
  textContent: string;
  innerHTML: string;
  style: Record<string, string>;
  children: MockElement[];
  onpointerenter: ((e: unknown) => void) | null;
  onpointerleave: ((e: unknown) => void) | null;
  onpointerdown: ((e: unknown) => void) | null;
  onclick: ((e: unknown) => void) | null;
  setAttribute(key: string, value: string): void;
  getAttribute(key: string): string | null;
  appendChild(child: MockElement): MockElement;
  remove(): void;
  addEventListener(type: string, fn: (e: unknown) => void): void;
  removeEventListener(type: string, fn: (e: unknown) => void): void;
}

function createMockElement(tagName: string): MockElement {
  const attrs = new Map<string, string>();
  const children: MockElement[] = [];
  const listeners: MockListenerMap = {};
  const el: MockElement = {
    tagName: tagName.toUpperCase(),
    type: '',
    tabIndex: 0,
    title: '',
    textContent: '',
    innerHTML: '',
    style: {} as Record<string, string>,
    children,
    onpointerenter: null,
    onpointerleave: null,
    onpointerdown: null,
    onclick: null,
    setAttribute(key: string, value: string) {
      attrs.set(key, String(value));
    },
    getAttribute(key: string) {
      return attrs.get(key) ?? null;
    },
    appendChild(child: MockElement) {
      children.push(child);
      return child;
    },
    remove() {},
    addEventListener(type: string, fn: (e: unknown) => void) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      const list = listeners[type];
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
  };
  return el;
}

function withMockDom<T>(fn: (dispatchWindowEvent: (type: string, payload: unknown) => void, host: ReturnType<typeof createMockElement>) => T): T {
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const prevDocument = (globalThis as Record<string, unknown>).document;
  const winListeners: MockListenerMap = {};

  const mockWindow = {
    addEventListener(type: string, handler: (e: unknown) => void) {
      (winListeners[type] ??= []).push(handler);
    },
    removeEventListener(type: string, handler: (e: unknown) => void) {
      const list = winListeners[type];
      if (!list) return;
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    },
  };
  const mockDocument = {
    createElement: (tag: string) => createMockElement(tag),
    createElementNS: (_ns: string, tag: string) => createMockElement(tag),
  };

  (globalThis as Record<string, unknown>).window = mockWindow;
  (globalThis as Record<string, unknown>).document = mockDocument;

  const dispatchWindowEvent = (type: string, payload: unknown) => {
    for (const handler of [...(winListeners[type] ?? [])]) {
      handler(payload);
    }
  };

  try {
    const host = createMockElement('div');
    return fn(dispatchWindowEvent, host);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
    if (prevDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = prevDocument;
    }
  }
}

test('RadialInteractPinManager triggers allowClickTrigger pins on click tap and short [E] press without double firing on hold', () => {
  withMockDom((dispatchWindowEvent, host) => {
    const manager = new RadialInteractPinManager(host as unknown as HTMLElement);
    let triggers = 0;

    const syncAt = (nowMs: number) => {
      manager.syncPins(
        [
          {
            id: 'kiosk_transit_0_central_plaza',
            screenX: 320,
            screenY: 220,
            inRange: true,
            distance: 1.5,
            priority: 55,
            icon: 'transit',
            label: 'City Transit',
            accent: 'amber',
            allowClickTrigger: true,
            onTrigger: () => {
              triggers += 1;
            },
          },
        ],
        nowMs,
      );
    };

    syncAt(100);
    const layer = host.children[0];
    const pinButton = layer.children[0];
    assert.equal(pinButton.getAttribute('data-radial-pin-id'), 'kiosk_transit_0_central_plaza');

    // 1. Pointer tap (click without dragging past threshold) triggers immediately on pointerup
    pinButton.onpointerdown?.({
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 320,
      clientY: 220,
      stopPropagation() {},
    });
    dispatchWindowEvent('pointerup', { pointerId: 1, clientX: 322, clientY: 221 });
    assert.equal(triggers, 1);

    // 2. Drag past cancel threshold does NOT trigger on pointerup
    pinButton.onpointerdown?.({
      button: 0,
      pointerType: 'mouse',
      pointerId: 2,
      clientX: 320,
      clientY: 220,
      stopPropagation() {},
    });
    dispatchWindowEvent('pointermove', { pointerId: 2, clientX: 350, clientY: 220 });
    dispatchWindowEvent('pointerup', { pointerId: 2, clientX: 350, clientY: 220 });
    assert.equal(triggers, 1);

    // 3. Short [E] tap triggers on key release
    assert.equal(manager.setKeyEHeld(true, 200), true);
    syncAt(260);
    manager.setKeyEHeld(false, 280);
    assert.equal(triggers, 2);

    // 4. Long hold triggers once at completion, not again on release
    assert.equal(manager.setKeyEHeld(true, 400), true);
    syncAt(400 + RADIAL_HOLD_DURATION_MS + 10);
    assert.equal(triggers, 3);
    manager.setKeyEHeld(false, 950);
    assert.equal(triggers, 3);

    manager.dispose();
  });
});

test('Hold-only pins (like Stand Up) ignore quick taps and priority selects transit kiosk over nearby NPCs', () => {
  withMockDom((dispatchWindowEvent, host) => {
    const manager = new RadialInteractPinManager(host as unknown as HTMLElement);
    let standTriggers = 0;
    let transitTriggers = 0;
    let npcTriggers = 0;

    manager.syncPins(
      [
        {
          id: 'stand_up_seated',
          screenX: 200,
          screenY: 200,
          inRange: true,
          distance: 0.2,
          priority: 100,
          icon: 'stand_up',
          label: 'Stand Up',
          accent: 'rose',
          onTrigger: () => {
            standTriggers += 1;
          },
        },
      ],
      100,
    );

    const standBtn = host.children[0].children[0];
    standBtn.onpointerdown?.({
      button: 0,
      pointerType: 'mouse',
      pointerId: 10,
      clientX: 200,
      clientY: 200,
      stopPropagation() {},
    });
    dispatchWindowEvent('pointerup', { pointerId: 10, clientX: 200, clientY: 200 });
    assert.equal(standTriggers, 0);

    manager.setKeyEHeld(true, 150);
    manager.syncPins(
      [
        {
          id: 'stand_up_seated',
          screenX: 200,
          screenY: 200,
          inRange: true,
          distance: 0.2,
          priority: 100,
          icon: 'stand_up',
          label: 'Stand Up',
          accent: 'rose',
          onTrigger: () => {
            standTriggers += 1;
          },
        },
      ],
      200,
    );
    manager.setKeyEHeld(false, 220);
    assert.equal(standTriggers, 0);

    // Hold >= 480ms triggers Stand Up
    manager.setKeyEHeld(true, 300);
    manager.syncPins(
      [
        {
          id: 'stand_up_seated',
          screenX: 200,
          screenY: 200,
          inRange: true,
          distance: 0.2,
          priority: 100,
          icon: 'stand_up',
          label: 'Stand Up',
          accent: 'rose',
          onTrigger: () => {
            standTriggers += 1;
          },
        },
      ],
      300 + RADIAL_HOLD_DURATION_MS + 5,
    );
    assert.equal(standTriggers, 1);
    manager.setKeyEHeld(false, 900);

    // When standing right next to a kiosk (priority 55) and an NPC (priority 50), [E] opens kiosk
    manager.syncPins(
      [
        {
          id: 'npc_kai',
          screenX: 250,
          screenY: 200,
          inRange: true,
          distance: 1.8,
          priority: 50,
          icon: 'merchant',
          label: 'Kai',
          accent: 'amber',
          onTrigger: () => {
            npcTriggers += 1;
          },
        },
        {
          id: 'kiosk_transit_2_kai_fish_market',
          screenX: 310,
          screenY: 200,
          inRange: true,
          distance: 1.5,
          priority: 55,
          icon: 'transit',
          label: 'City Transit',
          accent: 'amber',
          allowClickTrigger: true,
          onTrigger: () => {
            transitTriggers += 1;
          },
        },
      ],
      1000,
    );

    manager.setKeyEHeld(true, 1010);
    manager.setKeyEHeld(false, 1050);
    assert.equal(transitTriggers, 1);
    assert.equal(npcTriggers, 0);

    manager.dispose();
  });
});

test('resolveCharacterSelectedDockState opens both floating pin popup and bottom dock interaction menu on radial player/NPC selection', () => {
  const playerDock = resolveCharacterSelectedDockState({
    pinId: 'remote_player_alice.testnet',
    expandMenu: true,
  });
  assert.deepEqual(playerDock, {
    selectedTargetPinId: 'remote_player_alice.testnet',
    isPinTargetPopupOpen: true,
    isTargetMenuExpanded: true,
  });

  const npcDock = resolveCharacterSelectedDockState({
    pinId: 'npc_merchant_hana',
  });
  assert.deepEqual(npcDock, {
    selectedTargetPinId: 'npc_merchant_hana',
    isPinTargetPopupOpen: true,
    isTargetMenuExpanded: true,
  });

  const directDock = resolveCharacterSelectedDockState({
    expandMenu: true,
  });
  assert.deepEqual(directDock, {
    selectedTargetPinId: null,
    isPinTargetPopupOpen: false,
    isTargetMenuExpanded: true,
  });

  const collapsedDock = resolveCharacterSelectedDockState({
    pinId: 'npc_citizen_tari',
    expandMenu: false,
  });
  assert.deepEqual(collapsedDock, {
    selectedTargetPinId: 'npc_citizen_tari',
    isPinTargetPopupOpen: false,
    isTargetMenuExpanded: false,
  });
});
