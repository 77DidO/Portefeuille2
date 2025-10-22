import { Router } from 'express';
import { z } from 'zod';
import { createAsset, deleteAsset, getAssetDetail, updateAsset } from '../services/assetService.js';
import { refreshAllAssetPrices, refreshAssetPrice, backfillPriceHistory } from '../services/priceUpdateService.js';
import { prisma } from '../prismaClient.js';

const router = Router();

const assetSchema = z.object({
  portfolioId: z.number().int(),
  symbol: z.string().min(1),
  name: z.string().min(1),
  assetType: z.enum(['STOCK', 'CRYPTO', 'ETF', 'FUND', 'OTHER']),
});

const refreshAllSchema = z
  .object({
    portfolioId: z.number().int().optional(),
  })
  .optional();

router.get('/', async (req, res, next) => {
  try {
    const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : undefined;
    const assets = await prisma.asset.findMany({
      where: {
        portfolioId,
      },
      include: {
        transactions: true,
        pricePoints: true,
      },
      orderBy: { id: 'asc' },
    });
    res.json(assets);
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const payload = refreshAllSchema?.parse(req.body ?? {});
    const portfolioId = payload?.portfolioId;
    const result = await refreshAllAssetPrices(portfolioId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/backfill-history', async (_req, res, next) => {
  try {
    const result = await backfillPriceHistory();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const asset = await getAssetDetail(id);
    if (!asset) {
      res.status(404).json({ message: 'Actif non trouvé' });
      return;
    }
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = assetSchema.parse(req.body);
    const asset = await createAsset(payload);
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/refresh', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await refreshAssetPrice(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = assetSchema.partial().omit({ portfolioId: true }).parse(req.body);
    const asset = await updateAsset(id, payload);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await deleteAsset(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
