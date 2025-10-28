'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type { PortfolioCategory, TransactionHistoryItem } from '@portefeuille/types';
import { api } from '@/lib/api';

const BASE_FIAT_SYMBOLS = new Set(['EUR', 'USD', 'GBP']);
const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD']);
const CASH_SYMBOLS = new Set(['PEA_CASH', '_PEA_CASH', 'CASH', ...BASE_FIAT_SYMBOLS]);

const normalizeSymbol = (symbol: string | null | undefined) => symbol?.trim().toUpperCase() ?? '';

const isCashSymbol = (symbol: string | null | undefined): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return false;
  return normalized.endsWith('_CASH') || CASH_SYMBOLS.has(normalized);
};

const isCashLike = (tx: TransactionHistoryItem): boolean => {
  if (!tx) return false;
  if (tx.assetType === 'OTHER') return true;
  if (isCashSymbol(tx.assetSymbol)) return true;
  if (
    tx.assetType === 'CRYPTO' &&
    (BASE_FIAT_SYMBOLS.has(normalizeSymbol(tx.assetSymbol)) ||
      STABLECOIN_SYMBOLS.has(normalizeSymbol(tx.assetSymbol)))
  ) {
    return true;
  }
  return false;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
};

const computeSignedAmount = (tx: TransactionHistoryItem): number => {
  const quantity = toNumber(tx.quantity);
  const price = toNumber(tx.price);
  const fee = toNumber(tx.fee);
  const gross = quantity * price;
  return tx.type === 'SELL' ? gross - fee : -(gross + fee);
};

const getAssetLabel = (tx: TransactionHistoryItem): string =>
  tx.assetName?.trim() || normalizeSymbol(tx.assetSymbol) || `Actif #${tx.assetId}`;

const getCategoryLabel = (category: PortfolioCategory | null | undefined): string => {
  switch (category) {
    case 'CRYPTO':
      return 'Crypto';
    case 'PEA':
      return 'PEA';
    case 'GLOBAL':
      return 'Global';
    case 'OTHER':
      return 'Autre';
    default:
      return 'Non classé';
  }
};

const getCategoryClass = (category: PortfolioCategory | null | undefined): string => {
  switch (category) {
    case 'CRYPTO':
      return 'chip--category-crypto';
    case 'PEA':
      return 'chip--category-pea';
    case 'GLOBAL':
      return 'chip--category-global';
    case 'OTHER':
      return 'chip--category-other';
    default:
      return 'chip--category-uncategorised';
  }
};

type CombinedDisplayRow = {
  key: string;
  kind: 'combined';
  main: TransactionHistoryItem;
  counter: TransactionHistoryItem;
  mainAmount: number;
  counterAmount: number;
  totalFee: number;
  direction: string;
};

type SingleDisplayRow = {
  key: string;
  kind: 'single';
  transaction: TransactionHistoryItem;
  amount: number;
  fee: number;
};

type DisplayRow = CombinedDisplayRow | SingleDisplayRow;

const buildDisplayRows = (transactions: TransactionHistoryItem[]): DisplayRow[] => {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const used = new Set<number>();
  const rows: DisplayRow[] = [];
  const windowMs = 2 * 60 * 1000;

  for (let i = 0; i < sorted.length; i += 1) {
    const base = sorted[i];
    if (used.has(base.id)) continue;

    const basePortfolio = base.portfolioId ?? null;
    const baseAmountAbs = Math.abs(computeSignedAmount(base));
    const baseTime = new Date(base.date).getTime();
    const baseIsCash = isCashLike(base);

    let best: TransactionHistoryItem | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let j = i + 1; j < sorted.length; j += 1) {
      const candidate = sorted[j];
      if (used.has(candidate.id) || candidate.id === base.id) continue;
      if ((candidate.portfolioId ?? null) !== basePortfolio) continue;
      if (candidate.type === base.type) continue;

      const deltaTime = Math.abs(new Date(candidate.date).getTime() - baseTime);
      if (deltaTime > windowMs) continue;

      const candidateAmountAbs = Math.abs(computeSignedAmount(candidate));
      const tolerance = Math.max(
        1,
        (baseAmountAbs + candidateAmountAbs) * 0.03 +
          Math.abs(toNumber(base.fee)) +
          Math.abs(toNumber(candidate.fee)),
      );
      const diff = Math.abs(baseAmountAbs - candidateAmountAbs);
      if (diff > tolerance) continue;

      const candidateIsCash = isCashLike(candidate);
      const scorePenalty = baseIsCash !== candidateIsCash ? 0 : 25;
      const score = diff + deltaTime / 1000 + scorePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best) {
      used.add(base.id);
      used.add(best.id);

      let main = base;
      let counter = best;
      if (isCashLike(base) && !isCashLike(best)) {
        main = best;
        counter = base;
      }

      const mainAmount = computeSignedAmount(main);
      const counterAmount = computeSignedAmount(counter);
      const mainLabel = getAssetLabel(main);
      const counterLabel = getAssetLabel(counter);
      const keyIds = [main.id, counter.id].sort((a, b) => a - b);

      rows.push({
        key: `pair-${keyIds[0]}-${keyIds[1]}`,
        kind: 'combined',
        main,
        counter,
        mainAmount,
        counterAmount,
        totalFee: toNumber(main.fee) + toNumber(counter.fee),
        direction: `${counterLabel} → ${mainLabel}`,
      });
      continue;
    }

    used.add(base.id);
    rows.push({
      key: `tx-${base.id}`,
      kind: 'single',
      transaction: base,
      amount: computeSignedAmount(base),
      fee: toNumber(base.fee),
    });
  }

  return rows;
};

const quantityFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatAmount = (value: number): string => currencyFormatter.format(value);
const formatQuantity = (value: number): string => quantityFormatter.format(value);
const formatDateTime = (input: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input));

export default function HistoryPage() {
  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | PortfolioCategory | 'UNCATEGORISED'
  >('ALL');
  const [selectedPortfolio, setSelectedPortfolio] = useState<number | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const transactionsQuery = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.getTransactions({ limit: 800 }),
    staleTime: 30_000,
  });

  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 30_000,
  });

  const transactions = transactionsQuery.data ?? [];
  const portfolios = portfoliosQuery.data ?? [];

  const portfolioColorMap = useMemo(() => {
    const map = new Map<number, string>();
    portfolios.forEach((p) => {
      const defaultColors: Record<string, string> = {
        GLOBAL: '#4ade80',
        CRYPTO: '#fbbf24',
        PEA: '#60a5fa',
        OTHER: '#a78bfa',
      };
      const color = p.color || defaultColors[p.category] || '#a78bfa';
      map.set(p.id, color);
    });
    return map;
  }, [portfolios]);

  const portfolioOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; category: PortfolioCategory | null }>();
    transactions.forEach((tx) => {
      if (tx.portfolioId !== null) {
        map.set(tx.portfolioId, {
          id: tx.portfolioId,
          name: tx.portfolioName ?? `Portefeuille #${tx.portfolioId}`,
          category: tx.portfolioCategory ?? null,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [transactions]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<PortfolioCategory | 'UNCATEGORISED', number>();
    transactions.forEach((tx) => {
      const key = (tx.portfolioCategory ?? 'UNCATEGORISED') as
        | PortfolioCategory
        | 'UNCATEGORISED';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      const txCategory = tx.portfolioCategory ?? 'UNCATEGORISED';
      if (selectedCategory !== 'ALL' && txCategory !== selectedCategory) return false;
      if (selectedPortfolio !== 'ALL' && tx.portfolioId !== selectedPortfolio) return false;
      if (!needle) return true;
      const haystack = [tx.assetName, tx.assetSymbol, tx.portfolioName, tx.source, tx.note]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [transactions, selectedCategory, selectedPortfolio, searchTerm]);

  const displayRows = useMemo(
    () => buildDisplayRows(filteredTransactions),
    [filteredTransactions],
  );

  useEffect(() => {
    const updateStickyOffset = () => {
      const header = document.querySelector<HTMLElement>('.app-header');
      const pageHeader = document.querySelector<HTMLElement>('.page-header');
      const filters = document.querySelector<HTMLElement>('.history-filters');
      const panel = document.querySelector<HTMLElement>('.history-panel');

      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const pageHeaderHeight = pageHeader?.getBoundingClientRect().height ?? 0;
      const filtersHeight = filters?.getBoundingClientRect().height ?? 0;

      // account for panel padding-top if present
      let panelPaddingTop = 0;
      if (panel) {
        const cs = getComputedStyle(panel);
        panelPaddingTop = parseFloat(cs.paddingTop) || 0;
      }

      // small buffer to avoid touching the header edge
      const buffer = window.innerWidth < 768 ? 10 : 16;

      const offset = headerHeight + pageHeaderHeight + filtersHeight + panelPaddingTop + buffer;

      document.documentElement.style.setProperty('--history-sticky-offset', `${offset}px`);
    };

    updateStickyOffset();
    window.addEventListener('resize', updateStickyOffset);
    return () => {
      window.removeEventListener('resize', updateStickyOffset);
      document.documentElement.style.removeProperty('--history-sticky-offset');
    };
  }, []);

  useEffect(() => {
    if (!expandedKey) return;
    if (!displayRows.some((row) => row.key === expandedKey)) {
      setExpandedKey(null);
    }
  }, [displayRows, expandedKey]);

  const toggleRow = (key: string) => {
    setExpandedKey((current) => (current === key ? null : key));
  };

  const categoryItems: Array<{
    key: 'ALL' | PortfolioCategory | 'UNCATEGORISED';
    label: string;
    count: number;
  }> = [
    { key: 'ALL', label: 'Catégories', count: transactions.length },
    ...Array.from(categoryCounts.entries()).map(([key, count]) => ({
      key,
      label: getCategoryLabel(key === 'UNCATEGORISED' ? null : key),
      count,
    })),
  ];

const renderDetailContent = (row: DisplayRow) => {
  const detailTransactions =
    row.kind === 'combined' ? [row.main, row.counter] : [row.transaction];
  return (
    <div className="table-responsive history-detail-table-wrapper">
      <table className="history-detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Actif</th>
            <th>Quantité</th>
            <th>Prix</th>
            <th>Frais</th>
            <th>Montant</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {detailTransactions.map((tx) => {
            const amount = computeSignedAmount(tx);
            return (
              <tr key={tx.id}>
                <td>{formatDateTime(tx.date)}</td>
                <td>
                  <span
                    className={clsx('tx-chip', {
                      'tx-chip--buy': tx.type === 'BUY',
                      'tx-chip--sell': tx.type === 'SELL',
                      'tx-chip--other': tx.type !== 'BUY' && tx.type !== 'SELL',
                    })}
                  >
                    {tx.type === 'BUY' ? 'Achat' : tx.type === 'SELL' ? 'Vente' : tx.type}
                  </span>
                </td>
                <td>
                  <div className="history-detail__tx-asset">
                    <span>{getAssetLabel(tx)}</span>
                    <span className="history-detail__tx-symbol">
                      {normalizeSymbol(tx.assetSymbol) || '-'}
                    </span>
                  </div>
                </td>
                <td>{formatQuantity(toNumber(tx.quantity))}</td>
                <td>{formatAmount(toNumber(tx.price))}</td>
                <td>{tx.fee ? formatAmount(toNumber(tx.fee)) : ''}</td>
                <td>
                  <span
                    className={clsx('history-amount', {
                      plus: amount >= 0,
                      minus: amount < 0,
                    })}
                  >
                    {formatAmount(amount)}
                  </span>
                </td>
                <td>{tx.source ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

  return (
    <main className="history-page">
      <header className="page-header">
        <h1>Historique des transactions</h1>
        <p>Visualisez vos opérations classées par portefeuille et par flux.</p>
      </header>

      {transactionsQuery.isLoading && (
        <div className="card">
          <p style={{ color: '#94a3b8' }}>Chargement des transactions...</p>
        </div>
      )}

      {transactionsQuery.isError && (
        <div className="card">
          <div className="alert error">Impossible de charger l&apos;historique pour le moment.</div>
        </div>
      )}

      {!transactionsQuery.isLoading && !transactionsQuery.isError && (
        <section className="history-panel">
          <div className="history-filters">
            <div className="filter-group" role="group" aria-label="Filtrer par catégorie">
              <span className="filter-group__label">Catégories</span>
              <div className="filter-group__pills">
                {categoryItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={
                      selectedCategory === item.key
                        ? 'filter-pill filter-pill--active'
                        : 'filter-pill'
                    }
                    onClick={() => setSelectedCategory(item.key)}
                  >
                    <span>{item.label}</span>
                    <span className="filter-pill__count">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="history-select">
              <span>Portefeuille</span>
              <select
                value={selectedPortfolio === 'ALL' ? 'ALL' : String(selectedPortfolio)}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedPortfolio(value === 'ALL' ? 'ALL' : Number(value));
                }}
              >
                <option value="ALL">Tous</option>
                {portfolioOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="history-search">
              <span>Recherche</span>
              <input
                type="search"
                placeholder="Ticker, portefeuille, source..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
          </div>

          {displayRows.length === 0 ? (
            <div className="history-empty">
              <p>Aucune transaction ne correspond aux filtres sélectionnés.</p>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Portefeuille</th>
                    <th>Mouvement</th>
                    <th>Type</th>
                    <th>Quantité</th>
                    <th>Prix</th>
                    <th>Montant actif</th>
                    <th>Flux</th>
                    <th>Frais</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const isExpanded = expandedKey === row.key;
                    const portfolioName =
                      (row.kind === 'combined'
                        ? row.main.portfolioName
                        : row.transaction.portfolioName) ?? 'Portefeuille';
                    const portfolioCategory =
                      row.kind === 'combined'
                        ? row.main.portfolioCategory
                        : row.transaction.portfolioCategory;
                    const portfolioId =
                      row.kind === 'combined'
                        ? row.main.portfolioId
                        : row.transaction.portfolioId;
                    const portfolioColor = portfolioId ? portfolioColorMap.get(portfolioId) : undefined;
                    return (
                      <Fragment key={row.key}>
                        <tr
                          className={isExpanded ? 'history-row history-row--expanded' : 'history-row'}
                          onClick={() => toggleRow(row.key)}
                        >
                          <td>
                            {formatDateTime(
                              row.kind === 'combined' ? row.main.date : row.transaction.date,
                            )}
                          </td>
                          <td>
                            <span 
                              className={`chip ${getCategoryClass(portfolioCategory)}`}
                              style={portfolioColor ? {
                                backgroundColor: `${portfolioColor}1A`,
                                borderColor: `${portfolioColor}50`,
                                color: portfolioColor,
                              } : undefined}
                            >
                              {portfolioColor && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: portfolioColor,
                                    marginRight: '6px',
                                  }}
                                />
                              )}
                              {portfolioName}
                            </span>
                          </td>
                          <td>
                            {row.kind === 'combined' ? (
                              <div className="history-asset">
                                <span className="history-asset__name">{getAssetLabel(row.main)}</span>
                                <span className="history-asset__symbol">
                                  {normalizeSymbol(row.main.assetSymbol) || 'N/A'}
                                </span>
                                <span className="history-asset__direction">{row.direction}</span>
                              </div>
                            ) : (
                              <div className="history-asset">
                                <span className="history-asset__name">
                                  {getAssetLabel(row.transaction)}
                                </span>
                                <span className="history-asset__symbol">
                                  {normalizeSymbol(row.transaction.assetSymbol) || 'N/A'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              className={
                                row.kind === 'combined'
                                  ? row.main.type === 'BUY'
                                    ? 'chip chip--buy'
                                    : 'chip chip--sell'
                                  : row.transaction.type === 'BUY'
                                  ? 'chip chip--buy'
                                  : 'chip chip--sell'
                              }
                            >
                              {row.kind === 'combined'
                                ? row.main.type === 'BUY'
                                  ? 'Achat'
                                  : 'Vente'
                                : row.transaction.type === 'BUY'
                                ? 'Achat'
                                : 'Vente'}
                            </span>
                          </td>
                          <td>
                            {formatQuantity(
                              toNumber(
                                row.kind === 'combined'
                                  ? row.main.quantity
                                  : row.transaction.quantity,
                              ),
                            )}
                          </td>
                          <td>
                            {formatAmount(
                              toNumber(
                                row.kind === 'combined' ? row.main.price : row.transaction.price,
                              ),
                            )}
                          </td>
                          <td>
                            <span
                              className={
                                (row.kind === 'combined' ? row.mainAmount : row.amount) >= 0
                                  ? 'history-amount plus'
                                  : 'history-amount minus'
                              }
                            >
                              {formatAmount(
                                row.kind === 'combined' ? row.mainAmount : row.amount,
                              )}
                            </span>
                          </td>
                          <td>
                            {row.kind === 'combined' ? (
                              <span
                                className={
                                  row.counterAmount >= 0
                                    ? 'history-amount plus'
                                    : 'history-amount minus'
                                }
                              >
                                {formatAmount(row.counterAmount)}
                              </span>
                            ) : (
                              <span className="history-amount neutral">—</span>
                            )}
                          </td>
                          <td>
                            {row.kind === 'combined'
                              ? row.totalFee
                                ? formatAmount(row.totalFee)
                                : ''
                              : row.fee
                              ? formatAmount(row.fee)
                              : ''}
                          </td>
                        </tr>
                        <tr className="history-detail-row" aria-hidden={!isExpanded}>
                          <td colSpan={9}>
                            <div
                              className={clsx('asset-details', {
                                'asset-details--visible': isExpanded,
                              })}
                              aria-hidden={!isExpanded}
                            >
                              {isExpanded && renderDetailContent(row)}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
