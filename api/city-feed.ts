import fs from 'node:fs/promises';
import path from 'node:path';

export interface CityFeedComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  createdAtMs: number;
}

export interface CityFeedPost {
  id: string;
  authorId: string;
  authorNearAccount?: string | null;
  authorName: string;
  authorAvatarUrl?: string;
  authorTeam: 'blue' | 'red';
  authorGender: 'male' | 'female';
  text: string;
  mood?: string;
  location?: string;
  photoUrl?: string;
  createdAtMs: number;
  likedByIds: string[];
  comments: CityFeedComment[];
}

const STORE_FILE_PATH = path.join('/tmp', 'buddies_city_feed_v1.json');
const MAX_FEED_POSTS = 80;
const MAX_COMMENTS_PER_POST = 30;

let loadedFromDisk = false;
let memoryPosts: CityFeedPost[] = [];

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function sanitizePhotoUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/docs/')) {
    return trimmed.slice(0, 260);
  }
  if (trimmed.startsWith('data:image/') && trimmed.length <= 360_000) {
    return trimmed;
  }
  return undefined;
}

function normalizePost(raw: unknown): CityFeedPost | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = sanitizeText(obj.id, 96);
  const authorId = sanitizeText(obj.authorId, 96);
  const authorName = sanitizeText(obj.authorName, 48);
  const text = sanitizeText(obj.text, 220);
  if (!id || !authorId || !authorName || !text) return null;

  const likedByIds = Array.isArray(obj.likedByIds)
    ? Array.from(
        new Set(
          obj.likedByIds
            .map((v) => sanitizeText(v, 96))
            .filter(Boolean),
        ),
      ).slice(0, 500)
    : [];

  const comments: CityFeedComment[] = Array.isArray(obj.comments)
    ? obj.comments
        .map((c): CityFeedComment | null => {
          if (!c || typeof c !== 'object') return null;
          const co = c as Record<string, unknown>;
          const cid = sanitizeText(co.id, 96);
          const caid = sanitizeText(co.authorId, 96);
          const cname = sanitizeText(co.authorName, 48);
          const ctext = sanitizeText(co.text, 160);
          if (!cid || !caid || !cname || !ctext) return null;
          return {
            id: cid,
            authorId: caid,
            authorName: cname,
            authorAvatarUrl: sanitizePhotoUrl(co.authorAvatarUrl),
            text: ctext,
            createdAtMs:
              typeof co.createdAtMs === 'number' && Number.isFinite(co.createdAtMs)
                ? co.createdAtMs
                : Date.now(),
          };
        })
        .filter((x): x is CityFeedComment => x !== null)
        .slice(-MAX_COMMENTS_PER_POST)
    : [];

  return {
    id,
    authorId,
    authorNearAccount:
      typeof obj.authorNearAccount === 'string'
        ? sanitizeText(obj.authorNearAccount, 64) || null
        : null,
    authorName,
    authorAvatarUrl: sanitizePhotoUrl(obj.authorAvatarUrl),
    authorTeam: obj.authorTeam === 'red' ? 'red' : 'blue',
    authorGender: obj.authorGender === 'female' ? 'female' : 'male',
    text,
    mood: sanitizeText(obj.mood, 24) || undefined,
    location: sanitizeText(obj.location, 48) || undefined,
    photoUrl: sanitizePhotoUrl(obj.photoUrl),
    createdAtMs:
      typeof obj.createdAtMs === 'number' && Number.isFinite(obj.createdAtMs)
        ? obj.createdAtMs
        : Date.now(),
    likedByIds,
    comments,
  };
}

async function ensureLoaded(): Promise<void> {
  if (loadedFromDisk) return;
  loadedFromDisk = true;
  try {
    const raw = await fs.readFile(STORE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryPosts = parsed
        .map(normalizePost)
        .filter((p): p is CityFeedPost => p !== null)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, MAX_FEED_POSTS);
    }
  } catch {
    memoryPosts = [];
  }
}

async function persistToDisk(): Promise<void> {
  try {
    await fs.writeFile(STORE_FILE_PATH, JSON.stringify(memoryPosts), 'utf8');
  } catch {
    // Non-fatal in ephemeral containers
  }
}

export async function handleCityFeedGetRequest(): Promise<{
  status: number;
  payload: { ok: boolean; posts: CityFeedPost[] };
}> {
  await ensureLoaded();
  return {
    status: 200,
    payload: {
      ok: true,
      posts: [...memoryPosts].sort((a, b) => b.createdAtMs - a.createdAtMs),
    },
  };
}

