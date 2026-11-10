import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { handleNearRelayerRequest } from './api/near-relayer.ts';

function privyUnusedOptionalPeerStubPlugin(): Plugin {
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
        req.on('data', (chunk) => {
          rawBody += String(chunk);
        });
        req.on('end', async () => {
          try {
            const parsed = rawBody ? JSON.parse(rawBody) : {};
            const out = await handleNearRelayerRequest(parsed);
            res.statusCode = out.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(out.payload));
          } catch (err) {
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
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      privyUnusedOptionalPeerStubPlugin(),
      react(),
      tailwindcss(),
      nearSubAccountRelayerDevPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
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
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
