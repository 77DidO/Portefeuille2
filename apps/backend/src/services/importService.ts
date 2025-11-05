import { parse } from 'csv-parse/sync';
import { prisma } from '../prismaClient.js';
import type { TransactionType, AssetType, PortfolioCategory } from '@portefeuille/types';
import { isValid, parseISO } from 'date-fns';
import { getSpotPriceInEur, refreshAssetPrice } from './priceUpdateService.js';

interface ParsedRow {
  symbol: string;
  name: string;
  type: AssetType;
  date: Date;
  price: number;
  quantity: number;
  transactionType: TransactionType;
  source: string;
  fee?: number | null;
  isSnapshot?: boolean;
  originalSymbol?: string | null;
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

const normaliseText = (value: string | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

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
    if (normalised.includes('date')) {
      return true;
    }
    if (normalised.includes('nom') && normalised.includes('isin')) {
      return true;
    }
    return false;
  });
  const relevantLines = startIndex >= 0 ? lines.slice(startIndex) : lines;
  return relevantLines.join('\n');
};

type CsvParser = (records: CsvRecord[]) => Promise<ParsedRow[]> | ParsedRow[];

const PEA_CASH_SYMBOL = '_PEA_CASH';
const PEA_CASH_NAME = 'PEA - Liquidites';
const CREDIT_AGRICOLE_CASH_SYMBOLS = new Set(['000007859050']);
const CREDIT_AGRICOLE_CASH_KEYWORDS = ['cl brie', 'compte espece', 'pea liquidite', 'tresorerie pea'];
const CREDIT_AGRICOLE_LEGACY_SYMBOLS = Array.from(CREDIT_AGRICOLE_CASH_SYMBOLS);

const ensureCreditAgricoleCashAsset = async (portfolioId: number) => {
  let asset = await prisma.asset.findFirst({
    where: {
      portfolioId,
      symbol: PEA_CASH_SYMBOL,
    },
  });

  if (!asset) {
    asset = await prisma.asset.create({
      data: {
        portfolioId,
        symbol: PEA_CASH_SYMBOL,
        name: PEA_CASH_NAME,
        assetType: 'OTHER',
      },
    });
  }

  return asset;
};

const mergeCreditAgricoleLegacyCashAssets = async (portfolioId: number) => {
  const legacyAssets = await prisma.asset.findMany({
    where: {
      portfolioId,
      symbol: { in: CREDIT_AGRICOLE_LEGACY_SYMBOLS },
    },
  });

  if (legacyAssets.length === 0) {
    return;
  }

  const targetAsset = await ensureCreditAgricoleCashAsset(portfolioId);

  for (const legacy of legacyAssets) {
    if (legacy.id === targetAsset.id) {
      continue;
    }

    await prisma.transaction.updateMany({
      where: { assetId: legacy.id },
      data: { assetId: targetAsset.id },
    });

    await prisma.pricePoint.deleteMany({
      where: { assetId: legacy.id },
    });

    await prisma.asset.delete({
      where: { id: legacy.id },
    });
  }
};

