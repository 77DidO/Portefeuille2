import { Router } from 'express';
import { z } from 'zod';
import {
  listPortfolios,
  getPortfolioDetail,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
} from '../services/portfolioService.js';

const router = Router();

const portfolioSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['GLOBAL', 'CRYPTO', 'PEA', 'OTHER']),
});

router.get('/', async (_req, res, next) => {
  try {
    const portfolios = await listPortfolios();
    res.json(portfolios);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const portfolio = await getPortfolioDetail(id);
    if (!portfolio) {
      res.status(404).json({ message: 'Portefeuille non trouvé' });
      return;
    }
    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = portfolioSchema.parse(req.body);
    const portfolio = await createPortfolio(payload.name, payload.category);
    res.status(201).json(portfolio);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = portfolioSchema.partial().parse(req.body);
    const portfolio = await updatePortfolio(id, payload);
    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await deletePortfolio(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
