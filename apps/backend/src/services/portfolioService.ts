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

  const isCashAsset = asset.symbol?.toUpperCase?.() === 'PEA_CASH' || asset.symbol?.toUpperCase?.() === '_PEA_CASH';
  const adjustedQuantity = isCashAsset ? Math.max(netQuantity, 0) : netQuantity;
  const adjustedMarketValue =
    isCashAsset && latestPriceValue !== null ? Math.max(latestPriceValue * adjustedQuantity, 0) : marketValue;
  const adjustedInvested = isCashAsset ? adjustedMarketValue : invested;
  const adjustedGainLoss = adjustedMarketValue - adjustedInvested;
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
  const aggregatedPricePoints = portfolio.assets
    .flatMap((asset) => asset.pricePoints)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const priceHistory: TrendPoint[] = aggregatedPricePoints.map((point) => ({
    date: point.date.toISOString(),
    value: toNumber(point.price),
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