const parseCreditAgricole = (records: CsvRecord[]): ParsedRow[] => {
  const transactions: ParsedRow[] = [];

  records.forEach((record) => {
    const row = normaliseHeaders(record);
    const rawSymbol =
      row['isin'] ||
      row['code'] ||
      row['ticker'] ||
      row['libelle'] ||
      row['nom'] ||
      row['reference'];
    const rawName =
      row['libelle'] ||
      row['nom'] ||
      row['valeur'] ||
      row['designation'] ||
      rawSymbol ||
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
    const amountNet = normaliseNumber(row['montant net'] || row['montant'] || row['montantnet']);
    const feeRaw = normaliseNumber(row['frais']);
    let fee = feeRaw !== 0 ? Math.abs(feeRaw) : null;
    if (fee === null && quantity !== 0 && price !== 0 && amountNet !== 0) {
      const theoretical = Math.abs(price * quantity);
      const netAmount = Math.abs(amountNet);
      const diff = Math.abs(netAmount - theoretical);
      if (diff >= 0.005) {
        fee = Number(diff.toFixed(2));
      }
    }
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

    const date = dateRaw ? normaliseDate(dateRaw) : new Date();

    const symbolNormalised = normaliseText(rawSymbol ?? '');
    const nameNormalised = normaliseText(rawName ?? '');
    const isCashPlaceholder =
      (symbolNormalised && CREDIT_AGRICOLE_CASH_SYMBOLS.has(symbolNormalised)) ||
      CREDIT_AGRICOLE_CASH_KEYWORDS.some((keyword) => nameNormalised.includes(keyword));

    const symbol = isCashPlaceholder ? PEA_CASH_SYMBOL : rawSymbol;
    const name = isCashPlaceholder ? PEA_CASH_NAME : rawName;
    const originalSymbol = isCashPlaceholder ? rawSymbol ?? null : null;

    const isSnapshotRow =
      !dateRaw &&
      quantity !== 0 &&
      Boolean(
        row['valorisation en euro'] ||
          row['valorisationeneuro'] ||
          row['valorisation'] ||
          row['cours'] ||
          row['prix de revient'] ||
          row['prixderevient'],
      );
    const rowSource = isSnapshotRow ? 'credit-agricole-snapshot' : 'credit-agricole';

    const operation = normaliseText(
      row['operation'] ||
        row['typedoperation'] ||
        row['type'] ||
        row['type d operation'] ||
        row['sens'],
    );
    const isCashOnlyOperation =
      operation.includes('versement') ||
      operation.includes('remboursement') ||
      operation.includes('plaf') ||
      operation.includes('coupon') ||
      operation.includes('dividende') ||
      operation.includes('interet') ||
      operation.includes('intérêt') ||
      operation.includes('taxe');

    const hasAsset = quantity !== 0 && Boolean(symbol) && !isCashOnlyOperation && !isCashPlaceholder;
    const effectivePrice =
      price === 0 && quantity !== 0 && amountNet !== 0
        ? (() => {
            const gross =
              transactionType === 'BUY'
                ? Math.abs(amountNet) - Math.abs(fee ?? 0)
                : Math.abs(amountNet) + Math.abs(fee ?? 0);
            return gross > 0 ? gross / Math.abs(quantity) : 0;
          })()
        : price;
    if (isCashPlaceholder && isSnapshotRow) {
      transactions.push({
        symbol: PEA_CASH_SYMBOL,
        name: PEA_CASH_NAME,
        type: 'OTHER',
        date,
        price: 1,
        quantity,
        transactionType,
        source: rowSource,
        isSnapshot: true,
        originalSymbol,
      });
      return;
    }

    if (hasAsset && effectivePrice > 0) {
      transactions.push({
        symbol: symbol ?? name ?? 'INCONNU',
        name: name ?? symbol ?? 'Valeur Credit Agricole',
        type: 'STOCK',
        date,
        price: effectivePrice,
        quantity,
        transactionType,
        source: rowSource,
        fee,
        isSnapshot: isSnapshotRow || undefined,
        originalSymbol,
      });
    }

    const cashImpact =
      amountNet !== 0 ||
      operation.includes('versement') ||
      operation.includes('remboursement') ||
      operation.includes('retrait') ||
      isCashPlaceholder;

    if (!cashImpact) {
      return;
    }

    if (amountNet === 0) {
      if (!isCashPlaceholder) {
        return;
      }
      const inferredQuantity = Math.abs(quantity);
      if (inferredQuantity === 0) {
        return;
      }
      transactions.push({
        symbol: PEA_CASH_SYMBOL,
        name: PEA_CASH_NAME,
        type: 'OTHER',
        date,
        price: 1,
        quantity: inferredQuantity,
        transactionType: quantity >= 0 ? 'BUY' : 'SELL',
        source: rowSource,
        isSnapshot: true,
        originalSymbol,
      });
      return;
    }

    const transactionTypeForCash = amountNet > 0 ? 'BUY' : 'SELL';

    // Determine the source type for cash transactions
    let cashSource = 'credit-agricole';
    if (operation.includes('coupon') || operation.includes('dividende')) {
      cashSource = 'dividend';
    } else if (operation.includes('remboursement') && operation.includes('plaf')) {
      cashSource = 'tax-refund';
    }
    
    transactions.push({
      symbol: PEA_CASH_SYMBOL,
      name: PEA_CASH_NAME,
      type: 'OTHER',
      date,
      price: 1,
      quantity: Math.abs(amountNet),
      transactionType: transactionTypeForCash,
      source: cashSource,
      originalSymbol,
    });
  });

  return transactions;
};