export async function handleCityFeedActionRequest(
  body: Record<string, unknown>,
): Promise<{ status: number; payload: unknown }> {
  await ensureLoaded();
  const action = sanitizeText(body.action, 32);

  if (action === 'publish') {
    const candidate = normalizePost(body.post);
    if (!candidate) {
      return { status: 400, payload: { ok: false, error: 'Invalid post payload' } };
    }
    const existingIdx = memoryPosts.findIndex((p) => p.id === candidate.id);
    if (existingIdx >= 0) {
      memoryPosts[existingIdx] = candidate;
    } else {
      memoryPosts = [candidate, ...memoryPosts]
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, MAX_FEED_POSTS);
    }
    await persistToDisk();
    return { status: 200, payload: { ok: true, post: candidate, posts: memoryPosts } };
  }

  if (action === 'toggle_like') {
    const postId = sanitizeText(body.postId, 96);
    const actorId = sanitizeText(body.actorId, 96);
    if (!postId || !actorId) {
      return { status: 400, payload: { ok: false, error: 'Missing postId or actorId' } };
    }
    const post = memoryPosts.find((p) => p.id === postId);
    if (!post) {
      return { status: 404, payload: { ok: false, error: 'Post not found' } };
    }
    const hasLiked = post.likedByIds.includes(actorId);
    post.likedByIds = hasLiked
      ? post.likedByIds.filter((id) => id !== actorId)
      : [...post.likedByIds, actorId];
    await persistToDisk();
    return { status: 200, payload: { ok: true, post, posts: memoryPosts } };
  }

  if (action === 'comment') {
    const postId = sanitizeText(body.postId, 96);
    const rawComment = body.comment as Record<string, unknown> | undefined;
    if (!postId || !rawComment || typeof rawComment !== 'object') {
      return { status: 400, payload: { ok: false, error: 'Invalid comment payload' } };
    }
    const post = memoryPosts.find((p) => p.id === postId);
    if (!post) {
      return { status: 404, payload: { ok: false, error: 'Post not found' } };
    }
    const cid = sanitizeText(rawComment.id, 96) || `cmt-${Date.now().toString(36)}`;
    const authorId = sanitizeText(rawComment.authorId, 96);
    const authorName = sanitizeText(rawComment.authorName, 48);
    const text = sanitizeText(rawComment.text, 160);
    if (!authorId || !authorName || !text) {
      return { status: 400, payload: { ok: false, error: 'Comment text required' } };
    }
    if (!post.comments.some((c) => c.id === cid)) {
      post.comments = [
        ...post.comments,
        {
          id: cid,
          authorId,
          authorName,
          authorAvatarUrl: sanitizePhotoUrl(rawComment.authorAvatarUrl),
          text,
          createdAtMs:
            typeof rawComment.createdAtMs === 'number' && Number.isFinite(rawComment.createdAtMs)
              ? rawComment.createdAtMs
              : Date.now(),
        },
      ].slice(-MAX_COMMENTS_PER_POST);
      await persistToDisk();
    }
    return { status: 200, payload: { ok: true, post, posts: memoryPosts } };
  }

  if (action === 'delete') {
    const postId = sanitizeText(body.postId, 96);
    const actorId = sanitizeText(body.actorId, 96);
    if (!postId || !actorId) {
      return { status: 400, payload: { ok: false, error: 'Missing postId or actorId' } };
    }
    const target = memoryPosts.find((p) => p.id === postId);
    if (!target) {
      return { status: 200, payload: { ok: true, posts: memoryPosts } };
    }
    const matchesAuthor =
      target.authorId.toLowerCase() === actorId.toLowerCase() ||
      (target.authorNearAccount &&
        target.authorNearAccount.toLowerCase() === actorId.toLowerCase());
    if (!matchesAuthor) {
      return { status: 403, payload: { ok: false, error: 'Forbidden' } };
    }
    memoryPosts = memoryPosts.filter((p) => p.id !== postId);
    await persistToDisk();
    return { status: 200, payload: { ok: true, posts: memoryPosts } };
  }

  return { status: 400, payload: { ok: false, error: 'Unsupported city-feed action' } };
}

const CITY_FEED_ALLOWED_ORIGINS = [
  'https://cettac1716.github.io',
  'https://buddies-rouge.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req: any, res: any): Promise<void> {
  const requestOrigin = String(req.headers?.origin || '');
  if (CITY_FEED_ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method === 'GET') {
    const result = await handleCityFeedGetRequest();
    res.status(result.status).json(result.payload);
    return;
  }
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const result = await handleCityFeedActionRequest(body);
    res.status(result.status).json(result.payload);
    return;
  }
  res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}
