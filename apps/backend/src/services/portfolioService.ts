import { prisma } from '../prismaClient.js';
import { Asset, Portfolio, PricePoint, Transaction } from '@prisma/client';
import { roundCurrency, toNumber } from '../utils/numbers.js';
import {
  PortfolioDetail,
  PortfolioSummary,
  AssetSummary,
  TrendPoint,
  isCashSymbol,
  isFiatSymbol,
} from '@portefeuille/types';
import { Decimal } from 'decimal.js';

interface AssetWithRelations extends Asset {
  transactions: Transaction[];
  pricePoints: PricePoint[];
}

/**
 * Calcule le capital total investi basé sur les versements de cash
 */
const computeTotalInvestedFromDeposits = (portfolio: Portfolio & { assets: AssetWithRelations[] }): number => {
  const { cashDeposits } = identifyCashDeposits(portfolio);
  
  let totalDeposits = 0;
  cashDeposits.forEach((tx) => {
    totalDeposits += toNumber(tx.quantity);
  });

  return totalDeposits;
};

/**
 * Calcule le total des dividendes et remboursements fiscaux
 */
const computeTotalDividends = (portfolio: Portfolio & { assets: AssetWithRelations[] }): number => {
  let totalDividends = 0;
  
  portfolio.assets.forEach((asset) => {
    const isCashAsset = isCashSymbol(asset.symbol);
    
    if (isCashAsset) {
      asset.transactions.forEach((tx) => {
        const source = tx.source?.toLowerCase?.() ?? '';
        if (source === 'dividend' || source === 'tax-refund') {
          if (tx.type === 'BUY') {
            totalDividends += toNumber(tx.quantity);
          }
        }
      });
    }
  });
  
  return totalDividends;
};

/**
 * Identifie les transactions qui sont de vrais versements de cash (vs mouvements internes)
 */
