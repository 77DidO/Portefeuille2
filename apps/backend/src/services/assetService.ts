import { prisma } from '../prismaClient.js';
import { AssetDetail, AssetSummary, AssetStaleness, TransactionDTO, TrendPoint } from '@portefeuille/types';
import { roundCurrency, toNumber } from '../utils/numbers.js';
import { Decimal } from 'decimal.js';

/**
 * Détermine la source du prix pour l'affichage de l'état de synchronisation
 */
const determinePriceSource = (asset: any, latestPrice: any): AssetSummary['priceSource'] => {
  if (!latestPrice) return 'stale';
  
  const now = new Date();
  const lastUpdate = asset.lastPriceUpdateAt ? new Date(asset.lastPriceUpdateAt) : null;
  
  if (!lastUpdate) return 'stale';
  
  const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  
  // Prix récent (< 5 minutes) = API fraîche
  if (minutesSinceUpdate < 5) return 'api';
  
  // Prix modéré (5-60 minutes) = Cache
  if (minutesSinceUpdate < 60) return 'cache';
  
  // Prix ancien (> 1h) = Obsolète
  return 'stale';
};

export const getAssetDetail = async (id: number): Promise<AssetDetail | null> => {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      transactions: true,
      pricePoints: true,
    },
  });
  if (!asset) {
    return null;
  }
  const sortedPrices = asset.pricePoints.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const latestPrice = sortedPrices.at(-1);
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

  const transactions: TransactionDTO[] = asset.transactions
    .map((tx) => ({
      id: tx.id,
      type: tx.type as TransactionDTO['type'],
      quantity: toNumber(tx.quantity),
      price: toNumber(tx.price),
      fee: tx.fee !== null ? toNumber(tx.fee) : null,
      date: tx.date.toISOString(),
      source: tx.source,
      note: tx.note,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const priceHistory: TrendPoint[] = sortedPrices.map((pp) => ({
    date: pp.date.toISOString(),
    value: toNumber(pp.price),
  }));

  const summary: AssetSummary = {
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    assetType: asset.assetType as AssetSummary['assetType'],
    latestPrice: latestPrice ? toNumber(latestPrice.price) : null,
    lastPriceUpdateAt: asset.lastPriceUpdateAt ? asset.lastPriceUpdateAt.toISOString() : null,
    priceSource: determinePriceSource(asset, latestPrice),
    quantity: roundCurrency(netQuantity, 8),
    marketValue: roundCurrency(marketValue),
    investedValue: roundCurrency(invested),
    gainLossValue: roundCurrency(gainLoss),
    gainLossPercentage: roundCurrency(gainLossPercentage, 2),
    trend: priceHistory,
  };

  return {
    ...summary,
    transactions,
    priceHistory,
  };
};

export const createAsset = (data: {
  portfolioId: number;
  symbol: string;
  name: string;
  assetType: AssetSummary['assetType'];
}) => {
  return prisma.asset.create({
    data,
  });
};

export const updateAsset = (id: number, data: Partial<{ symbol: string; name: string; assetType: AssetSummary['assetType'] }>) => {
  return prisma.asset.update({
    where: { id },
    data,
  });
};

export const deleteAsset = (id: number) => {
  return prisma.asset.delete({
    where: { id },
  });
};

export const findStaleAssets = async ({
  portfolioId,
  since,
}: {
  portfolioId?: number;
  since: Date;
}): Promise<AssetStaleness[]> => {
  const assets = await prisma.asset.findMany({
    where: {
      ...(portfolioId ? { portfolioId } : {}),
      OR: [
        { lastPriceUpdateAt: null },
        { lastPriceUpdateAt: { lt: since } },
        { pricePoints: { none: {} } },
      ],
    },
    include: {
      pricePoints: {
        orderBy: { date: 'desc' },
        take: 1,
      },
      portfolio: true,
    },
    orderBy: [{ portfolio: { name: 'asc' } }, { id: 'asc' }],
  });

  return assets.map((asset) => ({
    id: asset.id,
    portfolioId: asset.portfolioId,
    portfolioName: asset.portfolio.name,
    symbol: asset.symbol,
    name: asset.name,
    lastPriceUpdateAt: asset.lastPriceUpdateAt ? asset.lastPriceUpdateAt.toISOString() : null,
    lastPricePointAt: asset.pricePoints[0]?.date ? asset.pricePoints[0].date.toISOString() : null,
  }));
};
