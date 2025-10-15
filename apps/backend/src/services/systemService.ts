import { prisma } from '../prismaClient.js';
import { ensureGlobalPortfolio } from './importService.js';

export const resetData = async () => {
  await prisma.$transaction([
    prisma.pricePoint.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.portfolio.deleteMany(),
  ]);

  await ensureGlobalPortfolio();
};
