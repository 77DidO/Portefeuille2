import { Redis, type RedisOptions } from 'ioredis';
import { getEnv } from '../config/env.js';
import { getLogger } from './logger.js';

type MemoryCacheEntry = {
  price: number;
  expiresAt: number;
};

let redis: Redis | null = null;
let redisErrorLogged = false; // Track if we've already logged the Redis error
const memoryCache = new Map<string, MemoryCacheEntry>();

const isRedisReady = () => redis?.status === 'ready';

const setMemoryCache = (symbol: string, price: number, ttl?: number) => {
  const env = getEnv();
  const cacheTtl = ttl || env.PRICE_CACHE_TTL;
  memoryCache.set(symbol, {
    price,
    expiresAt: Date.now() + cacheTtl * 1000,
  });
};

const getMemoryCache = (symbol: string): number | null => {
  const entry = memoryCache.get(symbol);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(symbol);
    return null;
  }
  return entry.price;
};

const clearMemoryCache = (symbol?: string) => {
  if (symbol) {
    memoryCache.delete(symbol);
  } else {
    memoryCache.clear();
  }
};

const getMemoryCacheSize = (): number => {
  const now = Date.now();
  let count = 0;
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt > now) {
      count += 1;
    } else {
      memoryCache.delete(key);
    }
  }
  return count;
};

/**
 * Initialize Redis connection
 */
export const initializeRedis = (): Redis | null => {
  try {
    const env = getEnv();
    const logger = getLogger();

    // Skip Redis if disabled in config
    if (env.REDIS_ENABLED === false) {
      logger.info('Redis disabled, cache will be skipped');
      return null;
    }

    const resolvedHost = env.REDIS_HOST === 'localhost' ? '127.0.0.1' : env.REDIS_HOST;
    const redisOptions: RedisOptions = {
      host: resolvedHost,
      port: env.REDIS_PORT,
      family: resolvedHost.includes(':') ? 6 : 4,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    };

    redis = new Redis(redisOptions);

    redis.on('connect', () => {
      logger.info({ host: resolvedHost, port: env.REDIS_PORT }, 'Redis connected');
      redisErrorLogged = false; // Reset error flag on successful connection
    });

    redis.on('error', (err: Error) => {
      // Only log the error once to avoid spam
      if (!redisErrorLogged) {
        logger.warn({ err }, 'Redis connection error - cache disabled (further errors will be suppressed)');
        redisErrorLogged = true;
      }
    });

    // Connect in background
    redis.connect().catch((err: Error) => {
      if (!redisErrorLogged) {
        logger.warn({ err }, 'Redis initial connection failed - cache disabled');
        redisErrorLogged = true;
      }
    });

    return redis;
  } catch (error) {
    const logger = getLogger();
    logger.warn({ error }, 'Redis initialization failed - continuing without cache');
    return null;
  }
};

/**
 * Get Redis client (can be null if disabled or unavailable)
 */
export const getRedis = (): Redis | null => {
  return redis;
};

/**
 * Cache a price for a given symbol
 */
export const cachePrice = async (
  symbol: string,
  price: number,
  ttl?: number
): Promise<void> => {
  const logger = getLogger();
  try {
    if (redis && isRedisReady()) {
      const env = getEnv();
      const cacheTtl = ttl || env.PRICE_CACHE_TTL;
      await redis.setex(`price:${symbol}`, cacheTtl, price.toString());
      logger.debug({ symbol, price, ttl: cacheTtl }, 'Price cached');
    } else if (redis && !isRedisReady() && !redisErrorLogged) {
      logger.info('Redis indisponible, bascule sur cache mémoire uniquement');
      redisErrorLogged = true;
    }
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      symbol
    }, 'Failed to cache price');
  } finally {
    setMemoryCache(symbol, price, ttl);
  }
};

/**
 * Get cached price for a symbol
 */
export const getCachedPrice = async (symbol: string): Promise<number | null> => {
  try {
    if (redis && isRedisReady()) {
      const cached = await redis.get(`price:${symbol}`);
      if (cached) {
        const logger = getLogger();
        logger.debug({ symbol, price: cached }, 'Price retrieved from cache');
        setMemoryCache(symbol, parseFloat(cached)); // refresh fallback TTL
        return parseFloat(cached);
      }
    } else if (redis && !isRedisReady() && !redisErrorLogged) {
      const logger = getLogger();
      logger.info({ symbol }, 'Redis indisponible, lecture du cache mémoire');
      redisErrorLogged = true;
    }
  } catch (error) {
    const logger = getLogger();
    logger.warn({
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      symbol
    }, 'Failed to get cached price');
  }
  return getMemoryCache(symbol);
};

/**
 * Invalidate (delete) cached price for a symbol
 */
export const invalidatePriceCache = async (symbol: string): Promise<void> => {
  try {
    if (redis && isRedisReady()) {
      const logger = getLogger();
      await redis.del(`price:${symbol}`);
      logger.debug({ symbol }, 'Price cache invalidated');
    }
  } catch (error) {
    const logger = getLogger();
    logger.warn({ error, symbol }, 'Failed to invalidate price cache');
  }
  clearMemoryCache(symbol);
};

/**
 * Invalidate all cached prices
 */
export const invalidateAllPrices = async (): Promise<void> => {
  try {
    if (redis && isRedisReady()) {
      const logger = getLogger();
      const keys = await redis.keys('price:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info({ count: keys.length }, 'All price caches invalidated');
      }
    }
  } catch (error) {
    const logger = getLogger();
    logger.warn({ error }, 'Failed to invalidate all price caches');
  }
  clearMemoryCache();
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  connected: boolean;
  keys: number;
  memory?: string;
}> => {
  if (!redis || !isRedisReady()) {
    return {
      connected: false,
      keys: getMemoryCacheSize(),
      memory: 'in-memory',
    };
  }

  try {
    const keys = await redis.keys('price:*');
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    
    return {
      connected: redis.status === 'ready',
      keys: keys.length,
      memory: memoryMatch ? memoryMatch[1].trim() : undefined,
    };
  } catch (error) {
    return { connected: false, keys: 0 };
  }
};

/**
 * Close Redis connection (for graceful shutdown)
 */
export const closeRedis = async (): Promise<void> => {
  if (redis) {
    const logger = getLogger();
    logger.info('Closing Redis connection');
    await redis.quit();
    redis = null;
  }
  clearMemoryCache();
};
