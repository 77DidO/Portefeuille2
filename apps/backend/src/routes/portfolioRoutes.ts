import { Router } from 'express';
import { z } from 'zod';
import {
  listPortfolios,
  getPortfolioDetail,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
} from '../services/portfolioService.js';
import { NotFoundError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const portfolioSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['GLOBAL', 'CRYPTO', 'PEA', 'OTHER']),
  color: z.string().optional(),
});

router.get('/', asyncHandler(async (_req, res) => {
  const portfolios = await listPortfolios();
  res.json(portfolios);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const portfolio = await getPortfolioDetail(id);
  if (!portfolio) {
    throw new NotFoundError('Portefeuille non trouvé');
  }
  res.json(portfolio);
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = portfolioSchema.parse(req.body);
  const portfolio = await createPortfolio(payload.name, payload.category, payload.color);
  res.status(201).json(portfolio);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const payload = portfolioSchema.partial().parse(req.body);
  const portfolio = await updatePortfolio(id, payload);
  res.json(portfolio);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await deletePortfolio(id);
  res.status(204).end();
}));

export default router;
