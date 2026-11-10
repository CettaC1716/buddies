export function normalizePrivyAppId(rawAppId: string | undefined | null): string {
  if (typeof rawAppId !== 'string') return '';
  return rawAppId.trim();
}

/**
 * Validates whether a Privy App ID string is safe to pass into `<PrivyProvider>`.
 * Privy App IDs are CUIDs (starting with 'c', lowercase alphanumeric, ~25 chars).
 * Empty strings, placeholder values, or malformed IDs cause `@privy-io/react-auth`
 * to throw `Cannot initialize the Privy provider with an invalid Privy app ID`.
 */
export function isValidPrivyAppId(rawAppId: string | undefined | null): boolean {
  const cleaned = normalizePrivyAppId(rawAppId);
  if (!cleaned) return false;
  if (
    cleaned === 'your-privy-app-id' ||
    cleaned === 'YOUR_PRIVY_APP_ID' ||
    cleaned === 'undefined' ||
    cleaned === 'null'
  ) {
    return false;
  }
  return /^c[a-z0-9]{20,35}$/.test(cleaned);
}

/**
 * Ensures `fetch` on `globalObj` and its prototype chain (`Window.prototype`)
 * is writable so CJS ponyfills (such as `browser-ponyfill` in `@walletconnect`,
 * which executes `function F() { this.fetch = false; } F.prototype = globalThis; new F()`)
 * never throw `TypeError: Cannot set property fetch of #<Window> which has only a getter`
 * while preserving `globalObj.fetch`.
 */
export function ensureGlobalFetchWritable(
  targetGlobal: object | undefined = typeof globalThis !== 'undefined' ? globalThis : undefined,
): void {
  if (!targetGlobal || (typeof targetGlobal !== 'object' && typeof targetGlobal !== 'function')) {
    return;
  }

  let current: object | null = targetGlobal;
  const visited = new Set<object>();

  while (current && !visited.has(current)) {
    visited.add(current);
    try {
      const desc = Object.getOwnPropertyDescriptor(current, 'fetch');
      if (desc && typeof desc.get === 'function' && !desc.set && desc.configurable) {
        const owner = current;
        const originalGet = desc.get;
        let overriddenFetch: unknown;
        let hasOverride = false;

        Object.defineProperty(owner, 'fetch', {
          configurable: true,
          enumerable: desc.enumerable ?? true,
          get() {
            if (hasOverride) return overriddenFetch;
            return originalGet.call(targetGlobal);
          },
          set(nextVal: unknown) {
            if (this && this !== owner && this !== targetGlobal) {
              Object.defineProperty(this, 'fetch', {
                value: nextVal,
                writable: true,
                configurable: true,
                enumerable: true,
              });
              return;
            }
            overriddenFetch = nextVal;
            hasOverride = true;
          },
        });
      }
    } catch {
      // Ignore non-configurable prototype frames
    }
    current = Object.getPrototypeOf(current);
  }

  guardInjectedEvmProvidersAgainstRecursion(targetGlobal);
}

const GUARDED_PROVIDER_SYMBOL = Symbol.for('__bb_eip1193_recursion_guarded__');
const GUARDED_GLOBAL_SYMBOL = Symbol.for('__bb_evm_global_recursion_guarded__');

interface Eip1193LikeProvider {
  [key: string | symbol]: unknown;
  request?: (args: { method?: string; params?: unknown }) => Promise<unknown>;
  registerProviders?: (...args: unknown[]) => unknown;
  emit?: (eventName: string, ...args: unknown[]) => unknown;
  on?: (eventName: string, listener: (...args: unknown[]) => void) => unknown;
  addListener?: (eventName: string, listener: (...args: unknown[]) => void) => unknown;
  providers?: unknown[];
}

