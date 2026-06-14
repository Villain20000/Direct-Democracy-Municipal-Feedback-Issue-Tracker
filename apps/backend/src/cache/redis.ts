import Redis from 'ioredis';
import { config } from '../config';

const memoryStore = new Map<string, { value: string; expiresAt: number }>();

let redis: Redis | null = null;
let redisAvailable = false;

function getRedis(): Redis | null {
  if (!config.redis.enabled) return null;
  if (redis) return redis;

  try {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 2000,
    });
    redis.on('error', () => { redisAvailable = false; });
    redis.connect().then(() => { redisAvailable = true; }).catch(() => { redisAvailable = false; });
    return redis;
  } catch {
    return null;
  }
}

function memoryGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedis();
    if (client && redisAvailable) {
      try {
        const raw = await client.get(key);
        return raw ? JSON.parse(raw) as T : null;
      } catch { /* fall through */ }
    }
    const raw = memoryGet(key);
    return raw ? JSON.parse(raw) as T : null;
  },

  async set(key: string, value: unknown, ttlSeconds = 300) {
    const serialized = JSON.stringify(value);
    const client = getRedis();
    if (client && redisAvailable) {
      try {
        await client.setex(key, ttlSeconds, serialized);
        return;
      } catch { /* fall through */ }
    }
    memorySet(key, serialized, ttlSeconds);
  },

  async del(key: string) {
    const client = getRedis();
    if (client && redisAvailable) {
      try { await client.del(key); } catch { /* ignore */ }
    }
    memoryStore.delete(key);
  },

  async invalidatePattern(pattern: string) {
    const client = getRedis();
    if (client && redisAvailable) {
      try {
        const keys = await client.keys(pattern);
        if (keys.length) await client.del(...keys);
      } catch { /* ignore */ }
    }
    for (const key of memoryStore.keys()) {
      if (key.includes(pattern.replace('*', ''))) memoryStore.delete(key);
    }
  },
};