import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

const PUBLIC_ASSETS_DIR = path.resolve(import.meta.dirname, '..', 'public', 'assets');
const ASSETS_CACHE_DIR = path.resolve(os.tmpdir(), 'buddies_assets_cache');
const REMOTE_ASSETS_BASE_URL = (
  process.env.REMOTE_ASSETS_BASE_URL ||
  'https://raw.githubusercontent.com/CettaC1716/buddies/main/public/assets'
).replace(/\/+$/, '');

const MAX_CONCURRENT_UPSTREAM = 8;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: MAX_CONCURRENT_UPSTREAM,
  maxFreeSockets: MAX_CONCURRENT_UPSTREAM,
  family: 4,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: MAX_CONCURRENT_UPSTREAM,
  maxFreeSockets: MAX_CONCURRENT_UPSTREAM,
  family: 4,
});

const ASSET_MIME_BY_EXT: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ktx2': 'image/ktx2',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8',
};

const inFlightAssetDownloads = new Map<string, Promise<number>>();
const waitingQueue: Array<() => void> = [];
let activeUpstreamCount = 0;

function acquireUpstreamSlot(): Promise<void> {
  if (activeUpstreamCount < MAX_CONCURRENT_UPSTREAM) {
    activeUpstreamCount += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitingQueue.push(() => {
      activeUpstreamCount += 1;
      resolve();
    });
  });
}

function releaseUpstreamSlot(): void {
  activeUpstreamCount = Math.max(0, activeUpstreamCount - 1);
  const next = waitingQueue.shift();
  if (next) next();
}

function downloadUrlBuffer(
  urlStr: string,
  redirectsLeft = 3,
): Promise<{ status: number; buffer?: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.get(
      parsed,
      {
        agent: isHttps ? httpsAgent : httpAgent,
        headers: {
          'User-Agent': 'Cerria-AssetProxy/1.0',
          Accept: '*/*',
        },
      },
      (res) => {
        const status = res.statusCode ?? 502;
        if (
          (status === 301 || status === 302 || status === 307 || status === 308) &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          const nextUrl = new URL(res.headers.location, parsed).toString();
          downloadUrlBuffer(nextUrl, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          resolve({ status });
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ status: 200, buffer: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Upstream timeout after ${REQUEST_TIMEOUT_MS}ms for ${urlStr}`));
    });
    req.on('error', reject);
  });
}

async function fetchAndCacheRemoteAsset(relPath: string, cacheFilePath: string): Promise<number> {
  const existing = inFlightAssetDownloads.get(relPath);
  if (existing) return existing;

  const task = (async () => {
    const encodedPath = relPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const targetUrl = `${REMOTE_ASSETS_BASE_URL}/${encodedPath}`;

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      await acquireUpstreamSlot();
      try {
        const { status, buffer } = await downloadUrlBuffer(targetUrl);
        if (status === 200 && buffer) {
          await fsp.mkdir(path.dirname(cacheFilePath), { recursive: true });
          const tmpPath = `${cacheFilePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
          await fsp.writeFile(tmpPath, buffer);
          await fsp.rename(tmpPath, cacheFilePath);
          return 200;
        }
        if (status === 404 || status === 400 || status === 403) {
          return status;
        }
        lastErr = new Error(`Upstream HTTP ${status}`);
      } catch (err) {
        lastErr = err;
      } finally {
        releaseUpstreamSlot();
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 300 * attempt * attempt));
      }
    }

    throw lastErr ?? new Error(`Failed to fetch ${relPath}`);
  })().finally(() => {
    inFlightAssetDownloads.delete(relPath);
  });

  inFlightAssetDownloads.set(relPath, task);
  return task;
}

export function createRemoteAssetsProxyMiddleware(options?: { stripPrefix?: boolean }) {
  const stripPrefix = options?.stripPrefix ?? true;

  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '/';
    const urlPath = rawUrl.split('?')[0] || '/';

    let relRaw: string;
    if (stripPrefix) {
      if (!urlPath.startsWith('/assets/')) {
        next();
        return;
      }
      relRaw = urlPath.slice('/assets/'.length);
    } else {
      relRaw = urlPath.replace(/^\/+/, '');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    let decodedRelPath: string;
    try {
      decodedRelPath = decodeURIComponent(relRaw).replace(/^\/+/, '');
    } catch {
      res.statusCode = 400;
      res.end();
      return;
    }

    if (!decodedRelPath || decodedRelPath.includes('..') || decodedRelPath.includes('\0')) {
      next();
      return;
    }

    const localPublicCandidate = path.resolve(PUBLIC_ASSETS_DIR, decodedRelPath);
    if (
      localPublicCandidate.startsWith(PUBLIC_ASSETS_DIR + path.sep) &&
      fs.existsSync(localPublicCandidate) &&
      fs.statSync(localPublicCandidate).isFile()
    ) {
      next();
      return;
    }

    const cacheFilePath = path.resolve(ASSETS_CACHE_DIR, decodedRelPath);
    if (!cacheFilePath.startsWith(ASSETS_CACHE_DIR + path.sep)) {
      res.statusCode = 400;
      res.end();
      return;
    }

    const streamCachedFile = () => {
      try {
        const stat = fs.statSync(cacheFilePath);
        const ext = path.extname(cacheFilePath).toLowerCase();
        const contentType = ASSET_MIME_BY_EXT[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        const rangeHeader = req.headers.range;
        if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
          const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
          const start = startStr ? parseInt(startStr, 10) : 0;
          const end = endStr ? Math.min(parseInt(endStr, 10), stat.size - 1) : stat.size - 1;
          if (start >= 0 && start <= end && end < stat.size) {
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', String(end - start + 1));
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            fs.createReadStream(cacheFilePath, { start, end }).pipe(res);
            return;
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-Length', String(stat.size));
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(cacheFilePath).pipe(res);
      } catch {
        if (!res.writableEnded) {
          next();
        }
      }
    };

    if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).isFile()) {
      streamCachedFile();
      return;
    }

    void fetchAndCacheRemoteAsset(decodedRelPath, cacheFilePath)
      .then((status) => {
        if (res.writableEnded) return;
        if (status === 200) {
          streamCachedFile();
        } else if (status === 404) {
          next();
        } else {
          res.statusCode = status;
          res.end();
        }
      })
      .catch((err) => {
        console.warn(`[Cerria] Remote asset proxy failed for ${decodedRelPath}:`, err);
        if (!res.writableEnded) {
          res.statusCode = 502;
          res.end();
        }
      });
  };
}

export default function handler(_req: any, res: any): void {
  res.status(404).json({ ok: false, error: 'Not Found' });
}