function defineSafeMethod(
  target: object,
  methodName: string,
  wrapper: (...args: unknown[]) => unknown,
): boolean {
  try {
    Object.defineProperty(target, methodName, {
      value: wrapper,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    return true;
  } catch {
    try {
      (target as Record<string, unknown>)[methodName] = wrapper;
      return (target as Record<string, unknown>)[methodName] === wrapper;
    } catch {
      return false;
    }
  }
}

/**
 * Guards an injected EIP-1193 wallet provider (such as Coinbase Wallet's
 * `requestProvider.js`) against synchronous call-stack recursion when Privy's
 * `onConnect -> syncAccounts -> request -> registerProviders -> emit('connect')`
 * loop fires synchronously inside `new Promise(...)`.
 */
export function guardSingleEip1193Provider(rawProvider: unknown): void {
  if (!rawProvider || (typeof rawProvider !== 'object' && typeof rawProvider !== 'function')) {
    return;
  }
  const provider = rawProvider as Eip1193LikeProvider;
  if (provider[GUARDED_PROVIDER_SYMBOL]) {
    return;
  }
  try {
    Object.defineProperty(provider, GUARDED_PROVIDER_SYMBOL, {
      value: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    provider[GUARDED_PROVIDER_SYMBOL] = true;
  }

  // 1. Sanitize circular or duplicate entries in `provider.providers`
  if (Array.isArray(provider.providers)) {
    const uniqueProviders: unknown[] = [];
    const seen = new Set<unknown>([provider]);
    for (const sub of provider.providers) {
      if (sub && !seen.has(sub)) {
        seen.add(sub);
        uniqueProviders.push(sub);
        guardSingleEip1193Provider(sub);
      }
    }
    try {
      provider.providers = uniqueProviders;
    } catch {
      // Ignore read-only providers array
    }
  }

  let requestDepth = 0;
  let registerProvidersDepth = 0;
  let connectEmitDepth = 0;
  let lastConnectEmitAt = 0;
  const inFlightRequests = new Map<string, Promise<unknown>>();

  // 2. Guard `registerProviders` against re-entrant recursion
  if (typeof provider.registerProviders === 'function') {
    const origRegisterProviders = provider.registerProviders;
    const wrappedRegisterProviders = function (this: unknown, ...args: unknown[]) {
      if (registerProvidersDepth > 0 || requestDepth > 1) {
        return undefined;
      }
      registerProvidersDepth++;
      try {
        return origRegisterProviders.apply(this ?? provider, args);
      } finally {
        registerProvidersDepth--;
      }
    };
    if (!defineSafeMethod(provider, 'registerProviders', wrappedRegisterProviders)) {
      const proto = Object.getPrototypeOf(provider);
      if (proto && proto !== Object.prototype) {
        defineSafeMethod(proto, 'registerProviders', wrappedRegisterProviders);
      }
    }
  }

  // 3. Guard `emit` so synchronous `'connect'` emissions during `request()` or re-entrant `'connect'`
  //    never recurse back into Privy's `Gt.onConnect -> rn.syncAccounts -> Jt.request` on the same stack.
  if (typeof provider.emit === 'function') {
    const origEmit = provider.emit as (this: unknown, ...a: unknown[]) => unknown;
    const wrappedEmit = function (this: unknown, eventName: unknown, ...args: unknown[]) {
      if (eventName === 'connect') {
        const now = Date.now();
        if (connectEmitDepth > 0 || (requestDepth > 0 && now - lastConnectEmitAt < 250)) {
          lastConnectEmitAt = now;
          return false;
        }
        lastConnectEmitAt = now;
        if (requestDepth > 0) {
          const self = this ?? provider;
          setTimeout(() => {
            if (connectEmitDepth > 0) return;
            connectEmitDepth++;
            try {
              origEmit.apply(self, [eventName, ...args]);
            } finally {
              connectEmitDepth--;
            }
          }, 0);
          return true;
        }
        connectEmitDepth++;
        try {
          return origEmit.apply(this ?? provider, [eventName, ...args]);
        } finally {
          connectEmitDepth--;
        }
      }
      return origEmit.apply(this ?? provider, [eventName, ...args]);
    };
    defineSafeMethod(provider, 'emit', wrappedEmit);
  }

  // 4. Guard `on` and `addListener` so `'connect'` listeners cannot synchronously re-enter
  for (const subMethod of ['on', 'addListener'] as const) {
    const origSub = provider[subMethod] as
      | ((this: unknown, ...a: unknown[]) => unknown)
      | undefined;
    if (typeof origSub === 'function') {
      const wrappedSub = function (
        this: unknown,
        eventName: unknown,
        listener: unknown,
        ...rest: unknown[]
      ) {
        if (eventName === 'connect' && typeof listener === 'function') {
          let listenerActive = false;
          const safeConnectListener = function (this: unknown, ...lArgs: unknown[]) {
            if (listenerActive) return;
            if (requestDepth > 0) {
              setTimeout(() => {
                if (listenerActive) return;
                listenerActive = true;
                try {
                  (listener as (...a: unknown[]) => void).apply(this, lArgs);
                } finally {
                  listenerActive = false;
                }
              }, 0);
              return;
            }
            listenerActive = true;
            try {
              return (listener as (...a: unknown[]) => unknown).apply(this, lArgs);
            } finally {
              listenerActive = false;
            }
          };
          return origSub.apply(this ?? provider, [eventName, safeConnectListener, ...rest]);
        }
        return origSub.apply(this ?? provider, [eventName, listener, ...rest]);
      };
      defineSafeMethod(provider, subMethod, wrappedSub);
    }
  }

  // 5. Guard `request` against synchronous re-entrancy & deduplicate concurrent handshake calls
  if (typeof provider.request === 'function') {
    const origRequest = provider.request;
    const wrappedRequest = function (
      this: unknown,
       rawArgs: unknown,
    ): Promise<unknown> {
      const method =
        rawArgs && typeof rawArgs === 'object' && 'method' in rawArgs
          ? String((rawArgs as { method?: unknown }).method ?? '')
          : '';
      const isDeduplicableMethod =
        method === 'eth_accounts' ||
        method === 'eth_chainId' ||
        method === 'net_version' ||
        method === 'eth_requestAccounts';

      if (isDeduplicableMethod && inFlightRequests.has(method)) {
        return inFlightRequests.get(method)!;
      }

      const self = this ?? provider;
      const executeRequest = (): Promise<unknown> => {
        requestDepth++;
        try {
          const result = origRequest.call(
            self,
            rawArgs as { method?: string; params?: unknown },
          );
          return Promise.resolve(result);
        } catch (err) {
          return Promise.reject(err);
        } finally {
          requestDepth--;
        }
      };

      // If called re-entrantly while already inside `request()`, unwind the synchronous stack first
      const promise =
        requestDepth > 0
          ? new Promise<unknown>((resolve) => {
              setTimeout(resolve, 0);
            }).then(executeRequest)
          : executeRequest();

      if (isDeduplicableMethod) {
        const tracked = promise.finally(() => {
          inFlightRequests.delete(method);
        });
        inFlightRequests.set(method, tracked);
        return tracked;
      }

      return promise;
    };
    defineSafeMethod(provider, 'request', wrappedRequest);
  }
}

/**
 * Installs recursion guards on `window.ethereum`, `window.coinbaseWalletExtension`,
 * and any EIP-6963 announced providers so browser wallet extensions never crash Privy.
 */
export function guardInjectedEvmProvidersAgainstRecursion(
  targetGlobal: object | undefined = typeof globalThis !== 'undefined' ? globalThis : undefined,
): void {
  if (!targetGlobal || (typeof targetGlobal !== 'object' && typeof targetGlobal !== 'function')) {
    return;
  }
  const g = targetGlobal as Record<string | symbol, unknown>;
  if (g[GUARDED_GLOBAL_SYMBOL]) {
    if (g.ethereum) guardSingleEip1193Provider(g.ethereum);
    if (g.coinbaseWalletExtension) guardSingleEip1193Provider(g.coinbaseWalletExtension);
    return;
  }
  try {
    Object.defineProperty(g, GUARDED_GLOBAL_SYMBOL, {
      value: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    g[GUARDED_GLOBAL_SYMBOL] = true;
  }

  if (g.ethereum) {
    guardSingleEip1193Provider(g.ethereum);
  }
  if (g.coinbaseWalletExtension) {
    guardSingleEip1193Provider(g.coinbaseWalletExtension);
  }

  // Intercept future `window.ethereum` injection if an extension sets it after initial script load
  try {
    const desc = Object.getOwnPropertyDescriptor(g, 'ethereum');
    if (!desc || desc.configurable) {
      let currentEth = g.ethereum;
      Object.defineProperty(g, 'ethereum', {
        configurable: true,
        enumerable: true,
        get() {
          return currentEth;
        },
        set(nextEth: unknown) {
          guardSingleEip1193Provider(nextEth);
          currentEth = nextEth;
        },
      });
    }
  } catch {
    // Ignore if `window.ethereum` is already locked by an extension
  }

  // Guard any EIP-6963 providers announced via `eip6963:announceProvider` before Privy receives them
  if (typeof (g as { addEventListener?: unknown }).addEventListener === 'function') {
    try {
      (
        g as {
          addEventListener: (
            type: string,
            listener: (ev: { detail?: { provider?: unknown } }) => void,
            options?: boolean,
          ) => void;
        }
      ).addEventListener(
        'eip6963:announceProvider',
        (ev) => {
          if (ev?.detail?.provider) {
            guardSingleEip1193Provider(ev.detail.provider);
          }
        },
        true,
      );
    } catch {
      // Ignore event listener errors in non-DOM test environments
    }
  }
}

