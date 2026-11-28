import type { RealtimeChannel } from '@supabase/supabase-js';
import { resolveApiUrl } from './nearClient';
import { supabase } from './supabaseClient';

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

export const CITY_FEED_STORAGE_KEY = 'bb_city_feed_posts_v1';
export const CITY_FEED_UPDATED_EVENT = 'bb-city-feed-updated';

type CityFeedBroadcastEvent =
  | { type: 'publish'; post: CityFeedPost }
  | { type: 'toggle_like'; postId: string; actorId: string }
  | { type: 'comment'; postId: string; comment: CityFeedComment }
  | { type: 'delete'; postId: string; actorId: string };

let activeCityFeedChannel: RealtimeChannel | null = null;
let isCityFeedChannelSubscribed = false;

export function readCachedCityFeedPosts(): CityFeedPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CITY_FEED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CityFeedPost => Boolean(item && typeof item === 'object' && item.id && item.text))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch {
    return [];
  }
}

export function writeCachedCityFeedPosts(posts: CityFeedPost[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...posts].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, 80);
    window.localStorage.setItem(CITY_FEED_STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // ignore storage quota errors
  }
}

export function mergeCityFeedPosts(base: CityFeedPost[], incoming: CityFeedPost[]): CityFeedPost[] {
  const map = new Map<string, CityFeedPost>();
  for (const post of base) {
    if (post && post.id) map.set(post.id, post);
  }
  for (const post of incoming) {
    if (!post || !post.id) continue;
    const prev = map.get(post.id);
    if (!prev) {
      map.set(post.id, post);
    } else {
      // Preserve richer comment/like union if updated from concurrent sources
      const commentMap = new Map<string, CityFeedComment>();
      for (const c of prev.comments || []) commentMap.set(c.id, c);
      for (const c of post.comments || []) commentMap.set(c.id, c);
      map.set(post.id, {
        ...prev,
        ...post,
        likedByIds: post.likedByIds ?? prev.likedByIds ?? [],
        comments: Array.from(commentMap.values()).sort((a, b) => a.createdAtMs - b.createdAtMs),
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, 80);
}

function broadcastCityFeedEvent(ev: CityFeedBroadcastEvent): void {
  if (!supabase || !activeCityFeedChannel || !isCityFeedChannelSubscribed) return;
  try {
    void activeCityFeedChannel.send({
      type: 'broadcast',
      event: 'city_feed_event',
      payload: ev,
    });
  } catch {
    // ignore broadcast error
  }
}

function emitLocalFeedUpdate(posts: CityFeedPost[]): void {
  writeCachedCityFeedPosts(posts);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CITY_FEED_UPDATED_EVENT, { detail: posts }));
  }
}

export function subscribeToCityFeedRealtime(
  onEvent: (ev: CityFeedBroadcastEvent) => void,
): () => void {
  if (!supabase) return () => {};
  try {
    if (activeCityFeedChannel) {
      void activeCityFeedChannel.unsubscribe();
      activeCityFeedChannel = null;
      isCityFeedChannelSubscribed = false;
    }
    const channel = supabase
      .channel('bb_city_feed_live', {
        config: {
          broadcast: { self: false, ack: false },
        },
      })
      .on('broadcast', { event: 'city_feed_event' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object') return;
        const ev = payload as CityFeedBroadcastEvent;
        if (ev.type === 'publish' && ev.post?.id) {
          const next = mergeCityFeedPosts(readCachedCityFeedPosts(), [ev.post]);
          emitLocalFeedUpdate(next);
          onEvent(ev);
        } else if (ev.type === 'toggle_like' && ev.postId && ev.actorId) {
          const next = readCachedCityFeedPosts().map((p) => {
            if (p.id !== ev.postId) return p;
            const liked = p.likedByIds.includes(ev.actorId);
            return {
              ...p,
              likedByIds: liked
                ? p.likedByIds.filter((id) => id !== ev.actorId)
                : [...p.likedByIds, ev.actorId],
            };
          });
          emitLocalFeedUpdate(next);
          onEvent(ev);
        } else if (ev.type === 'comment' && ev.postId && ev.comment?.id) {
          const next = readCachedCityFeedPosts().map((p) => {
            if (p.id !== ev.postId) return p;
            if (p.comments.some((c) => c.id === ev.comment.id)) return p;
            return {
              ...p,
              comments: [...p.comments, ev.comment],
            };
          });
          emitLocalFeedUpdate(next);
          onEvent(ev);
        } else if (ev.type === 'delete' && ev.postId) {
          const next = readCachedCityFeedPosts().filter((p) => p.id !== ev.postId);
          emitLocalFeedUpdate(next);
          onEvent(ev);
        }
      })
      .subscribe((status) => {
        if (activeCityFeedChannel === channel) {
          isCityFeedChannelSubscribed = status === 'SUBSCRIBED';
        }
      });
    activeCityFeedChannel = channel;
    return () => {
      if (activeCityFeedChannel === channel) {
        activeCityFeedChannel = null;
        isCityFeedChannelSubscribed = false;
      }
      void channel.unsubscribe();
    };
  } catch {
    return () => {};
  }
}

