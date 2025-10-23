import { prisma } from '../prismaClient.js';
import { Asset, Portfolio, PricePoint, Transaction } from '@prisma/client';
import { roundCurrency, toNumber } from '../utils/numbers.js';
import { PortfolioDetail, PortfolioSummary, AssetSummary, TrendPoint } from '@portefeuille/types';
import { Decimal } from 'decimal.js';

interface AssetWithRelations extends Asset {
  transactions: Transaction[];
  pricePoints: PricePoint[];
}

const computeAssetSummary = (asset: AssetWithRelations): AssetSummary => {
  const sortedPrices = [...asset.pricePoints].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const latestPrice = sortedPrices.at(-1);
  const latestPriceValue = latestPrice ? toNumber(latestPrice.price) : null;

  const netQuantity = asset.transactions.reduce((acc, tx) => {
    const qty = toNumber(tx.quantity);
    return tx.type === 'BUY' ? acc + qty : acc - qty;
  }, 0);
  const invested = asset.transactions.reduce((acc, tx) => {
    const qty = toNumber(tx.quantity);
    const price = toNumber(tx.price);
    const fee = toNumber(tx.fee ?? 0);
    const delta = new Decimal(price).mul(qty).plus(fee).toNumber();
    return tx.type === 'BUY' ? acc + delta : acc - delta;
  }, 0);
  const marketValue = latestPrice ? toNumber(latestPrice.price) * netQuantity : 0;
  const gainLoss = marketValue - invested;
  const gainLossPercentage = invested !== 0 ? (gainLoss / invested) * 100 : 0;

  const trend: TrendPoint[] = sortedPrices.map((pp) => ({
    date: pp.date.toISOString(),
    value: toNumber(pp.price),
  }));

  const isCashAsset = ['PEA_CASH', '_PEA_CASH', 'CASH'].includes(asset.symbol?.toUpperCase?.() ?? '');
  const adjustedQuantity = isCashAsset ? Math.max(netQuantity, 0) : netQuantity;
  const cashUnitPrice = latestPriceValue ?? 1;
  const adjustedMarketValue =
    isCashAsset ? Math.max(cashUnitPrice * adjustedQuantity, 0) : marketValue;
  const adjustedInvested = isCashAsset ? adjustedMarketValue : invested;
  const adjustedGainLoss = isCashAsset ? 0 : adjustedMarketValue - adjustedInvested;
  const adjustedGainLossPercentage =
    isCashAsset || adjustedInvested === 0 ? 0 : (adjustedGainLoss / adjustedInvested) * 100;

  return {
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    assetType: asset.assetType as AssetSummary['assetType'],
    latestPrice: latestPrice ? toNumber(latestPrice.price) : null,
    lastPriceUpdateAt: asset.lastPriceUpdateAt ? asset.lastPriceUpdateAt.toISOString() : null,
    quantity: roundCurrency(adjustedQuantity, 8),
    marketValue: roundCurrency(adjustedMarketValue),
    investedValue: roundCurrency(adjustedInvested),
    gainLossValue: roundCurrency(adjustedGainLoss),
    gainLossPercentage: roundCurrency(adjustedGainLossPercentage, 2),
    trend,
  };
};

const computePortfolioTotals = (portfolio: Portfolio & { assets: AssetWithRelations[] }): PortfolioSummary => {
  const assetSummaries = portfolio.assets.map(computeAssetSummary);
  const cashValue = assetSummaries
    .filter((asset) => {
      const symbol = asset.symbol?.toUpperCase?.() ?? '';
      return symbol === 'PEA_CASH' || symbol === '_PEA_CASH' || symbol === 'CASH';
    })
    .reduce((acc, asset) => acc + asset.marketValue, 0);
  const totalValue = assetSummaries.reduce((acc, asset) => acc + asset.marketValue, 0);
  const investedValue = assetSummaries.reduce((acc, asset) => acc + asset.investedValue, 0);
  const gainLossValue = totalValue - investedValue;
  const gainLossPercentage = investedValue !== 0 ? (gainLossValue / investedValue) * 100 : 0;

  return {
    id: portfolio.id,
    name: portfolio.name,
    category: portfolio.category as PortfolioSummary['category'],
    totalValue: roundCurrency(totalValue),
    investedValue: roundCurrency(investedValue),
    gainLossValue: roundCurrency(gainLossValue),
    gainLossPercentage: roundCurrency(gainLossPercentage, 2),
    cashValue: roundCurrency(cashValue),
    assets: assetSummaries,
  };
};

