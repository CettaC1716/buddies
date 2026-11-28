/**
 * Strongly-typed Game Event Bus for Engine <-> React UI communication.
 *
 * Replaces ad-hoc global `window.dispatchEvent(new CustomEvent(...))` calls
 * with compile-time checked event channels while offering an optional
 * backwards-compatible `bridgeWindowEvent` helper during incremental migration.
 */

export type SceneModeId =
  | 'none'
  | 'landing_tour'
  | 'fly_to_plaza'
  | 'npc_merchant'
  | 'house_interior'
  | 'house_visit'
  | 'cafe_interior'
  | 'casino_interior'
  | 'character_select'
  | 'city_view';

export interface GameEventMap {
  'scene:mode-changed': {
    previousMode: SceneModeId;
    nextMode: SceneModeId;
    isSampleHouse?: boolean;
  };
  'house:exit-proximity': {
    near: boolean;
    distance: number;
  };
  'ui:modal-opened': {
    modalId: string;
  };
  'ui:modal-closed': {
    modalId: string;
  };
  'audio:play-sfx': {
    sfx: 'ui_click' | 'ui_confirm' | 'ui_cancel' | 'pickup' | 'soft_tap';
  };
}

export type GameEventKey = keyof GameEventMap;
export type GameEventHandler<T> = (payload: T) => void;

export class TypedEventBus<TEvents extends object> {
  private readonly listeners = new Map<keyof TEvents, Set<GameEventHandler<unknown>>>();

  on<K extends keyof TEvents>(event: K, handler: GameEventHandler<TEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as GameEventHandler<unknown>);
    return () => this.off(event, handler);
  }

  once<K extends keyof TEvents>(event: K, handler: GameEventHandler<TEvents[K]>): () => void {
    const wrapped: GameEventHandler<TEvents[K]> = (payload) => {
      this.off(event, wrapped);
      handler(payload);
    };
    return this.on(event, wrapped);
  }

  off<K extends keyof TEvents>(event: K, handler: GameEventHandler<TEvents[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler as GameEventHandler<unknown>);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const handler of Array.from(set)) {
      (handler as GameEventHandler<TEvents[K]>)(payload);
    }
  }

  listenerCount<K extends keyof TEvents>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Shared singleton typed event bus bridging the 3D engine and React UI layer. */
export const gameEventBus = new TypedEventBus<GameEventMap>();

/**
 * Mirrors a typed event bus channel onto a legacy `window` CustomEvent so
 * components not yet migrated off `window.addEventListener` remain in sync.
 */
export function bridgeBusToWindowEvent<K extends GameEventKey>(
  bus: TypedEventBus<GameEventMap>,
  busEvent: K,
  windowEventName: string,
): () => void {
  return bus.on(busEvent, (payload) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(windowEventName, { detail: payload }));
    }
  });
}
