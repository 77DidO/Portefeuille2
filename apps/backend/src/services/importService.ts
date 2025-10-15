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

  const cleaned = value
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d,.\-]/g, '')
    .replace(/\s+/g, '')
    .replace(/,+/g, ',')
    .replace(/\.+/g, '.')
    .trim();

  if (!/\d/.test(cleaned)) {
    return 0;
  }

  const isNegative = cleaned.startsWith('-');
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;
  const normalised = unsigned.replace(/,/g, '.');
  const segments = normalised.split('.');
  const decimal = segments.length > 1 ? segments.pop() ?? '' : '';
  const integer = segments.join('');
  const recomposed = `${isNegative ? '-' : ''}${integer || '0'}${decimal ? `.${decimal}` : ''}`;
  const parsed = Number(recomposed);

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

const normaliseText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normaliseHeaders = (record: CsvRecord): CsvRecord => {
  const normalised: CsvRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    const baseKey = normaliseText(key);
    if (!baseKey) {
      return;
    }
    normalised[baseKey] = value;
    const compactKey = baseKey.replace(/['\s]/g, '');
    if (!normalised[compactKey]) {
      normalised[compactKey] = value;
    }
  });
  return normalised;
};

const stripPrelude = (csv: string): string => {
  const withoutBom = csv.replace(/^\uFEFF/, '');
  const lines = withoutBom.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const hasDelimiter = /[;, \t]/.test(line);
    if (!hasDelimiter) return false;
    const normalised = normaliseText(trimmed);
    if (!normalised) return false;
    return normalised.includes('date');
  });
  const relevantLines = startIndex >= 0 ? lines.slice(startIndex) : lines;
  return relevantLines.join('\n');
};

