import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleNearRelayerRequest } from './api/near-relayer.ts';
import { handleNpcAgentRequest } from './api/npc-agent.ts';
import { isValidPrivyAppId } from './src/lib/privyAuthConfig.ts';

function privyUnusedOptionalPeerStubPlugin(options: { stubInactivePrivyInDev: boolean }): Plugin {
  const stubs: Record<string, string> = {
    '@solana-program/system': [
      'export const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";',
      'export function getTransferSolInstruction() { return {}; }',
    ].join('\n'),
    '@solana-program/token': [
      'export const TOKEN_PROGRAM_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";',
      'export async function findAssociatedTokenPda() { return [""]; }',
      'export function getCreateAssociatedTokenIdempotentInstruction() { return {}; }',
      'export function getTransferInstruction() { return {}; }',
      'export function getApproveInstruction() { return {}; }',
      'export async function fetchMaybeToken() { return { exists: false }; }',
    ].join('\n'),
    '@solana-program/memo': [
      'export const MEMO_PROGRAM_ADDRESS = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";',
      'export function getAddMemoInstruction() { return {}; }',
    ].join('\n'),
    '@stripe/stripe-js': 'export async function loadStripe() { return null; }',
  };

  if (options.stubInactivePrivyInDev) {
    stubs['@privy-io/react-auth'] = [
      'export function PrivyProvider({ children }) { return children ?? null; }',
      'export function usePrivy() {',
      '  return { ready: false, authenticated: false, user: null, logout: async () => {} };',
      '}',
      'export function useLoginWithOAuth() {',
      '  return { initOAuth: async () => {}, loading: false, state: { status: "initial" } };',
      '}',
    ].join('\n');
  }

  return {
    name: 'privy-unused-optional-peer-stub',
    enforce: 'pre',
    resolveId(id) {
      if (id in stubs) {
        return `\0virtual:${id}`;
      }
      return null;
    },
    load(id) {
      if (id.startsWith('\0virtual:')) {
        const key = id.slice('\0virtual:'.length);
        return stubs[key] || null;
      }
      return null;
    },
  };
}

function nearSubAccountRelayerDevPlugin(): Plugin {
  return {
    name: 'near-subaccount-relayer-dev',
    configureServer(server) {
      server.middlewares.use('/api/near-relayer', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        let rawBody = '';
        req.on('error', () => {
          if (!res.writableEnded) {
            res.statusCode = 400;
            res.end();
          }
        });
        req.on('data', (chunk) => {
          rawBody += String(chunk);
        });
        req.on('end', async () => {
          if (res.writableEnded) return;
          try {
            const parsed = rawBody ? JSON.parse(rawBody) : {};
            const out = await handleNearRelayerRequest(parsed);
            if (res.writableEnded) return;
            res.statusCode = out.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(out.payload));
          } catch (err) {
            if (res.writableEnded) return;
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                error: err instanceof Error ? err.message : 'Relayer middleware error',
              }),
            );
          }
        });
      });

      server.middlewares.use('/api/npc-agent', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        let rawBody = '';
        req.on('error', () => {
          if (!res.writableEnded) {
            res.statusCode = 400;
            res.end();
          }
        });
        req.on('data', (chunk) => {
          rawBody += String(chunk);
        });
        req.on('end', async () => {
          if (res.writableEnded) return;
          try {
            const parsed = rawBody ? JSON.parse(rawBody) : {};
            const out = await handleNpcAgentRequest(parsed);
            if (res.writableEnded) return;
            res.statusCode = out.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(out.payload));
          } catch (err) {
            if (res.writableEnded) return;
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                error: err instanceof Error ? err.message : 'NPC agent middleware error',
              }),
            );
          }
        });
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }
  const hasValidPrivyAppId = isValidPrivyAppId(
    env.VITE_PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID,
  );
  const stubInactivePrivyInDev = command === 'serve' && !hasValidPrivyAppId;

  return {
    plugins: [
      privyUnusedOptionalPeerStubPlugin({ stubInactivePrivyInDev }),
      react(),
      tailwindcss(),
      nearSubAccountRelayerDevPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    optimizeDeps: {
      noDiscovery: true,
      holdUntilCrawlEnd: false,
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'three',
        'three/addons/geometries/RoundedBoxGeometry.js',
        'three/addons/loaders/DRACOLoader.js',
        'three/addons/loaders/FBXLoader.js',
        'three/addons/loaders/GLTFLoader.js',
        'three/addons/loaders/KTX2Loader.js',
        'three/addons/utils/BufferGeometryUtils.js',
        'three/addons/utils/SkeletonUtils.js',
        '@supabase/supabase-js',
        '@hot-labs/near-connect',
        ...(hasValidPrivyAppId ? ['@privy-io/react-auth'] : []),
      ],
    },
    build: {
      chunkSizeWarningLimit: 1800,
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'vendor-three';
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
            return undefined;
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
