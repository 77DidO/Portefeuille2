import { prisma } from '../prismaClient.js';
import { Asset, Portfolio, PricePoint, Transaction } from '@prisma/client';
import { roundCurrency, toNumber } from '../utils/numbers.js';
import { PortfolioDetail, PortfolioSummary, AssetSummary, TrendPoint } from '@portefeuille/types';
import { Decimal } from 'decimal.js';

interface AssetWithRelations extends Asset {
  transactions: Transaction[];
  pricePoints: PricePoint[];
}

const CASH_SYMBOLS = new Set([
  'PEA_CASH',
  '_PEA_CASH',
  'CASH',
  'EUR',
  'USD',
  'USDT',
  'USDC',
  'BUSD',
  'GBP',
]);

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

  const symbolUpper = asset.symbol?.toUpperCase?.() ?? '';
  const isCashAsset = CASH_SYMBOLS.has(symbolUpper);
  const adjustedQuantity = isCashAsset ? Math.max(netQuantity, 0) : netQuantity;
  const cashUnitPrice = latestPriceValue ?? 1;
  const adjustedMarketValue =
    isCashAsset ? Math.max(cashUnitPrice * adjustedQuantity, 0) : marketValue;
  const adjustedInvested = isCashAsset ? 0 : invested;
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
    .filter((asset) => CASH_SYMBOLS.has(asset.symbol?.toUpperCase?.() ?? ''))
    .reduce((acc, asset) => acc + asset.marketValue, 0);
  const nonCashAssets = assetSummaries.filter(
    (asset) => !CASH_SYMBOLS.has(asset.symbol?.toUpperCase?.() ?? ''),
  );
  const investedValue = nonCashAssets.reduce((acc, asset) => acc + asset.investedValue, 0);
  const investedMarketValue = nonCashAssets.reduce((acc, asset) => acc + asset.marketValue, 0);
  const totalValue = assetSummaries.reduce((acc, asset) => acc + asset.marketValue, 0);
  const gainLossValue = investedMarketValue - investedValue;
  const gainLossPercentage = investedValue !== 0 ? (gainLossValue / investedValue) * 100 : 0;

  return {
    id: portfolio.id,
    name: portfolio.name,
    category: portfolio.category as PortfolioSummary['category'],
    color: portfolio.color,
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
  const allTransactions = portfolio.assets
    .flatMap((asset) => {
      const symbol = asset.symbol?.toUpperCase?.() ?? '';
      const isCashAsset = CASH_SYMBOLS.has(symbol);
      return asset.transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        date: tx.date,
        quantity: tx.quantity,
        price: tx.price,
        fee: tx.fee,
        isCashAsset,
      }));
    })
    .filter((tx) => !tx.isCashAsset)
    .sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) {
        return diff;
      }
      return a.id - b.id;
    });
  let cumulativeInvested = 0;
  const investedDaily = new Map<
    string,
    {
      timestamp: number;
      value: number;
    }
  >();
  allTransactions.forEach((tx) => {
    const qty = toNumber(tx.quantity);
    const price = toNumber(tx.price);
    const fee = toNumber(tx.fee ?? 0);
    if (qty === 0 && price === 0 && fee === 0) {
      return;
    }
    const delta = new Decimal(price).mul(qty).plus(fee).toNumber();
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    cumulativeInvested += tx.type === 'BUY' ? delta : -delta;
    const txDate = new Date(tx.date);
    const dayKey = txDate.toISOString().split('T')[0];
    const dayTimestamp = Math.max(
      txDate.getTime(),
      Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), txDate.getUTCDate()),
    );
    const existing = investedDaily.get(dayKey);
    if (!existing || txDate.getTime() >= existing.timestamp) {
      investedDaily.set(dayKey, {
        timestamp: dayTimestamp,
        value: cumulativeInvested,
      });
    }
  });
  const dailyTotals = new Map<
    string,
    {
      timestamp: number;
      assets: number;
    }
  >();
  const cashSnapshots = new Map<
    string,
    {
      timestamp: number;
      value: number;
    }
  >();

  portfolio.assets.forEach((asset) => {
    const symbol = asset.symbol?.toUpperCase?.() ?? '';
    const isCashAsset = CASH_SYMBOLS.has(symbol);
    const transactions = [...asset.transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    if (isCashAsset) {
      let runningQuantity = 0;
      transactions.forEach((tx) => {
        const qty = toNumber(tx.quantity);
        runningQuantity += tx.type === 'BUY' ? qty : -qty;
        const txDate = new Date(tx.date);
        const dayKey = txDate.toISOString().split('T')[0];
        const dayTimestamp = Math.max(
          txDate.getTime(),
          Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), txDate.getUTCDate()),
        );
        cashSnapshots.set(dayKey, {
          timestamp: dayTimestamp,
          value: runningQuantity,
        });
        const existing = dailyTotals.get(dayKey);
        if (existing) {
          dailyTotals.set(dayKey, {
            timestamp: Math.max(existing.timestamp, dayTimestamp),
            assets: existing.assets,
          });
        } else {
          dailyTotals.set(dayKey, {
            timestamp: dayTimestamp,
            assets: 0,
          });
        }
      });
      return;
    }

    const sortedPoints = [...asset.pricePoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    if (sortedPoints.length === 0) {
      return;
    }
    let txIndex = 0;
    let runningQuantity = 0;
    const dailyContribution = new Map<
      string,
      {
        timestamp: number;
        assets: number;
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
          assets: value,
        });
      }
    });

    dailyContribution.forEach((entry, dayKey) => {
      const existing = dailyTotals.get(dayKey);
      if (existing) {
        dailyTotals.set(dayKey, {
          timestamp: Math.max(existing.timestamp, entry.timestamp),
          assets: existing.assets + entry.assets,
        });
      } else {
        dailyTotals.set(dayKey, { ...entry });
      }
    });
  });

  const combined = new Map<
    string,
    {
      timestamp: number;
      assets: number;
      cash?: number;
    }
  >();

  dailyTotals.forEach((entry, dayKey) => {
    combined.set(dayKey, { timestamp: entry.timestamp, assets: entry.assets });
  });

  cashSnapshots.forEach((entry, dayKey) => {
    const existing = combined.get(dayKey);
    if (existing) {
      existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
      existing.cash = entry.value;
    } else {
      combined.set(dayKey, { timestamp: entry.timestamp, assets: 0, cash: entry.value });
    }
  });

  const sortedCombined = [...combined.entries()].sort(
    (a, b) => a[1].timestamp - b[1].timestamp,
  );
  let lastCashValue = 0;
  const priceHistory: TrendPoint[] = [];
  const cashHistory: TrendPoint[] = [];

  sortedCombined.forEach(([, entry]) => {
    if (typeof entry.cash === 'number') {
      lastCashValue = entry.cash;
    }
    const dateIso = new Date(entry.timestamp).toISOString();
    cashHistory.push({
      date: dateIso,
      value: roundCurrency(lastCashValue),
    });
    priceHistory.push({
      date: dateIso,
      value: roundCurrency(entry.assets + lastCashValue),
    });
  });
  const investedEntries = [...investedDaily.entries()].sort(
    (a, b) => a[1].timestamp - b[1].timestamp,
  );
  let investedIndex = 0;
  let latestInvested = 0;
  const investedHistory: TrendPoint[] = priceHistory.map((point) => {
    while (
      investedIndex < investedEntries.length &&
      investedEntries[investedIndex][1].timestamp <= new Date(point.date).getTime()
    ) {
      latestInvested = roundCurrency(investedEntries[investedIndex][1].value);
      investedIndex += 1;
    }
    return {
      date: point.date,
      value: latestInvested,
    };
  });
  return {
    ...summary,
    priceHistory,
    investedHistory,
    cashHistory,
  };
};

export const createPortfolio = (name: string, category: PortfolioSummary['category'], color?: string) => {
  return prisma.portfolio.create({
    data: {
      name,
      category,
      color,
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


