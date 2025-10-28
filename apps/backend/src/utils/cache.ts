import { Redis } from 'ioredis';
import { getEnv } from '../config/env.js';
import { getLogger } from './logger.js';

let redis: Redis | null = null;

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

    redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.info({ host: env.REDIS_HOST, port: env.REDIS_PORT }, 'Redis connected');
    });

    redis.on('error', (err: Error) => {
      logger.warn({ err }, 'Redis connection error - cache disabled');
    });

    // Connect in background
    redis.connect().catch((err: Error) => {
      logger.warn({ err }, 'Redis initial connection failed - cache disabled');
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
  if (!redis) return;

  try {
    const env = getEnv();
    const logger = getLogger();
    const cacheTtl = ttl || env.PRICE_CACHE_TTL;
    
    await redis.setex(`price:${symbol}`, cacheTtl, price.toString());
    logger.debug({ symbol, price, ttl: cacheTtl }, 'Price cached');
  } catch (error) {
    const logger = getLogger();
    logger.warn({ error, symbol }, 'Failed to cache price');
  }
};

/**
 * Get cached price for a symbol
 */
export const getCachedPrice = async (symbol: string): Promise<number | null> => {
  if (!redis) return null;

  try {
    const cached = await redis.get(`price:${symbol}`);
    if (cached) {
      const logger = getLogger();
      logger.debug({ symbol, price: cached }, 'Price retrieved from cache');
      return parseFloat(cached);
    }
    return null;
  } catch (error) {
    const logger = getLogger();
    logger.warn({ error, symbol }, 'Failed to get cached price');
    return null;
  }
};

/**
 * Invalidate (delete) cached price for a symbol
 */
export const invalidatePriceCache = async (symbol: string): Promise<void> => {
  if (!redis) return;

  try {
    const logger = getLogger();
    await redis.del(`price:${symbol}`);
    logger.debug({ symbol }, 'Price cache invalidated');
  } catch (error) {
    const logger = getLogger();
    logger.warn({ error, symbol }, 'Failed to invalidate price cache');
  }
};

/**
 * Invalidate all cached prices
 */
export const invalidateAllPrices = async (): Promise<void> => {
  if (!redis) return;

  try {
    const logger = getLogger();
    const keys = await redis.keys('price:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info({ count: keys.length }, 'All price caches invalidated');
    }
  } catch (error) {
    const logger = getLogger();
    logger.warn({ error }, 'Failed to invalidate all price caches');
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  connected: boolean;
  keys: number;
  memory?: string;
}> => {
  if (!redis) {
    return { connected: false, keys: 0 };
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
};
