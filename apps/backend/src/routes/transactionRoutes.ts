import { Router } from 'express';
import { z } from 'zod';
import { createTransaction, deleteTransaction, updateTransaction } from '../services/transactionService.js';
import { prisma } from '../prismaClient.js';

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

router.get('/', async (req, res, next) => {
  try {
    const assetId = req.query.assetId ? Number(req.query.assetId) : undefined;
    const transactions = await prisma.transaction.findMany({
      where: {
        assetId,
      },
      orderBy: { date: 'desc' },
    });
    res.json(transactions);
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