export async function fetchCityFeedPosts(): Promise<CityFeedPost[]> {
  const cached = readCachedCityFeedPosts();
  try {
    const resp = await fetch(resolveApiUrl('/api/city-feed'));
    if (!resp.ok) return cached;
    const data = (await resp.json()) as { ok?: boolean; posts?: CityFeedPost[] };
    if (data?.ok && Array.isArray(data.posts)) {
      const merged = mergeCityFeedPosts(cached, data.posts);
      writeCachedCityFeedPosts(merged);
      return merged;
    }
  } catch {
    // Fallback to local cached posts when offline
  }
  return cached;
}

export async function publishCityFeedPost(post: CityFeedPost): Promise<CityFeedPost[]> {
  const optimistic = mergeCityFeedPosts(readCachedCityFeedPosts(), [post]);
  emitLocalFeedUpdate(optimistic);
  broadcastCityFeedEvent({ type: 'publish', post });

  try {
    const resp = await fetch(resolveApiUrl('/api/city-feed'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish', post }),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { ok?: boolean; posts?: CityFeedPost[] };
      if (data?.ok && Array.isArray(data.posts)) {
        const merged = mergeCityFeedPosts(optimistic, data.posts);
        emitLocalFeedUpdate(merged);
        return merged;
      }
    }
  } catch {
    // keep optimistic local state
  }
  return optimistic;
}

export async function toggleLikeCityFeedPost(
  postId: string,
  actorId: string,
): Promise<CityFeedPost[]> {
  const optimistic = readCachedCityFeedPosts().map((p) => {
    if (p.id !== postId) return p;
    const liked = p.likedByIds.includes(actorId);
    return {
      ...p,
      likedByIds: liked
        ? p.likedByIds.filter((id) => id !== actorId)
        : [...p.likedByIds, actorId],
    };
  });
  emitLocalFeedUpdate(optimistic);
  broadcastCityFeedEvent({ type: 'toggle_like', postId, actorId });

  try {
    const resp = await fetch(resolveApiUrl('/api/city-feed'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_like', postId, actorId }),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { ok?: boolean; posts?: CityFeedPost[] };
      if (data?.ok && Array.isArray(data.posts)) {
        const merged = mergeCityFeedPosts(optimistic, data.posts);
        emitLocalFeedUpdate(merged);
        return merged;
      }
    }
  } catch {
    // keep optimistic local state
  }
  return optimistic;
}

export async function commentCityFeedPost(
  postId: string,
  comment: CityFeedComment,
): Promise<CityFeedPost[]> {
  const optimistic = readCachedCityFeedPosts().map((p) => {
    if (p.id !== postId) return p;
    if (p.comments.some((c) => c.id === comment.id)) return p;
    return { ...p, comments: [...p.comments, comment] };
  });
  emitLocalFeedUpdate(optimistic);
  broadcastCityFeedEvent({ type: 'comment', postId, comment });

  try {
    const resp = await fetch(resolveApiUrl('/api/city-feed'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', postId, comment }),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { ok?: boolean; posts?: CityFeedPost[] };
      if (data?.ok && Array.isArray(data.posts)) {
        const merged = mergeCityFeedPosts(optimistic, data.posts);
        emitLocalFeedUpdate(merged);
        return merged;
      }
    }
  } catch {
    // keep optimistic local state
  }
  return optimistic;
}

export async function deleteCityFeedPost(
  postId: string,
  actorId: string,
): Promise<CityFeedPost[]> {
  if (typeof window !== 'undefined') {
    try {
      const rawStatusFeed = window.localStorage.getItem('bb_player_status_feed_v1');
      if (rawStatusFeed) {
        const parsed = JSON.parse(rawStatusFeed);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((item) => item && item.id !== postId);
          if (filtered.length !== parsed.length) {
            window.localStorage.setItem('bb_player_status_feed_v1', JSON.stringify(filtered));
          }
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }
  const optimistic = readCachedCityFeedPosts().filter((p) => p.id !== postId);
  emitLocalFeedUpdate(optimistic);
  broadcastCityFeedEvent({ type: 'delete', postId, actorId });

  try {
    const resp = await fetch(resolveApiUrl('/api/city-feed'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', postId, actorId }),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { ok?: boolean; posts?: CityFeedPost[] };
      if (data?.ok && Array.isArray(data.posts)) {
        writeCachedCityFeedPosts(data.posts);
        return data.posts;
      }
    }
  } catch {
    // keep optimistic local state
  }
  return optimistic;
}
