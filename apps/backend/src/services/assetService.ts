import { prisma } from '../prismaClient.js';
import { AssetDetail, AssetSummary, TransactionDTO, TrendPoint } from '@portefeuille/types';
import { roundCurrency, toNumber } from '../utils/numbers.js';
import DecimalJs from 'decimal.js';

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
    const delta = new DecimalJs(price).mul(qty).plus(fee).toNumber();
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
