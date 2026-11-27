/**
 * Centralized lazy module & asset loader registry for on-demand dynamic
 * code-splitting of heavy 3D zone/interior builders and feature modules.
 *
 * Guarantees deduplicated in-flight promises, clean error recovery (so a
 * transient network hiccup can be retried), and simple preloading hints.
 */

export type ModuleLoaderFn<T> = () => Promise<T>;

export class LazyModuleRegistry {
  private readonly loaders = new Map<string, ModuleLoaderFn<unknown>>();
  private readonly resolved = new Map<string, unknown>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  register<T>(key: string, loader: ModuleLoaderFn<T>): void {
    this.loaders.set(key, loader);
  }

  hasLoaded(key: string): boolean {
    return this.resolved.has(key);
  }

  getLoaded<T>(key: string): T | null {
    return (this.resolved.get(key) as T | undefined) ?? null;
  }

  async load<T>(key: string): Promise<T> {
    if (this.resolved.has(key)) {
      return this.resolved.get(key) as T;
    }
    const pending = this.inflight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    const loader = this.loaders.get(key);
    if (!loader) {
      throw new Error(`LazyModuleRegistry: no loader registered for "${key}"`);
    }
    const promise = loader()
      .then((mod) => {
        this.resolved.set(key, mod);
        this.inflight.delete(key);
        return mod;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });
    this.inflight.set(key, promise);
    return promise as Promise<T>;
  }

  preload(keys: readonly string[]): void {
    for (const key of keys) {
      if (this.loaders.has(key) && !this.resolved.has(key) && !this.inflight.has(key)) {
        void this.load(key).catch(() => {
          // Non-fatal background preload; caller will retry on explicit load().
        });
      }
    }
  }

  clear(): void {
    this.resolved.clear();
    this.inflight.clear();
  }
}

export const lazyModuleRegistry = new LazyModuleRegistry();
