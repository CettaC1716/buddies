import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execFile} from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function fromBase58(str: string): Buffer {
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const val = BASE58_ALPHABET.indexOf(str[i]);
    if (val < 0) throw new Error('Invalid base58');
    let carry = val;
    for (let j = 0; j < bytes.length; ++j) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let k = 0; str[k] === '1' && k < str.length - 1; ++k) bytes.push(0);
  return Buffer.from(bytes.reverse());
}

function borshString(str: string): Buffer {
  const buf = Buffer.from(str, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

function borshU64(n: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(n, 0);
  return buf;
}

function borshU128(n: bigint): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(n & 0xffffffffffffffffn, 0);
  buf.writeBigUInt64LE(n >> 64n, 8);
  return buf;
}

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

      server.middlewares.use('/api/near/market-call', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ok: false, error: 'Method not allowed'}));
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const parsed = JSON.parse(body || '{}') as {
              methodName?: string;
              args?: Record<string, unknown>;
            };
            const allowedMethods = new Set([
              'mint_fish_nft',
              'list_fish_nft',
              'buy_fish_nft',
              'purchase_citizen_asset',
              'swap_near_for_respite',
            ]);
            const methodName = parsed.methodName || 'mint_fish_nft';
            if (!allowedMethods.has(methodName)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ok: false, error: 'Unsupported contract method'}));
              return;
            }
            const credPath = path.join(
              os.homedir(),
              '.near-credentials',
              'testnet',
              'market.buddiesblitz.testnet.json',
            );
            const fallbackCredPath = path.join(
              os.homedir(),
              '.near-credentials',
              'testnet',
              'buddiesblitz.testnet.json',
            );
            const targetCred = fs.existsSync(credPath) ? credPath : fallbackCredPath;
            if (!fs.existsSync(targetCred)) {
              res.statusCode = 200;
              res.end(JSON.stringify({ok: false, error: 'Local NEAR credentials not found'}));
              return;
            }
            const creds = JSON.parse(fs.readFileSync(targetCred, 'utf8')) as {
              private_key: string;
              public_key: string;
            };
            const rawPriv = fromBase58(creds.private_key.replace('ed25519:', ''));
            const seed32 = rawPriv.subarray(0, 32);
            const rawPub = fromBase58(creds.public_key.replace('ed25519:', ''));

            const akRes = await fetch('https://rpc.testnet.near.org', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'ak',
                method: 'query',
                params: {
                  request_type: 'view_access_key',
                  finality: 'final',
                  account_id: 'buddiesblitz.testnet',
                  public_key: creds.public_key,
                },
              }),
            });
            const akJson = (await akRes.json()) as {
              result?: {nonce: number; block_hash: string};
            };
            if (!akJson.result) {
              res.statusCode = 200;
              res.end(JSON.stringify({ok: false, error: 'Access key lookup failed'}));
              return;
            }
            const nextNonce = BigInt(akJson.result.nonce) + 1n;
            const blockHashBytes = fromBase58(akJson.result.block_hash);

            const argsBuf = Buffer.from(JSON.stringify(parsed.args || {}), 'utf8');
            const argsLen = Buffer.alloc(4);
            argsLen.writeUInt32LE(argsBuf.length, 0);
            const fnAction = Buffer.concat([
              Buffer.from([2]),
              borshString(methodName),
              argsLen,
              argsBuf,
              borshU64(30000000000000n),
              borshU128(0n),
            ]);
            const actionsLen = Buffer.alloc(4);
            actionsLen.writeUInt32LE(1, 0);

            const txBytes = Buffer.concat([
              borshString('buddiesblitz.testnet'),
              Buffer.from([0]),
              rawPub,
              borshU64(nextNonce),
              borshString('market.buddiesblitz.testnet'),
              blockHashBytes,
              actionsLen,
              fnAction,
            ]);
            const txHash = crypto.createHash('sha256').update(txBytes).digest();
            const privKeyObj = crypto.createPrivateKey({
              key: Buffer.concat([
                Buffer.from('302e020100300506032b657004220420', 'hex'),
                seed32,
              ]),
              format: 'der',
              type: 'pkcs8',
            });
            const sig = crypto.sign(null, txHash, privKeyObj);
            const signedTx = Buffer.concat([txBytes, Buffer.from([0]), sig]);

            const txRes = await fetch('https://rpc.testnet.near.org', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'tx',
                method: 'broadcast_tx_commit',
                params: [signedTx.toString('base64')],
              }),
            });
            const txJson = (await txRes.json()) as {
              result?: {
                transaction?: {hash?: string};
                receipts_outcome?: Array<{outcome: {logs: string[]}}>;
              };
            };
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                ok: Boolean(txJson.result?.transaction?.hash),
                contractId: 'market.buddiesblitz.testnet',
                methodName,
                txHash: txJson.result?.transaction?.hash || null,
                logs: txJson.result?.receipts_outcome?.flatMap((r) => r.outcome.logs) || [],
              }),
            );
          } catch (e) {
            res.statusCode = 200;
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
