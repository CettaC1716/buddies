import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureGlobalFetchWritable,
  guardInjectedEvmProvidersAgainstRecursion,
  guardSingleEip1193Provider,
  isValidPrivyAppId,
  normalizePrivyAppId,
} from './privyAuthConfig';

test('normalizePrivyAppId trims whitespace and handles empty values', () => {
  assert.equal(normalizePrivyAppId(undefined), '');
  assert.equal(normalizePrivyAppId(null), '');
  assert.equal(normalizePrivyAppId('   '), '');
  assert.equal(normalizePrivyAppId('  cm8abc123def456ghi789jkl0  '), 'cm8abc123def456ghi789jkl0');
});

test('isValidPrivyAppId rejects empty, placeholder, and malformed IDs', () => {
  assert.equal(isValidPrivyAppId(''), false);
  assert.equal(isValidPrivyAppId('   '), false);
  assert.equal(isValidPrivyAppId(undefined), false);
  assert.equal(isValidPrivyAppId('your-privy-app-id'), false);
  assert.equal(isValidPrivyAppId('invalid_id'), false);
  assert.equal(isValidPrivyAppId('12345'), false);
});

test('isValidPrivyAppId accepts valid CUID-formatted Privy App IDs', () => {
  assert.equal(isValidPrivyAppId('cm8abc123def456ghi789jkl0'), true);
  assert.equal(isValidPrivyAppId('clx9876543210abcdefghijkl'), true);
});

test('ensureGlobalFetchWritable prevents getter-only fetch crash on prototype-inherited instances without mutating global fetch', () => {
  const fakeWindowProto = {};
  const originalFetch = async () => 'ok';
  Object.defineProperty(fakeWindowProto, 'fetch', {
    configurable: true,
    enumerable: true,
    get() {
      return originalFetch;
    },
  });
  const fakeWindow = Object.create(fakeWindowProto) as { fetch: unknown };

  // Before patching, `new F()` with `F.prototype = fakeWindow` throws TypeError in strict mode
  assert.throws(() => {
    function F(this: { fetch: unknown }) {
      this.fetch = false;
    }
    F.prototype = fakeWindow;
    return new (F as unknown as { new (): { fetch: unknown } })();
  }, TypeError);

  ensureGlobalFetchWritable(fakeWindow);

  // After patching, `new F()` succeeds and `fakeWindow.fetch` remains `originalFetch`
  function F2(this: { fetch: unknown }) {
    this.fetch = false;
  }
  F2.prototype = fakeWindow;
  const instance = new (F2 as unknown as { new (): { fetch: unknown } })();
  assert.equal(instance.fetch, false);
  assert.equal(fakeWindow.fetch, originalFetch);
});

test('guardInjectedEvmProvidersAgainstRecursion prevents RangeError: Maximum call stack size exceeded between Coinbase Wallet requestProvider.js and Privy onConnect/syncAccounts', async () => {
  class MockCoinbaseRequestProvider {
    private listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    public providers: unknown[] = [];
    public registerCalls = 0;

    on(event: string, cb: (...args: unknown[]) => void) {
      const list = this.listeners.get(event) ?? [];
      list.push(cb);
      this.listeners.set(event, list);
    }

    emit(event: string, ...args: unknown[]) {
      const list = this.listeners.get(event) ?? [];
      for (const cb of list) {
        cb(...args);
      }
    }

    registerProviders() {
      this.registerCalls++;
      // Simulate Coinbase Wallet requestProvider.js synchronously emitting 'connect' during registerProviders()
      this.emit('connect', { chainId: '0x1' });
    }

    request(args: { method?: string }): Promise<unknown> {
      this.registerProviders();
      if (args?.method === 'eth_accounts') {
        return Promise.resolve(['0x1234567890abcdef']);
      }
      return Promise.resolve('0x1');
    }
  }

  // 1. Verify that unguarded provider + Privy synchronous onConnect -> syncAccounts -> request throws RangeError
  const unguarded = new MockCoinbaseRequestProvider();
  unguarded.on('connect', () => {
    void unguarded.request({ method: 'eth_accounts' });
  });
  assert.throws(
    () => {
      void unguarded.request({ method: 'eth_accounts' });
    },
    RangeError,
    'Unguarded Coinbase requestProvider + Privy onConnect loop throws RangeError',
  );

  // 2. Verify that guarding via guardInjectedEvmProvidersAgainstRecursion / guardSingleEip1193Provider breaks the recursion cleanly
  const guarded = new MockCoinbaseRequestProvider();
  guarded.providers = [guarded]; // Circular self-reference in providers array
  const fakeWin = { ethereum: guarded };
  guardInjectedEvmProvidersAgainstRecursion(fakeWin);
  assert.equal(guarded.providers.length, 0, 'Circular self-reference removed from providers array');

  guarded.on('connect', () => {
    void new Promise((resolve, reject) => {
      guarded.request({ method: 'eth_accounts' }).then(resolve, reject);
    });
  });

  const accounts = await guarded.request({ method: 'eth_accounts' });
  assert.deepEqual(accounts, ['0x1234567890abcdef']);
  // Wait one macrotask tick for any deferred connect callbacks to settle cleanly
  await new Promise((r) => setTimeout(r, 15));
  assert.ok(guarded.registerCalls <= 2, 'registerProviders did not infinitely recurse');

  // Also verify guardSingleEip1193Provider handles null/primitive values safely
  guardSingleEip1193Provider(null);
  guardSingleEip1193Provider(undefined);
});

test('privyAuthBridge uses headless useLoginWithOAuth (initOAuth({ provider: "google" })) and never calls modal useLogin', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const bridgeSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/privyAuthBridge.tsx'),
    'utf8',
  );
  assert.ok(bridgeSrc.includes('useLoginWithOAuth'), 'Must use headless useLoginWithOAuth hook');
  assert.ok(
    bridgeSrc.includes("initOAuth({ provider: 'google' })"),
    'Must trigger headless Google OAuth via initOAuth({ provider: "google" })',
  );
  assert.equal(
    /\buseLogin\s*\(/.test(bridgeSrc),
    false,
    'Must never call modal useLogin()',
  );
});



