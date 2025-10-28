import { Router } from 'express';
import { z } from 'zod';
import { importCsv } from '../services/importService.js';
import { createStrictLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const importSchema = z.object({
  portfolioId: z.number().int(),
  source: z.enum(['credit-agricole', 'binance', 'coinbase']),
  csv: z.string().min(1),
});

router.post('/', createStrictLimiter(), asyncHandler(async (req, res) => {
  const payload = importSchema.parse(req.body);
  const result = await importCsv(payload.portfolioId, payload.source, payload.csv);
  res.status(201).json(result);
}));

export default router;