export const listPortfolios = async (): Promise<PortfolioSummary[]> => {
  const portfolios = await prisma.portfolio.findMany({
    include: {
      assets: {
        include: {
          transactions: true,
          pricePoints: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  return portfolios.map((portfolio) => computePortfolioTotals(portfolio));
};

export const getPortfolioDetail = async (id: number): Promise<PortfolioDetail | null> => {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    include: {
      assets: {
        include: {
          transactions: true,
          pricePoints: true,
        },
      },
    },
  });
  if (!portfolio) {
    return null;
  }
  const summary = computePortfolioTotals(portfolio);
  const dailyTotals = new Map<
    string,
    {
      timestamp: number;
      value: number;
    }
  >();

  portfolio.assets.forEach((asset) => {
    const sortedPoints = [...asset.pricePoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    if (sortedPoints.length === 0) {
      return;
    }
    const transactions = [...asset.transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    let txIndex = 0;
    let runningQuantity = 0;
    const dailyContribution = new Map<
      string,
      {
        timestamp: number;
        value: number;
      }
    >();

    sortedPoints.forEach((point) => {
      const pointTime = new Date(point.date).getTime();
      while (txIndex < transactions.length && new Date(transactions[txIndex].date).getTime() <= pointTime) {
        const tx = transactions[txIndex];
        const qty = toNumber(tx.quantity);
        runningQuantity += tx.type === 'BUY' ? qty : -qty;
        txIndex += 1;
      }
      if (runningQuantity === 0) {
        return;
      }
      const value = toNumber(point.price) * runningQuantity;
      const pointDate = new Date(point.date);
      const dayKey = pointDate.toISOString().split('T')[0];
      const dayTimestamp = Date.UTC(
        pointDate.getUTCFullYear(),
        pointDate.getUTCMonth(),
        pointDate.getUTCDate(),
      );
      const existingPerDay = dailyContribution.get(dayKey);
      if (!existingPerDay || pointTime >= existingPerDay.timestamp) {
        dailyContribution.set(dayKey, {
          timestamp: Math.max(pointTime, dayTimestamp),
          value,
        });
      }
    });

    dailyContribution.forEach((entry, dayKey) => {
      const existing = dailyTotals.get(dayKey);
      if (existing) {
        dailyTotals.set(dayKey, {
          timestamp: Math.max(existing.timestamp, entry.timestamp),
          value: existing.value + entry.value,
        });
      } else {
        dailyTotals.set(dayKey, { ...entry });
      }
    });
  });

  const priceHistory: TrendPoint[] = [...dailyTotals.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .map(([, entry]) => ({
      date: new Date(entry.timestamp).toISOString(),
      value: roundCurrency(entry.value),
    }));
  return {
    ...summary,
    priceHistory,
  };
};

export const createPortfolio = (name: string, category: PortfolioSummary['category']) => {
  return prisma.portfolio.create({
    data: {
      name,
      category,
    },
  });
};

export const updatePortfolio = (id: number, data: Partial<Portfolio>) => {
  return prisma.portfolio.update({
    where: { id },
    data,
  });
};

export const deletePortfolio = async (id: number) => {
  return prisma.$transaction(async (tx) => {
    // Clean dependent records to satisfy foreign keys.
    await tx.pricePoint.deleteMany({ where: { asset: { portfolioId: id } } });
    await tx.transaction.deleteMany({ where: { asset: { portfolioId: id } } });
    await tx.asset.deleteMany({ where: { portfolioId: id } });
    return tx.portfolio.delete({ where: { id } });
  });
};