const parseBinance = async (records: CsvRecord[]): Promise<ParsedRow[]> => {
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

  const rateCache = new Map<string, number>();
  const getRate = async (coin: string) => {
    const normalised = coin.trim().toUpperCase();
    if (!normalised) {
      return 0;
    }
    if (normalised === 'EUR') {
      return 1;
    }
    const cached = rateCache.get(normalised);
    if (cached) {
      return cached;
    }
    const { price } = await getSpotPriceInEur(normalised);
    rateCache.set(normalised, price);
    return price;
  };

  const convertToEur = async (coin: string, amount: number) => {
    const rate = await getRate(coin);
    return rate * amount;
  };

  const windowMs = 2 * 60 * 1000;
  const pendingSpends: BinanceEvent[] = [];
  const pendingBuys: BinanceEvent[] = [];
  const pendingSells: BinanceEvent[] = [];
  const pendingRevenues: BinanceEvent[] = [];
  const pendingFees: BinanceEvent[] = [];
  const transactions: ParsedRow[] = [];

  const takeAssociatedFee = async (...referenceEvents: BinanceEvent[]) => {
    if (pendingFees.length === 0 || referenceEvents.length === 0) {
      return null;
    }

    const collected: BinanceEvent[] = [];
    for (let i = pendingFees.length - 1; i >= 0; i -= 1) {
      const feeEvent = pendingFees[i];
      const bestDiff = referenceEvents.reduce<number>((current, ref) => {
        const diff = Math.abs(feeEvent.timestamp.getTime() - ref.timestamp.getTime());
        return diff < current ? diff : current;
      }, Number.POSITIVE_INFINITY);

      if (bestDiff <= windowMs) {
        collected.push(pendingFees.splice(i, 1)[0]);
      }
    }

    if (collected.length === 0) {
      return null;
    }

    let totalFeeEur = 0;
    for (const feeEvent of collected) {
      const amount = Math.abs(feeEvent.amount);
      if (amount <= 0) {
        continue;
      }
      const feeInEur = await convertToEur(feeEvent.coin, amount);
      if (Number.isFinite(feeInEur) && feeInEur > 0) {
        totalFeeEur += feeInEur;
      }
    }

    if (totalFeeEur <= 0) {
      return null;
    }
    return Number(totalFeeEur.toFixed(8));
  };

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

  const addBuyTransaction = async (buyEvent: BinanceEvent, spendEvent: BinanceEvent) => {
    const quantity = buyEvent.amount;
    const spendQuantity = Math.abs(spendEvent.amount);
    if (quantity <= 0 || spendQuantity <= 0) {
      return;
    }
    const spendInEur = await convertToEur(spendEvent.coin, spendQuantity);
    if (spendInEur <= 0) {
      return;
    }
    const pricePerUnitEur = spendInEur / quantity;
    if (!Number.isFinite(pricePerUnitEur) || pricePerUnitEur <= 0) {
      return;
    }
    const fee = await takeAssociatedFee(buyEvent, spendEvent);
    transactions.push({
      symbol: buyEvent.coin,
      name: buyEvent.coin,
      type: 'CRYPTO',
      date: buyEvent.timestamp,
      price: pricePerUnitEur,
      quantity,
      transactionType: 'BUY',
      source: 'binance',
      fee: fee ?? undefined,
    });
    const spendUnitPriceEur = spendInEur / spendQuantity;
    transactions.push({
      symbol: spendEvent.coin,
      name: spendEvent.coin,
      type: 'CRYPTO',
      date: spendEvent.timestamp,
      price: spendUnitPriceEur,
      quantity: spendQuantity,
      transactionType: 'SELL',
      source: 'binance',
    });
  };

  const addSellTransaction = async (sellEvent: BinanceEvent, revenueEvent: BinanceEvent) => {
    const quantity = Math.abs(sellEvent.amount);
    const revenueQuantity = revenueEvent.amount;
    if (quantity <= 0 || revenueQuantity <= 0) {
      return;
    }
    const revenueInEur = await convertToEur(revenueEvent.coin, revenueQuantity);
    if (revenueInEur <= 0) {
      return;
    }
    const pricePerUnitEur = revenueInEur / quantity;
    if (!Number.isFinite(pricePerUnitEur) || pricePerUnitEur <= 0) {
      return;
    }
    const fee = await takeAssociatedFee(sellEvent, revenueEvent);
    transactions.push({
      symbol: sellEvent.coin,
      name: sellEvent.coin,
      type: 'CRYPTO',
      date: sellEvent.timestamp,
      price: pricePerUnitEur,
      quantity,
      transactionType: 'SELL',
      source: 'binance',
      fee: fee ?? undefined,
    });
    const revenueUnitPriceEur = revenueInEur / revenueQuantity;
    transactions.push({
      symbol: revenueEvent.coin,
      name: revenueEvent.coin,
      type: 'CRYPTO',
      date: revenueEvent.timestamp,
      price: revenueUnitPriceEur,
      quantity: revenueQuantity,
      transactionType: 'BUY',
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
    evictStale(pendingFees, event);
    const op = event.operation;
    const isFee = op.includes('fee');
    if (isFee) {
      pendingFees.push(event);
      continue;
    }

    const isSimpleDeposit =
      event.amount > 0 &&
      op.includes('deposit') &&
      !op.includes('convert') &&
      !op.includes('trade') &&
      !op.includes('buy');
    if (isSimpleDeposit) {
      const rate = await getRate(event.coin);
      if (rate > 0) {
        const fee = await takeAssociatedFee(event);
        transactions.push({
          symbol: event.coin,
          name: event.coin,
          type: 'CRYPTO',
          date: event.timestamp,
          price: rate,
          quantity: event.amount,
          transactionType: 'BUY',
          source: 'binance',
          fee: fee ?? undefined,
        });
      }
      continue;
    }

    const isSimpleWithdraw =
      event.amount < 0 &&
      op.includes('withdraw') &&
      !op.includes('convert') &&
      !op.includes('trade') &&
      !op.includes('sell');
    if (isSimpleWithdraw) {
      const quantity = Math.abs(event.amount);
      const rate = await getRate(event.coin);
      if (rate > 0) {
        const fee = await takeAssociatedFee(event);
        transactions.push({
          symbol: event.coin,
          name: event.coin,
          type: 'CRYPTO',
          date: event.timestamp,
          price: rate,
          quantity,
          transactionType: 'SELL',
          source: 'binance',
          fee: fee ?? undefined,
        });
      }
      continue;
    }

    const isSell = event.amount < 0 && (op.includes('sold') || op.includes('sell'));
    const isRevenue = event.amount > 0 && op.includes('revenue');
    const isSpend =
      event.amount < 0 &&
      (op.includes('spend') || op.includes('convert') || op.includes('trade') || op.includes('deposit'));
    const isBuy =
      event.amount > 0 && (op.includes('buy') || op.includes('convert') || op.includes('earn') || op.includes('trade'));

    if (isSell) {
      const revenueMatch = findMatch(pendingRevenues, event);
      if (revenueMatch) {
        await addSellTransaction(event, revenueMatch);
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
        await addSellTransaction(sellMatch, event);
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
        await addBuyTransaction(event, spendMatch);
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
        await addBuyTransaction(buyMatch, event);
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

const parserBySource: Record<string, CsvParser> = {
  'credit-agricole': parseCreditAgricole,
  binance: parseBinance,
  coinbase: parseCoinbase,
};

export const importCsv = async (portfolioId: number, source: keyof typeof parserBySource, csv: string) => {
  const parser = parserBySource[source];
  if (!parser) {
    throw new Error(`Source CSV inconnue: ${source}`);
  }

  if (source === 'credit-agricole') {
    await mergeCreditAgricoleLegacyCashAssets(portfolioId);
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
  const parsedRows = await parser(records);
  const rows = parsedRows.filter((row) => row.quantity !== 0 && (row.price !== 0 || row.isSnapshot));
  const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
  if (!portfolio) {
    throw new Error('Portefeuille introuvable');
  }

  let createdCount = 0;
  let skippedCount = 0;
  const touchedAssetIds = new Set<number>();

  for (const row of rows) {
    const asset = await prisma.asset.findFirst({
      where: {
        portfolioId,
        symbol: row.symbol,
      },
      include: {
        transactions: true,
      },
    });
    const transactionsForAsset = asset?.transactions ?? [];
    let targetAsset =
      asset ??
      (await prisma.asset.create({
        data: {
          portfolioId,
          symbol: row.symbol,
          name: row.name,
          assetType: row.type,
        },
      }));

    if (row.name?.trim()) {
      const desiredName = row.name.trim();
      const currentName = targetAsset.name?.trim() ?? '';
      const symbolUpper = (targetAsset.symbol ?? '').trim().toUpperCase();
      if (!currentName || currentName.toUpperCase() === symbolUpper) {
        targetAsset = await prisma.asset.update({
          where: { id: targetAsset.id },
          data: { name: desiredName },
        });
      }
    }

    const positivePrice = row.price > 0 ? row.price : 0;

    if (row.isSnapshot) {
      const snapshotPrice = positivePrice > 0 ? positivePrice : 1;
      const netQuantity = transactionsForAsset.reduce((acc, tx) => {
        const qty = Number(tx.quantity);
        if (!Number.isFinite(qty)) {
          return acc;
        }
        return tx.type === 'BUY' ? acc + qty : acc - qty;
      }, 0);
      const delta = Number((row.quantity - netQuantity).toFixed(8));
      if (Math.abs(delta) > 1e-6) {
        const adjustmentType: TransactionType = delta > 0 ? 'BUY' : 'SELL';
        const adjustmentQuantity = Math.abs(delta);
        const adjustmentPrice = snapshotPrice;
        await prisma.transaction.create({
          data: {
            assetId: targetAsset.id,
            type: adjustmentType,
            quantity: adjustmentQuantity.toString(),
            price: adjustmentPrice.toString(),
            date: row.date,
            source: row.source,
            note: 'snapshot-adjustment',
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
          price: snapshotPrice.toString(),
          source: row.source,
        },
        create: {
          assetId: targetAsset.id,
          date: row.date,
          price: snapshotPrice.toString(),
          source: row.source,
        },
      });
      touchedAssetIds.add(targetAsset.id);
      continue;
    }

    const quantityString = row.quantity.toString();
    const priceString = positivePrice.toString();
    const feeString = row.fee !== undefined && row.fee !== null && row.fee !== 0 ? row.fee.toString() : null;
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        assetId: targetAsset.id,
        type: row.transactionType,
        date: row.date,
        quantity: quantityString,
        source: row.source,
      },
    });

    if (existingTransaction) {
      const updates: Record<string, string | null> = {};
      const currentPrice = existingTransaction.price ? existingTransaction.price.toString() : null;
      if (priceString !== currentPrice) {
        updates.price = priceString;
      }
      const currentFee = existingTransaction.fee ? existingTransaction.fee.toString() : null;
      if (feeString !== null) {
        if (currentFee !== feeString) {
          updates.fee = feeString;
        }
      } else if (currentFee !== null) {
        updates.fee = null;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.transaction.update({
          where: { id: existingTransaction.id },
          data: updates,
        });
      }
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
          fee: feeString ?? undefined,
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
    touchedAssetIds.add(targetAsset.id);
  }

  if (touchedAssetIds.size > 0) {
    const now = new Date();
    const assetIds = Array.from(touchedAssetIds);

    await Promise.all(
      assetIds.map((assetId) =>
        prisma.asset.update({
          where: { id: assetId },
          data: { lastPriceUpdateAt: now },
        }),
      ),
    );

    // Trigger price refresh in background after import (non-blocking)
    setImmediate(() => {
      (async () => {
        for (const assetId of assetIds) {
          try {
            await refreshAssetPrice(assetId);
          } catch {
            // Ignore refresh errors; manual refresh remains available.
          }
        }
      })();
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




