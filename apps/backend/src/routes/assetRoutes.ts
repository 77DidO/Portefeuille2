import { Router } from 'express';
import { z } from 'zod';
import {
  createAsset,
  deleteAsset,
  findStaleAssets,
  getAssetDetail,
  updateAsset,
} from '../services/assetService.js';
import {
  backfillPriceHistory,
  refreshAllAssetPrices,
  refreshAssetPrice,
} from '../services/priceUpdateService.js';
import { prisma } from '../prismaClient.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const portfolioId = req.query.portfolioId ? Number(req.query.portfolioId) : undefined;
    const staleDaysParam = req.query.staleDays ?? req.query.stale;

    if (staleDaysParam !== undefined) {
      const parsed = Number(staleDaysParam);
      if (Number.isNaN(parsed) || parsed < 0) {
        res.status(400).json({ message: 'Parametre staleDays invalide' });
        return;
      }
      const since = new Date(Date.now() - parsed * 24 * 60 * 60 * 1000);
      const assets = await findStaleAssets({ portfolioId, since });
      res.json(assets);
      return;
    }

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
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const payload = refreshAllSchema?.parse(req.body ?? {});
    const portfolioId = payload?.portfolioId;
    const result = await refreshAllAssetPrices(portfolioId);
    res.json(result);
  }),
);

router.post(
  '/backfill-history',
  asyncHandler(async (_req, res) => {
    const result = await backfillPriceHistory();
    res.json(result);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const asset = await getAssetDetail(id);
    if (!asset) {
      res.status(404).json({ message: 'Actif non trouve' });
      return;
    }
    res.json(asset);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = assetSchema.parse(req.body);
    const asset = await createAsset(payload);
    res.status(201).json(asset);
  }),
);

router.post(
  '/:id/refresh',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await refreshAssetPrice(id);
    res.json(result);
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const payload = assetSchema.partial().omit({ portfolioId: true }).parse(req.body);
    const asset = await updateAsset(id, payload);
    res.json(asset);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await deleteAsset(id);
    res.status(204).end();
  }),
);

export default router;
