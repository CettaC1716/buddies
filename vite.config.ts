import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execFile} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function nearSubAccountProvisionerPlugin(): Plugin {
  return {
    name: 'near-subaccount-provisioner',
    configureServer(server) {
      server.middlewares.use('/api/near/verify-local-master-key', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const primaryCredPath = path.join(
            os.homedir(),
            '.near-credentials',
            'testnet',
            'buddiesblitz.testnet.json',
          );
          const fallbackCredPath = path.join(
            os.homedir(),
            '.near-credentials',
            'testnet',
            'buddiesblitz-master.testnet.json',
          );
          const credPath = fs.existsSync(primaryCredPath) ? primaryCredPath : fallbackCredPath;
          if (!fs.existsSync(credPath)) {
            res.statusCode = 200;
            res.end(JSON.stringify({ok: false, error: 'Local master keychain not found'}));
            return;
          }
          const raw = fs.readFileSync(credPath, 'utf-8');
          const parsed = JSON.parse(raw) as {account_id?: string; public_key?: string};
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              ok: true,
              accountId: parsed.account_id || 'buddiesblitz.testnet',
              publicKey: parsed.public_key || '',
            }),
          );
        } catch (e) {
          res.statusCode = 200;
          res.end(JSON.stringify({ok: false, error: (e as Error).message}));
        }
      });

      server.middlewares.use('/api/near/spawn-subaccount', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ok: false, error: 'Method not allowed'}));
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}') as {prefix?: string};
            const cleanPrefix = (parsed.prefix || '')
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 24);
            if (!cleanPrefix) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ok: false, error: 'Invalid sub-account prefix'}));
              return;
            }
            const subAccountId = `${cleanPrefix}.buddiesblitz.testnet`;
            const masterPubKey = 'ed25519:4iZ3Q6wnahUGS9W2hQPruFeqQx5TngXdxNzesVTwtv48';
            execFile(
              'near',
              [
                'account',
                'create-account',
                'fund-myself',
                subAccountId,
                '0.1 NEAR',
                'use-manually-provided-public-key',
                masterPubKey,
                'sign-as',
                'buddiesblitz.testnet',
                'network-config',
                'testnet',
                'sign-with-legacy-keychain',
                'send',
              ],
              {timeout: 25000},
              (err, stdout, stderr) => {
                const combined = `${stdout || ''}\n${stderr || ''}`;
                const txMatch = combined.match(/Transaction ID:\s*([A-Za-z0-9]+)/);
                res.setHeader('Content-Type', 'application/json');
                if (err && !txMatch) {
                  res.statusCode = 200;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      subAccountId,
                      error: stderr || err.message,
                    }),
                  );
                  return;
                }
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    ok: true,
                    subAccountId,
                    txHash: txMatch ? txMatch[1] : null,
                  }),
                );
              },
            );
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ok: false, error: (e as Error).message}));
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), nearSubAccountProvisionerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/lucide-react')) {
              return 'vendor-ui';
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
