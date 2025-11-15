import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { getEnv } from '../config/env.js';
import { getLogger } from './logger.js';

const PRICE_KEY_PREFIX = 'price:';

let redis: Redis | null = null;
let redisReady = false;
let redisErrorLogged = false;

const getLoggerSafe = () => {
  try {
    return getLogger();
  } catch {
    return null;
  }
};

const log = (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => {
  const logger = getLoggerSafe();
  if (!logger) {
    return;
  }
  if (meta) {
    logger[level](meta, message);
  } else {
    logger[level](message);
  }
};

const shouldUseRedis = () => {
  try {
    return getEnv().REDIS_ENABLED;
  } catch {
    return false;
  }
};

const normaliseKey = (raw: string): string | null => {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const separatorIndex = trimmed.indexOf(':');
  if (separatorIndex === -1) {
    return `${PRICE_KEY_PREFIX}${trimmed.toUpperCase()}`;
  }
  const namespace = trimmed.slice(0, separatorIndex).toLowerCase();
  const symbol = trimmed.slice(separatorIndex + 1).toUpperCase();
  return `${PRICE_KEY_PREFIX}${namespace}:${symbol}`;
};

const getClient = () => {
  if (!redis || !redisReady) {
    return null;
  }
  return redis;
};

export const initializeRedis = async () => {
  const env = getEnv();
  if (!env.REDIS_ENABLED) {
    log('info', 'Redis cache désactivé (REDIS_ENABLED=false)');
    return;
  }
  if (redis) {
    return;
  }

  const options: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    connectTimeout: 3_000,
  };

  if (env.REDIS_PASSWORD) {
    options.password = env.REDIS_PASSWORD;
  }

  redis = new Redis(options);

  redis.on('connect', () => {
    redisReady = true;
    redisErrorLogged = false;
    log('info', 'Redis connecté', {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    });
  });

  redis.on('error', (error) => {
    redisReady = false;
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      log('warn', 'Erreur de connexion Redis', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  redis.on('end', () => {
    redisReady = false;
    log('warn', 'Connexion Redis fermée');
  });

  try {
    await redis.connect();
  } catch (error) {
    log('warn', "Impossible d'établir la connexion Redis. Le cache reste désactivé.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const toTtl = (ttl?: number) => {
  if (ttl && Number.isFinite(ttl) && ttl > 0) {
    return Math.floor(ttl);
  }
  const env = getEnv();
  return env.PRICE_CACHE_TTL;
};

export const cachePrice = async (key: string, price: number, ttlSeconds?: number) => {
  if (!shouldUseRedis() || !Number.isFinite(price)) {
    return;
  }
  const redisKey = normaliseKey(key);
  if (!redisKey) {
    return;
  }
  const client = getClient();
  if (!client) {
    return;
  }
  try {
    await client.setex(redisKey, toTtl(ttlSeconds), price.toString());
  } catch (error) {
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      log('warn', 'Echec de mise en cache Redis', {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const getCachedPrice = async (key: string): Promise<number | null> => {
  if (!shouldUseRedis()) {
    return null;
  }
  const redisKey = normaliseKey(key);
  if (!redisKey) {
    return null;
  }
  const client = getClient();
  if (!client) {
    return null;
  }
  try {
    const value = await client.get(redisKey);
    if (value === null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (error) {
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      log('warn', 'Echec de lecture dans le cache Redis', {
        key: redisKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
};

export const invalidatePriceCache = async (key: string) => {
  if (!shouldUseRedis()) {
    return;
  }
  const redisKey = normaliseKey(key);
  if (!redisKey) {
    return;
  }
  const client = getClient();
  if (!client) {
    return;
  }
  try {
    await client.del(redisKey);
  } catch (error) {
    log('warn', 'Echec de suppression du cache Redis', {
      key: redisKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const scanAndDelete = async (pattern: string) => {
  const client = getClient();
  if (!client) {
    return 0;
  }
  let cursor = '0';
  let deleted = 0;
  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
    cursor = nextCursor;
    if (keys.length > 0) {
      deleted += await client.del(...keys);
    }
  } while (cursor !== '0');
  return deleted;
};

export const invalidateAllPrices = async () => {
  if (!shouldUseRedis()) {
    return 0;
  }
  try {
    const removed = await scanAndDelete(`${PRICE_KEY_PREFIX}*`);
    log('info', 'Purge du cache Redis effectuée', { keysRemoved: removed });
    return removed;
  } catch (error) {
    log('warn', 'Echec de purge du cache Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};

export type CacheStats = {
  enabled: boolean;
  connected: boolean;
  keyCount: number;
  memoryUsage: string | null;
  host?: string;
  port?: number;
};

export const getCacheStats = async (): Promise<CacheStats> => {
  const env = getEnv();
  if (!env.REDIS_ENABLED) {
    return {
      enabled: false,
      connected: false,
      keyCount: 0,
      memoryUsage: null,
    };
  }
  const client = redis;
  if (!client) {
    return {
      enabled: true,
      connected: false,
      keyCount: 0,
      memoryUsage: null,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    };
  }
  try {
    const [keyCount, memoryInfo] = await Promise.all([client.dbsize(), client.info('memory')]);
    const memoryMatch = /used_memory_human:(.+)/.exec(memoryInfo);
    const memoryUsage = memoryMatch ? memoryMatch[1].split('\r')[0].trim() : null;
    return {
      enabled: true,
      connected: redisReady,
      keyCount,
      memoryUsage,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    };
  } catch (error) {
    log('warn', 'Echec de récupération des statistiques Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      enabled: true,
      connected: redisReady,
      keyCount: 0,
      memoryUsage: null,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    };
  }
};

export const closeRedis = async () => {
  if (!redis) {
    return;
  }
  try {
    await redis.quit();
  } catch (error) {
    log('warn', 'Echec lors de la fermeture de Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    redisReady = false;
    redis = null;
  }
};
