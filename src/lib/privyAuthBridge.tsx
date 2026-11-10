import React, { Component, createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ensureGlobalFetchWritable,
  isValidPrivyAppId,
  normalizePrivyAppId,
} from './privyAuthConfig';

export interface SafePrivyUser {
  google?: {
    email?: string;
  };
  email?: {
    address?: string;
  };
}

export interface SafePrivyLoginCallbacks {
  onComplete?: (params: {
    user: SafePrivyUser | null;
    wasAlreadyAuthenticated: boolean;
  }) => void;
  onError?: (error: unknown) => void;
}

interface PrivyBridgeContextValue {
  ready: boolean;
  authenticated: boolean;
  user: SafePrivyUser | null;
  loading: boolean;
  oauthState: string;
  logout: () => Promise<void>;
  initGoogleOAuth: () => Promise<void>;
  registerLoginCallbacks: (callbacks: SafePrivyLoginCallbacks) => () => void;
}

const FALLBACK_PRIVY_CONTEXT: PrivyBridgeContextValue = {
  ready: false,
  authenticated: false,
  user: null,
  loading: false,
  oauthState: 'initial',
  logout: async () => {},
  initGoogleOAuth: async () => {
    throw new Error('Privy Google OAuth is not initialized.');
  },
  registerLoginCallbacks: () => () => {},
};

const PrivyBridgeContext = createContext<PrivyBridgeContextValue>(FALLBACK_PRIVY_CONTEXT);

export function ensureWindowFetchWritable(): void {
  if (typeof window !== 'undefined') {
    ensureGlobalFetchWritable(window);
  }
}

ensureWindowFetchWritable();

type PrivyModuleType = typeof import('@privy-io/react-auth');

interface HeadlessPrivyControllerProps {
  appId: string;
  callbacksRef: React.MutableRefObject<Set<SafePrivyLoginCallbacks>>;
  onSyncBridgeValue: (value: Omit<PrivyBridgeContextValue, 'registerLoginCallbacks'>) => void;
}

function createHeadlessPrivyController(PrivyMod: PrivyModuleType) {
  const { PrivyProvider, usePrivy, useLoginWithOAuth } = PrivyMod;

  function ActivePrivySync({
    callbacksRef,
    onSyncBridgeValue,
  }: Omit<HeadlessPrivyControllerProps, 'appId'>) {
    const { ready, authenticated, user, logout } = usePrivy();
    const { initOAuth, loading, state } = useLoginWithOAuth({
      onComplete: (params) => {
        callbacksRef.current.forEach((cb) => {
          cb.onComplete?.({
            user: (params.user as SafePrivyUser | null) ?? null,
            wasAlreadyAuthenticated: Boolean(params.wasAlreadyAuthenticated),
          });
        });
      },
      onError: (err) => {
        callbacksRef.current.forEach((cb) => {
          cb.onError?.(err);
        });
      },
    });

    const actionsRef = useRef({
      logout: async () => {
        await logout();
      },
      initGoogleOAuth: async () => {
        await initOAuth({ provider: 'google' });
      },
    });
    actionsRef.current = {
      logout: async () => {
        await logout();
      },
      initGoogleOAuth: async () => {
        await initOAuth({ provider: 'google' });
      },
    };

    const statusStr = state?.status ?? 'initial';
    const userEmail =
      (user as SafePrivyUser | null)?.google?.email ||
      (user as SafePrivyUser | null)?.email?.address ||
      '';

    useEffect(() => {
      onSyncBridgeValue({
        ready,
        authenticated,
        user: (user as SafePrivyUser | null) ?? null,
        loading: Boolean(loading),
        oauthState: statusStr,
        logout: () => actionsRef.current.logout(),
        initGoogleOAuth: () => actionsRef.current.initGoogleOAuth(),
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, authenticated, userEmail, loading, statusStr, onSyncBridgeValue]);

    return null;
  }

  return function HeadlessPrivyController({
    appId,
    callbacksRef,
    onSyncBridgeValue,
  }: HeadlessPrivyControllerProps) {
    ensureWindowFetchWritable();
    return (
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ['google'],
          appearance: {
            theme: 'dark',
            accentColor: '#b8ff3c',
            walletList: [],
            showWalletLoginFirst: false,
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'off',
            },
            solana: {
              createOnLogin: 'off',
            },
          },
          externalWallets: {
            walletConnect: {
              enabled: false,
            },
          },
        }}
      >
        <ActivePrivySync callbacksRef={callbacksRef} onSyncBridgeValue={onSyncBridgeValue} />
      </PrivyProvider>
    );
  };
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class PrivyErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export function SafePrivyProvider({
  appId,
  children,
}: {
  appId?: string | null;
  children: React.ReactNode;
}) {
  const normalizedAppId = normalizePrivyAppId(appId);
  const valid = isValidPrivyAppId(normalizedAppId);
  const callbacksRef = useRef<Set<SafePrivyLoginCallbacks>>(new Set());
  const [bridgeState, setBridgeState] = useState<
    Omit<PrivyBridgeContextValue, 'registerLoginCallbacks'>
  >(() => ({
    ready: false,
    authenticated: false,
    user: null,
    loading: false,
    oauthState: 'initial',
    logout: FALLBACK_PRIVY_CONTEXT.logout,
    initGoogleOAuth: FALLBACK_PRIVY_CONTEXT.initGoogleOAuth,
  }));

  const [HeadlessController, setHeadlessController] =
    useState<React.ComponentType<HeadlessPrivyControllerProps> | null>(null);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    ensureWindowFetchWritable();
    void import('@privy-io/react-auth')
      .then((mod) => {
        if (!cancelled) {
          ensureWindowFetchWritable();
          setHeadlessController(() => createHeadlessPrivyController(mod));
        }
      })
      .catch(() => {
        // Keep fallback context if SDK fails to initialize
      });
    return () => {
      cancelled = true;
    };
  }, [valid]);

  const registerLoginCallbacks = React.useCallback((cb: SafePrivyLoginCallbacks) => {
    callbacksRef.current.add(cb);
    return () => {
      callbacksRef.current.delete(cb);
    };
  }, []);

  const contextValue: PrivyBridgeContextValue = {
    ...bridgeState,
    registerLoginCallbacks,
  };

  return (
    <PrivyBridgeContext.Provider value={contextValue}>
      {valid && HeadlessController && (
        <PrivyErrorBoundary>
          <HeadlessController
            appId={normalizedAppId}
            callbacksRef={callbacksRef}
            onSyncBridgeValue={setBridgeState}
          />
        </PrivyErrorBoundary>
      )}
      {children}
    </PrivyBridgeContext.Provider>
  );
}

export function useSafePrivy() {
  const ctx = useContext(PrivyBridgeContext);
  return {
    ready: ctx.ready,
    authenticated: ctx.authenticated,
    user: ctx.user,
    logout: ctx.logout,
  };
}

export function useSafePrivyLogin(callbacks?: SafePrivyLoginCallbacks) {
  const ctx = useContext(PrivyBridgeContext);
  const registerLoginCallbacks = ctx.registerLoginCallbacks;
  const callbacksRef = useRef<SafePrivyLoginCallbacks | undefined>(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    return registerLoginCallbacks({
      onComplete: (params) => callbacksRef.current?.onComplete?.(params),
      onError: (err) => callbacksRef.current?.onError?.(err),
    });
  }, [registerLoginCallbacks]);

  return {
    initGoogleOAuth: ctx.initGoogleOAuth,
    loading: ctx.loading,
    oauthState: ctx.oauthState,
  };
}