const parseCreditAgricole = (records: CsvRecord[]): ParsedRow[] => {
  return records.map((record) => {
    const row = normaliseHeaders(record);
    const symbol =
      row['isin'] ||
      row['code'] ||
      row['ticker'] ||
      row['libelle'] ||
      row['nom'] ||
      row['reference'];
    const name =
      row['libelle'] ||
      row['nom'] ||
      row['designation'] ||
      symbol ||
      'Valeur Credit Agricole';
    const quantity = normaliseNumber(row['quantite'] || row['qte'] || row['quantitenegociable']);
    const price = normaliseNumber(
      row['cours d\'execution'] ||
        row['coursdexecution'] ||
        row['cours'] ||
        row['prix'] ||
        row['prix unitaire'] ||
        row['prixunitaire'],
    );
    const dateRaw =
      row['date'] ||
      row['dateoperation'] ||
      row['dateop'] ||
      row['date de mise a jour'] ||
      row['date de creation'];
    const transactionType = detectTransactionType(
      row['sens'] ||
        row['type'] ||
        row['typedoperation'] ||
        row['type d operation'] ||
        row['operation'],
    );
    return {
      symbol: symbol ?? name ?? 'INCONNU',
      name: name ?? symbol ?? 'Valeur Credit Agricole',
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
  type BinanceEvent = {
    index: number;
    timestamp: Date;
    amount: number;
    coin: string;
    operation: string;
    originalOperation: string;
  };

  const parseTimestamp = (value: string | undefined): Date => {
    if (!value) return new Date();
    const trimmed = value.trim();
    if (!trimmed) return new Date();
    const iso = trimmed.replace(' ', 'T');
    return new Date(`${iso}Z`);
  };

  const events: BinanceEvent[] = records
    .map((record, index) => {
      const row = normaliseHeaders(record);
      const operationRaw = row['operation'] ?? '';
      const operation = normaliseText(operationRaw);
      const amount = normaliseNumber(row['change']);
      const coin = (row['coin'] ?? row['symbol'] ?? '').toUpperCase();
      if (!coin || amount === 0) {
        return null;
      }
      const timestamp = parseTimestamp(
        row['utc_time'] ||
          row['utc time'] ||
          row['utctime'] ||
          row['time'] ||
          row['date'],
      );
      return {
        index,
        timestamp,
        amount,
        coin,
        operation,
        originalOperation: operationRaw,
      };
    })
    .filter((event): event is BinanceEvent => Boolean(event))
    .sort((a, b) => {
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return diff !== 0 ? diff : a.index - b.index;
    });

  const windowMs = 2 * 60 * 1000;
  const pendingSpends: BinanceEvent[] = [];
  const pendingBuys: BinanceEvent[] = [];
  const pendingSells: BinanceEvent[] = [];
  const pendingRevenues: BinanceEvent[] = [];
  const transactions: ParsedRow[] = [];

  const findMatch = (list: BinanceEvent[], event: BinanceEvent) => {
    let matchIndex = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < list.length; i += 1) {
      const candidate = list[i];
      const diff = Math.abs(candidate.timestamp.getTime() - event.timestamp.getTime());
      if (diff <= windowMs && diff < bestDiff) {
        bestDiff = diff;
        matchIndex = i;
      }
    }
    if (matchIndex === -1) {
      return undefined;
    }
    return list.splice(matchIndex, 1)[0];
  };

  const addBuyTransaction = (buyEvent: BinanceEvent, spendEvent: BinanceEvent) => {
    const quantity = buyEvent.amount;
    const spend = Math.abs(spendEvent.amount);
    if (quantity <= 0 || spend <= 0) {
      return;
    }
    const price = spend / quantity;
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }
    transactions.push({
      symbol: buyEvent.coin,
      name: buyEvent.coin,
      type: 'CRYPTO',
      date: buyEvent.timestamp,
      price,
      quantity,
      transactionType: 'BUY',
      source: 'binance',
    });
  };

  const addSellTransaction = (sellEvent: BinanceEvent, revenueEvent: BinanceEvent) => {
    const quantity = Math.abs(sellEvent.amount);
    const revenue = revenueEvent.amount;
    if (quantity <= 0 || revenue <= 0) {
      return;
    }
    const price = revenue / quantity;
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }
    transactions.push({
      symbol: sellEvent.coin,
      name: sellEvent.coin,
      type: 'CRYPTO',
      date: sellEvent.timestamp,
      price,
      quantity,
      transactionType: 'SELL',
      source: 'binance',
    });
  };

  const evictStale = (list: BinanceEvent[], reference: BinanceEvent) => {
    const threshold = reference.timestamp.getTime() - windowMs;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].timestamp.getTime() < threshold) {
        list.splice(i, 1);
      }
    }
  };

  for (const event of events) {
    const op = event.operation;
    const isFee = op.includes('fee');
    if (isFee) {
      continue;
    }
    const isSell = event.amount < 0 && (op.includes('sold') || op.includes('sell'));
    const isRevenue = event.amount > 0 && op.includes('revenue');
    const isSpend =
      event.amount < 0 &&
      (op.includes('spend') || op.includes('deposit') || op.includes('convert') || op.includes('withdraw'));
    const isBuy =
      event.amount > 0 && (op.includes('buy') || op.includes('convert') || op.includes('earn'));

    if (isSell) {
      const revenueMatch = findMatch(pendingRevenues, event);
      if (revenueMatch) {
        addSellTransaction(event, revenueMatch);
      } else {
        pendingSells.push(event);
      }
      evictStale(pendingRevenues, event);
      evictStale(pendingSells, event);
      continue;
    }

    if (isRevenue) {
      const sellMatch = findMatch(pendingSells, event);
      if (sellMatch) {
        addSellTransaction(sellMatch, event);
      } else {
        pendingRevenues.push(event);
      }
      evictStale(pendingSells, event);
      evictStale(pendingRevenues, event);
      continue;
    }

    if (isBuy) {
      const spendMatch = findMatch(pendingSpends, event);
      if (spendMatch) {
        addBuyTransaction(event, spendMatch);
      } else {
        pendingBuys.push(event);
      }
      evictStale(pendingBuys, event);
      evictStale(pendingSpends, event);
      continue;
    }

    if (isSpend) {
      const buyMatch = findMatch(pendingBuys, event);
      if (buyMatch) {
        addBuyTransaction(buyMatch, event);
      } else {
        pendingSpends.push(event);
      }
      evictStale(pendingBuys, event);
      evictStale(pendingSpends, event);
      continue;
    }
  }

  return transactions;
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
  const sanitizedCsv = stripPrelude(csv);
  const records = parse(sanitizedCsv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: [',', ';', '\t'],
    trim: true,
    relax_column_count: true,
    skip_records_with_error: true,
  }) as CsvRecord[];
  const rows = parser(records).filter((row) => row.quantity !== 0 && row.price !== 0);
  const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
  if (!portfolio) {
    throw new Error('Portefeuille introuvable');
  }

  let createdCount = 0;
  let skippedCount = 0;

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

    const quantityString = row.quantity.toString();
    const priceString = row.price.toString();
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        assetId: targetAsset.id,
        type: row.transactionType,
        date: row.date,
        quantity: quantityString,
        price: priceString,
        source: row.source,
      },
    });

    if (existingTransaction) {
      skippedCount += 1;
    } else {
      await prisma.transaction.create({
        data: {
          assetId: targetAsset.id,
          type: row.transactionType,
          quantity: quantityString,
          price: priceString,
          date: row.date,
          source: row.source,
        },
      });
      createdCount += 1;
    }

    await prisma.pricePoint.upsert({
      where: {
        assetId_date: {
          assetId: targetAsset.id,
          date: row.date,
        },
      },
      update: {
        price: priceString,
        source: row.source,
      },
      create: {
        assetId: targetAsset.id,
        date: row.date,
        price: priceString,
        source: row.source,
      },
    });
  }

  return { imported: createdCount, skipped: skippedCount };
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


