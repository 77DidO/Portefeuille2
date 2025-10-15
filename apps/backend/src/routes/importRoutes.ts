import { Router } from 'express';
import { z } from 'zod';
import { importCsv } from '../services/importService.js';

const router = Router();

const importSchema = z.object({
  portfolioId: z.number().int(),
  source: z.enum(['credit-agricole', 'binance', 'coinbase']),
  csv: z.string().min(1),
});

router.post('/', async (req, res, next) => {
  try {
    const payload = importSchema.parse(req.body);
    const result = await importCsv(payload.portfolioId, payload.source, payload.csv);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
