
import { Router } from 'express';
import { resetData } from '../services/systemService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getEnv } from '../config/env.js';
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

export default router;