const identifyCashDeposits = (portfolio: Portfolio & { assets: AssetWithRelations[] }) => {
  // Adapter le seuil en fonction du type de portefeuille
  // Crypto : petits versements possibles (ex: 10€)
  // PEA/Actions : versements plus importants (ex: 100€+)
  const MIN_DEPOSIT = portfolio.category === 'CRYPTO' ? 1 : 50;
  
  const allTransactions = portfolio.assets
    .flatMap((asset) => {
      const isCashAsset = isCashSymbol(asset.symbol);
      const isFiat = isFiatSymbol(asset.symbol);
      return asset.transactions.map((tx) => ({
        id: tx.id,
        assetId: asset.id,
        type: tx.type,
        date: tx.date,
        quantity: tx.quantity,
        price: tx.price,
        fee: tx.fee,
        isCashAsset,
        isFiat,
      }));
    })
    .sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
      return a.id - b.id;
    });

  // Identifier les ventes d'actifs par jour
  // Pour crypto : inclure aussi les SELL de cash (conversions entre devises)
  const assetSales = new Map<string, number>();
  allTransactions.forEach((tx) => {
    const shouldCount = portfolio.category === 'CRYPTO' 
      ? tx.type === 'SELL' // Pour crypto : compter tous les SELL
      : (!tx.isCashAsset && tx.type === 'SELL'); // Pour autres : seulement SELL d'actifs
      
    if (shouldCount) {
      const dayKey = new Date(tx.date).toISOString().split('T')[0];
      const amount = toNumber(tx.quantity) * toNumber(tx.price || 0);
      assetSales.set(dayKey, (assetSales.get(dayKey) || 0) + amount);
    }
  });

  // Identifier les vrais versements de cash
  const cashDeposits: typeof allTransactions = [];
  allTransactions.forEach((tx) => {
    // Pour les cryptos : seuls les BUY de FIAT (EUR, USD) sont des versements
    // Les BUY de stablecoins (USDT, USDC) sont des conversions
    // Pour les autres : tous les BUY de cash
    const isCashDeposit = portfolio.category === 'CRYPTO' ? tx.isFiat : tx.isCashAsset;
    
    if (isCashDeposit && tx.type === 'BUY') {
      const dayKey = new Date(tx.date).toISOString().split('T')[0];
      const amount = toNumber(tx.quantity);
      const soldOnSameDay = assetSales.get(dayKey) || 0;
      
      // Filtrer les versements :
      // 1. Montant > MIN_DEPOSIT (défini selon le type de portefeuille)
      // 2. Dépasse les ventes d'actifs du jour de plus de 10€
      const THRESHOLD = 10;
      if (amount > MIN_DEPOSIT && amount > soldOnSameDay + THRESHOLD) {
        cashDeposits.push(tx);
      }
    }
  });

  return { allTransactions, cashDeposits };
};

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

  const isCashAsset = isCashSymbol(asset.symbol);
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
    .filter((asset) => isCashSymbol(asset.symbol))
    .reduce((acc, asset) => acc + asset.marketValue, 0);
  const nonCashAssets = assetSummaries.filter(
    (asset) => !isCashSymbol(asset.symbol),
  );
  
  // Calculer le capital investi basé sur les versements de cash
  const totalDeposits = computeTotalInvestedFromDeposits(portfolio);
  
  // Calculer le total des dividendes
  const totalDividends = computeTotalDividends(portfolio);
  
  // Calculer le capital réellement investi dans les actifs (hors cash)
  const investedInAssets = nonCashAssets.reduce((acc, asset) => acc + asset.investedValue, 0);
  
  const investedMarketValue = nonCashAssets.reduce((acc, asset) => acc + asset.marketValue, 0);
  const totalValue = assetSummaries.reduce((acc, asset) => acc + asset.marketValue, 0);
  
  // Gain/perte = Valeur des actifs - Coût d'achat des actifs (hors cash)
  // Le cash ne génère ni gain ni perte, c'est juste de la liquidité
  const gainLossValue = investedMarketValue - investedInAssets;
  const gainLossPercentage = investedInAssets !== 0 ? (gainLossValue / investedInAssets) * 100 : 0;

  return {
    id: portfolio.id,
    name: portfolio.name,
    category: portfolio.category as PortfolioSummary['category'],
    color: portfolio.color,
    totalValue: roundCurrency(totalValue),
    investedValue: roundCurrency(totalDeposits),
    gainLossValue: roundCurrency(gainLossValue),
    gainLossPercentage: roundCurrency(gainLossPercentage, 2),
    cashValue: roundCurrency(cashValue),
    dividendsValue: roundCurrency(totalDividends),
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
  
  // Identifier les versements de cash
  const { cashDeposits } = identifyCashDeposits(portfolio);

  // Calculer le capital investi basé sur les versements de cash
  let cumulativeInvested = 0;
  const investedDaily = new Map<
    string,
    {
      timestamp: number;
      value: number;
    }
  >();
  
  cashDeposits.forEach((tx) => {
    const amount = toNumber(tx.quantity);
    cumulativeInvested += amount;
    
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

  // Calculer les dividendes cumulés au fil du temps
  let cumulativeDividends = 0;
  const dividendsDaily = new Map<
    string,
    {
      timestamp: number;
      value: number;
    }
  >();

  portfolio.assets.forEach((asset) => {
    const isCashAsset = isCashSymbol(asset.symbol);
    
    if (isCashAsset) {
      const dividendTxs = asset.transactions
        .filter(tx => {
          const source = tx.source?.toLowerCase() ?? '';
          return (source === 'dividend' || source === 'tax-refund') && tx.type === 'BUY';
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      dividendTxs.forEach((tx) => {
        const amount = toNumber(tx.quantity);
        cumulativeDividends += amount;
        
        const txDate = new Date(tx.date);
        const dayKey = txDate.toISOString().split('T')[0];
        const dayTimestamp = Math.max(
          txDate.getTime(),
          Date.UTC(txDate.getUTCFullYear(), txDate.getUTCMonth(), txDate.getUTCDate()),
        );
        
        const existing = dividendsDaily.get(dayKey);
        if (!existing || txDate.getTime() >= existing.timestamp) {
          dividendsDaily.set(dayKey, {
            timestamp: dayTimestamp,
            value: cumulativeDividends,
          });
        }
      });
    }
  });
  const dailyTotals = new Map<
    string,
    {
      timestamp: number;
      assets: number;
      investedInAssets?: number; // Coût d'achat cumulé des actifs
    }
  >();
  const cashSnapshots = new Map<
    string,
    {
      timestamp: number;
      value: number;
    }
  >();

  // Map pour tracker le coût d'achat cumulé des actifs par jour
  const dailyInvestedInAssets = new Map<
    string,
    {
      timestamp: number;
      value: number;
    }
  >();

  portfolio.assets.forEach((asset) => {
    const isCashAsset = isCashSymbol(asset.symbol);
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
    let runningCost = 0; // Coût d'achat cumulé
    
    const dailyContribution = new Map<
      string,
      {
        timestamp: number;
        assets: number;
        cost: number;
      }
    >();

    sortedPoints.forEach((point) => {
      const pointTime = new Date(point.date).getTime();
      while (txIndex < transactions.length && new Date(transactions[txIndex].date).getTime() <= pointTime) {
        const tx = transactions[txIndex];
        const qty = toNumber(tx.quantity);
        const price = toNumber(tx.price);
        const fee = toNumber(tx.fee ?? 0);
        const delta = new Decimal(price).mul(qty).plus(fee).toNumber();
        
        if (tx.type === 'BUY') {
          runningQuantity += qty;
          runningCost += delta;
        } else {
          runningQuantity -= qty;
          runningCost -= delta;
        }
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
          cost: runningCost,
        });
      }
    });

    dailyContribution.forEach((entry, dayKey) => {
      const existing = dailyTotals.get(dayKey);
      if (existing) {
        dailyTotals.set(dayKey, {
          timestamp: Math.max(existing.timestamp, entry.timestamp),
          assets: existing.assets + entry.assets,
          investedInAssets: (existing.investedInAssets || 0) + entry.cost,
        });
      } else {
        dailyTotals.set(dayKey, { 
          timestamp: entry.timestamp,
          assets: entry.assets,
          investedInAssets: entry.cost,
        });
      }
    });
  });

  const combined = new Map<
    string,
    {
      timestamp: number;
      assets: number;
      cash?: number;
      investedFromDeposits?: number;
      investedInAssets?: number;
    }
  >();

  dailyTotals.forEach((entry, dayKey) => {
    combined.set(dayKey, { 
      timestamp: entry.timestamp, 
      assets: entry.assets,
      investedInAssets: entry.investedInAssets,
    });
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

  // Ajouter les versements de cash détectés au combined map
  investedDaily.forEach((entry, dayKey) => {
    const existing = combined.get(dayKey);
    if (existing) {
      existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
      existing.investedFromDeposits = entry.value;
    } else {
      combined.set(dayKey, { timestamp: entry.timestamp, assets: 0, investedFromDeposits: entry.value });
    }
  });

  // Ajouter les dividendes au combined map
  dividendsDaily.forEach((entry, dayKey) => {
    const existing = combined.get(dayKey);
    if (existing) {
      existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
    } else {
      combined.set(dayKey, { timestamp: entry.timestamp, assets: 0 });
    }
  });

  const sortedCombined = [...combined.entries()].sort(
    (a, b) => a[1].timestamp - b[1].timestamp,
  );
  let lastCashValue = 0;
  let lastInvestedFromDeposits = 0;
  let lastInvestedInAssets = 0;
  let lastDividendsValue = 0;
  
  const priceHistory: TrendPoint[] = [];
  const cashHistory: TrendPoint[] = [];
  const investedHistory: TrendPoint[] = [];
  const investedInAssetsHistory: TrendPoint[] = [];
  const dividendsHistory: TrendPoint[] = [];

  sortedCombined.forEach(([dayKey, entry]) => {
    if (typeof entry.cash === 'number') {
      lastCashValue = entry.cash;
    }
    if (typeof entry.investedFromDeposits === 'number') {
      lastInvestedFromDeposits = entry.investedFromDeposits;
    }
    if (typeof entry.investedInAssets === 'number') {
      lastInvestedInAssets = entry.investedInAssets;
    }
    
    // Mettre à jour les dividendes cumulés si on a un événement ce jour-là
    const dividendEntry = dividendsDaily.get(dayKey);
    if (dividendEntry) {
      lastDividendsValue = dividendEntry.value;
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
    // investedHistory = Capital investi basé sur les versements de cash détectés
    investedHistory.push({
      date: dateIso,
      value: roundCurrency(lastInvestedFromDeposits),
    });
    // investedInAssetsHistory = Coût d'achat réel des actifs (pour calcul +/- value)
    investedInAssetsHistory.push({
      date: dateIso,
      value: roundCurrency(lastInvestedInAssets),
    });
    dividendsHistory.push({
      date: dateIso,
      value: roundCurrency(lastDividendsValue),
    });
  });
  
  return {
    ...summary,
    priceHistory,
    investedHistory,
    investedInAssetsHistory,
    cashHistory,
    dividendsHistory,
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


