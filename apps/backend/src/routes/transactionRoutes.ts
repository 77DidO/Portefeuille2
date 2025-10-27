import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type {
  AssetType,
  PortfolioCategory,
  TransactionHistoryItem,
  TransactionType,
} from '@portefeuille/types';
import { createTransaction, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { prisma } from '../prismaClient.js';
import { toNumber } from '../utils/numbers.js';

const router = Router();

const transactionSchema = z.object({
  assetId: z.number().int(),
  type: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  fee: z.number().nonnegative().optional(),
  date: z.string().datetime(),
  source: z.string().optional(),
  note: z.string().optional(),
});

const TRANSACTION_TYPES: TransactionType[] = ['BUY', 'SELL'];
const PORTFOLIO_CATEGORIES: PortfolioCategory[] = ['GLOBAL', 'CRYPTO', 'PEA', 'OTHER'];
const ASSET_TYPES: AssetType[] = ['STOCK', 'CRYPTO', 'ETF', 'FUND', 'OTHER'];

const firstString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    const candidate = value[0];
    return typeof candidate === 'string' ? candidate : undefined;
  }
  return undefined;
};

const parseNumberParam = (value: unknown): number | undefined => {
  const raw = firstString(value);
  if (!raw) {
    return undefined;
  }
  const numeric = Number.parseInt(raw, 10);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const parseEnumParam = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => {
  const raw = firstString(value);
  if (!raw) {
    return undefined;
  }
  const upper = raw.toUpperCase() as T;
  return allowed.includes(upper) ? upper : undefined;
};

router.get('/', async (req, res, next) => {
  try {
    const assetId = parseNumberParam(req.query.assetId);
    const portfolioId = parseNumberParam(req.query.portfolioId);
    const typeFilter = parseEnumParam<TransactionType>(req.query.type, TRANSACTION_TYPES);
    const categoryFilter =
      parseEnumParam<PortfolioCategory>(
        req.query.category ?? req.query.portfolioCategory,
        PORTFOLIO_CATEGORIES,
      ) ?? null;
    const assetTypeFilter = parseEnumParam<AssetType>(req.query.assetType, ASSET_TYPES) ?? null;
    const sourceFilter = firstString(req.query.source);
    const searchTerm = firstString(req.query.search);
    const requestedLimit = parseNumberParam(req.query.limit);
    const limit =
      requestedLimit && requestedLimit > 0 ? Math.min(Math.max(requestedLimit, 1), 1000) : 500;

    const where: Prisma.TransactionWhereInput = {};
    if (assetId !== undefined) {
      where.assetId = assetId;
    }
    if (typeFilter) {
      where.type = typeFilter;
    }
    if (sourceFilter) {
      where.source = { contains: sourceFilter };
    }

    const assetFilters: Prisma.AssetWhereInput = {};
    if (portfolioId !== undefined) {
      assetFilters.portfolioId = portfolioId;
    }
    if (assetTypeFilter) {
      assetFilters.assetType = assetTypeFilter;
    }
    if (categoryFilter) {
      assetFilters.portfolio = { category: categoryFilter };
    }
    if (Object.keys(assetFilters).length > 0) {
      where.asset = { is: assetFilters };
    }

    if (searchTerm) {
      const cmp = { contains: searchTerm } as const;
      where.OR = [
        { note: cmp },
        { source: cmp },
        { asset: { is: { name: cmp } } },
        { asset: { is: { symbol: cmp } } },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        asset: {
          include: {
            portfolio: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    const payload: TransactionHistoryItem[] = transactions.map((transaction) => ({
      id: transaction.id,
      assetId: transaction.assetId,
      assetName: transaction.asset?.name ?? null,
      assetSymbol: transaction.asset?.symbol ?? null,
      assetType: (transaction.asset?.assetType as AssetType | null) ?? null,
      portfolioId: transaction.asset?.portfolioId ?? null,
      portfolioName: transaction.asset?.portfolio?.name ?? null,
      portfolioCategory: (transaction.asset?.portfolio?.category as PortfolioCategory | null) ?? null,
      type: transaction.type as TransactionType,
      quantity: toNumber(transaction.quantity),
      price: toNumber(transaction.price),
      fee: transaction.fee !== null && transaction.fee !== undefined ? toNumber(transaction.fee) : null,
      date: transaction.date.toISOString(),
      source: transaction.source ?? null,
      note: transaction.note ?? null,
    }));
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = transactionSchema.parse(req.body);
    const transaction = await createTransaction({
      assetId: payload.assetId,
      type: payload.type,
      quantity: payload.quantity,
      price: payload.price,
      fee: payload.fee,
      date: new Date(payload.date),
      source: payload.source,
      note: payload.note,
    });
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = transactionSchema.partial().parse(req.body);
    const transaction = await updateTransaction(id, {
      quantity: payload.quantity,
      price: payload.price,
      fee: payload.fee,
      date: payload.date ? new Date(payload.date) : undefined,
      source: payload.source,
      note: payload.note,
    });
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await deleteTransaction(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
