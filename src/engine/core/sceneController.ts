/**
 * Standard SceneController contract & SceneRegistry for modular WebGL game modes.
 *
 * Keeps mode-specific lifecycle (enter, per-frame update, exit, dispose)
 * isolated per scene controller rather than branching inside a monolithic loop.
 */

export interface SceneTransitionContext {
  previousSceneId: string | null;
  reason?: string;
}

export interface SceneController {
  readonly id: string;
  onEnter?: (ctx: SceneTransitionContext) => void;
  onUpdate?: (dt: number, elapsedSec: number) => void;
  onExit?: (nextSceneId: string | null) => void;
  dispose?: () => void;
}

export class SceneRegistry {
  private readonly controllers = new Map<string, SceneController>();
  private activeId: string | null = null;

  register(controller: SceneController): void {
    this.controllers.set(controller.id, controller);
  }

  unregister(sceneId: string): void {
    if (this.activeId === sceneId) {
      this.activate(null);
    }
    this.controllers.delete(sceneId);
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  getController(sceneId: string): SceneController | undefined {
    return this.controllers.get(sceneId);
  }

  activate(nextSceneId: string | null, reason?: string): void {
    if (this.activeId === nextSceneId) return;
    const prevId = this.activeId;
    if (prevId !== null) {
      this.controllers.get(prevId)?.onExit?.(nextSceneId);
    }
    this.activeId = nextSceneId;
    if (nextSceneId !== null) {
      this.controllers.get(nextSceneId)?.onEnter?.({
        previousSceneId: prevId,
        reason,
      });
    }
  }

  updateActive(dt: number, elapsedSec: number): void {
    if (this.activeId === null) return;
    this.controllers.get(this.activeId)?.onUpdate?.(dt, elapsedSec);
  }

  disposeAll(): void {
    if (this.activeId !== null) {
      this.controllers.get(this.activeId)?.onExit?.(null);
      this.activeId = null;
    }
    for (const controller of this.controllers.values()) {
      controller.dispose?.();
    }
    this.controllers.clear();
  }
}
