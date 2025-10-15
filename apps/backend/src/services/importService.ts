import { parse } from 'csv-parse/sync';
import { prisma } from '../prismaClient.js';
import type { TransactionType, AssetType, PortfolioCategory } from '@portefeuille/types';
import { isValid, parseISO } from 'date-fns';

interface ParsedRow {
  symbol: string;
  name: string;
  type: AssetType;
  date: Date;
  price: number;
  quantity: number;
  transactionType: TransactionType;
  source: string;
}

const normaliseNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const normalised = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normaliseDate = (value: string): Date => {
  const trimmed = value.trim();
  const iso = parseISO(trimmed);
  if (isValid(iso)) return iso;
  const parts = trimmed.split(/[\/-]/);
  if (parts.length === 3) {
    const [part1, part2, part3] = parts;
    if (part1.length === 4) {
      return new Date(Number(part1), Number(part2) - 1, Number(part3));
    }
    return new Date(Number(part3), Number(part2) - 1, Number(part1));
  }
  return new Date(trimmed);
};

const detectTransactionType = (raw: string | undefined): TransactionType => {
  const value = raw?.toLowerCase() ?? '';
  if (value.includes('vente') || value.includes('sell') || value.includes('withdraw')) {
    return 'SELL';
  }
  return 'BUY';
};

type CsvRecord = Record<string, string>;

const normaliseHeaders = (record: CsvRecord): CsvRecord => {
  const normalised: CsvRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    normalised[key.trim().toLowerCase()] = value;
  });
  return normalised;
};

const parseCreditAgricole = (records: CsvRecord[]): ParsedRow[] => {
  return records.map((record) => {
    const row = normaliseHeaders(record);
    const symbol = row['isin'] || row['code'] || row['ticker'] || row['libellé'] || row['libelle'];
    const name = row['libellé'] || row['libelle'] || row['designation'] || symbol;
    const quantity = normaliseNumber(row['quantité'] || row['quantite'] || row['qte']);
    const price = normaliseNumber(row['prix'] || row['prix unitaire'] || row['cours']);
    const dateRaw = row['date'] || row['date opération'] || row['date operation'];
    const transactionType = detectTransactionType(row['sens'] || row['type'] || row['operation']);
    return {
      symbol: symbol ?? name ?? 'INCONNU',
      name: name ?? symbol ?? 'Valeur Crédit Agricole',
      type: 'STOCK',
      date: dateRaw ? normaliseDate(dateRaw) : new Date(),
      price,
      quantity,
      transactionType,
      source: 'credit-agricole',
    };
  });
};

const parseBinance = (records: CsvRecord[]): ParsedRow[] => {
  return records.map((record) => {
    const row = normaliseHeaders(record);
    const symbol = row['pair'] || row['symbol'] || row['coin'];
    const name = symbol ?? row['asset'] ?? 'Crypto Binance';
    const quantity = normaliseNumber(row['amount'] || row['change'] || row['quantity']);
    const price = normaliseNumber(row['price'] || row['price per unit'] || row['fill price']);
    const dateRaw = row['date(utc)'] || row['date'] || row['time'];
    const transactionType = detectTransactionType(row['side'] || row['type'] || row['operation']);
    return {
      symbol: symbol ?? name ?? 'CRYPTO',
      name: name ?? symbol ?? 'Crypto Binance',
      type: 'CRYPTO',
      date: dateRaw ? normaliseDate(dateRaw) : new Date(),
      price,
      quantity,
      transactionType,
      source: 'binance',
    };
  });
};

const parseCoinbase = (records: CsvRecord[]): ParsedRow[] => {
  return records.map((record) => {
    const row = normaliseHeaders(record);
    const symbol = row['asset'] || row['currency'] || row['symbol'];
    const name = row['asset'] || row['product'] || symbol || 'Crypto Coinbase';
    const quantity = normaliseNumber(row['quantity transacted'] || row['amount'] || row['quantity']);
    const price = normaliseNumber(row['spot price at transaction'] || row['price']);
    const dateRaw = row['timestamp'] || row['date'];
    const transactionType = detectTransactionType(row['transaction type'] || row['type']);
    return {
      symbol: symbol ?? name ?? 'CRYPTO',
      name: name ?? symbol ?? 'Crypto Coinbase',
      type: 'CRYPTO',
      date: dateRaw ? normaliseDate(dateRaw) : new Date(),
      price,
      quantity,
      transactionType,
      source: 'coinbase',
    };
  });
};

const parserBySource: Record<string, (records: CsvRecord[]) => ParsedRow[]> = {
  'credit-agricole': parseCreditAgricole,
  binance: parseBinance,
  coinbase: parseCoinbase,
};

export const importCsv = async (portfolioId: number, source: keyof typeof parserBySource, csv: string) => {
  const parser = parserBySource[source];
  if (!parser) {
    throw new Error(`Source CSV inconnue: ${source}`);
  }
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: [',', ';', '\t'],
    trim: true,
  }) as CsvRecord[];
  const rows = parser(records).filter((row) => row.quantity !== 0 && row.price !== 0);
  const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
  if (!portfolio) {
    throw new Error('Portefeuille introuvable');
  }

  for (const row of rows) {
    const asset = await prisma.asset.findFirst({
      where: {
        portfolioId,
        symbol: row.symbol,
      },
    });
    const targetAsset = asset
      ? asset
      : await prisma.asset.create({
          data: {
            portfolioId,
            symbol: row.symbol,
            name: row.name,
            assetType: row.type,
          },
        });

    await prisma.transaction.create({
      data: {
        assetId: targetAsset.id,
        type: row.transactionType,
        quantity: row.quantity.toString(),
        price: row.price.toString(),
        date: row.date,
        source: row.source,
      },
    });

    await prisma.pricePoint.upsert({
      where: {
        assetId_date: {
          assetId: targetAsset.id,
          date: row.date,
        },
      },
      update: {
        price: row.price.toString(),
        source: row.source,
      },
      create: {
        assetId: targetAsset.id,
        date: row.date,
        price: row.price.toString(),
        source: row.source,
      },
    });
  }

  return { imported: rows.length };
};

export const ensureGlobalPortfolio = async () => {
  const existing = await prisma.portfolio.findFirst({
    where: { category: 'GLOBAL' },
  });
  if (!existing) {
    await prisma.portfolio.create({
      data: {
        name: 'Portefeuille Global',
        category: 'GLOBAL',
      },
    });
  }
};
