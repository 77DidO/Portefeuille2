import { Router } from 'express';
import { resetData } from '../services/systemService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getCacheStats, invalidateAllPrices, invalidatePriceCache } from '../utils/cache.js';
import { getLogger } from '../utils/logger.js';

const router = Router();

// Les rate limiters sont créés à la demande pour éviter l'initialisation précoce
const applyRateLimiter = (limiterName: 'api' | 'critical') => {
  return asyncHandler(async (req, res, next) => {
    try {
      const { createApiLimiter, createCriticalLimiter } = await import('../middleware/rateLimiter.js');
      const limiter = limiterName === 'api' ? createApiLimiter() : createCriticalLimiter();
      limiter(req, res, next);
    } catch (error) {
      next(error);
    }
  });
};

router.delete('/data', applyRateLimiter('critical'), asyncHandler(async (_req, res) => {
  await resetData();
  res.status(204).send();
}));

// Cache management endpoints
router.get('/cache/stats', applyRateLimiter('api'), asyncHandler(async (_req, res) => {
  const stats = await getCacheStats();
  res.json(stats);
}));

router.delete('/cache', applyRateLimiter('critical'), asyncHandler(async (_req, res) => {
  const logger = getLogger();
  await invalidateAllPrices();
  logger.info('All price cache invalidated via API');
  res.status(204).send();
}));

router.delete('/cache/:symbol', applyRateLimiter('api'), asyncHandler(async (req, res) => {
  const logger = getLogger();
  const { symbol } = req.params;
  await invalidatePriceCache(symbol);
  logger.info({ symbol }, 'Price cache invalidated via API');
  res.status(204).send();
}));

export default router;
