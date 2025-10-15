import { prisma } from '../prismaClient.js';
import type { TransactionType } from '@portefeuille/types';

const toDecimalInput = (value: number | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.toString();
};

export const createTransaction = (data: {
  assetId: number;
  type: TransactionType;
  quantity: number;
  price: number;
  fee?: number | null;
  date: Date;
  source?: string | null;
  note?: string | null;
}) => {
  const { quantity, price, fee, ...rest } = data;
  return prisma.transaction.create({
    data: {
      ...rest,
      quantity: quantity.toString(),
      price: price.toString(),
      fee: toDecimalInput(fee),
    },
  });
};

export const updateTransaction = (id: number, data: Partial<{ quantity: number; price: number; fee?: number | null; date: Date; source?: string | null; note?: string | null }>) => {
  const { quantity, price, fee, ...rest } = data;
  return prisma.transaction.update({
    where: { id },
    data: {
      ...rest,
      ...(quantity !== undefined ? { quantity: quantity.toString() } : {}),
      ...(price !== undefined ? { price: price.toString() } : {}),
      ...(fee !== undefined ? { fee: toDecimalInput(fee) } : {}),
    },
  });
};

export const deleteTransaction = (id: number) => {
  return prisma.transaction.delete({
    where: { id },
  });
};
