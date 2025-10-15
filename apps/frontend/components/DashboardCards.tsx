'use client';

import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';

interface DashboardCardsProps {
  portfolios: PortfolioSummary[];
  onSelect: (portfolioId: number) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

const computeGlobalMetrics = (portfolios: PortfolioSummary[]) => {
  const totalValue = portfolios.reduce((acc, p) => acc + p.totalValue, 0);
  const investedValue = portfolios.reduce((acc, p) => acc + p.investedValue, 0);
  const gainLoss = totalValue - investedValue;
  const gainLossPercentage = investedValue !== 0 ? (gainLoss / investedValue) * 100 : 0;
  return { totalValue, investedValue, gainLoss, gainLossPercentage };
};

type AggregatedMetrics = {
  totalValue: number;
  investedValue: number;
  gainLoss: number;
};

const computeCategoryTotals = (portfolios: PortfolioSummary[]) => {
  return portfolios.reduce<Record<PortfolioSummary['category'], AggregatedMetrics>>((acc, portfolio) => {
    const aggregate = acc[portfolio.category] ?? {
      totalValue: 0,
      investedValue: 0,
      gainLoss: 0,
    };
    aggregate.totalValue += portfolio.totalValue;
    aggregate.investedValue += portfolio.investedValue;
    aggregate.gainLoss += portfolio.gainLossValue;
    acc[portfolio.category] = aggregate;
    return acc;
  }, {} as Record<PortfolioSummary['category'], AggregatedMetrics>);
};

export const DashboardCards = ({ portfolios, onSelect }: DashboardCardsProps) => {
  const { totalValue, gainLoss, gainLossPercentage } = computeGlobalMetrics(portfolios);
  const categoryTotals = computeCategoryTotals(portfolios);

  const firstCrypto = portfolios.find((p) => p.category === 'CRYPTO');
  const firstPea = portfolios.find((p) => p.category === 'PEA');
  const firstOther = portfolios.find((p) => p.category === 'OTHER');

  const aggregatedCards = (
    [
      { category: 'CRYPTO' as const, label: 'Portefeuille Crypto', highlight: firstCrypto },
      { category: 'PEA' as const, label: 'Portefeuille PEA', highlight: firstPea },
      { category: 'OTHER' as const, label: 'Autres Portefeuilles', highlight: firstOther },
    ] satisfies Array<{ category: PortfolioSummary['category']; label: string; highlight?: PortfolioSummary }>
  )
    .map(({ category, label, highlight }) => {
      const totals = categoryTotals[category];
      if (!totals || totals.totalValue === 0) {
        return null;
      }
      const percentage = totals.investedValue !== 0 ? (totals.gainLoss / totals.investedValue) * 100 : 0;
      return { category, label, totals, percentage, highlight };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  return (
    <section className="dashboard-grid" style={{ marginBottom: '2rem' }}>
      <div className="card" style={{ gridColumn: 'span 12' }}>
        <h2>Valeur totale</h2>
        <div className="value">{formatCurrency(totalValue)}</div>
        <div className={clsx('delta', gainLoss >= 0 ? 'positive' : 'negative')}>
          {gainLoss >= 0 ? '+' : ''}
          {formatCurrency(gainLoss)} ({gainLossPercentage.toFixed(2)}%)
        </div>
      </div>
      {aggregatedCards.length > 0 && (
        <div
          style={{
            gridColumn: 'span 12',
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          {aggregatedCards.map(({ category, label, totals, percentage, highlight }) => (
            <div
              key={category}
              className="card"
              onClick={() => (highlight ? onSelect(highlight.id) : undefined)}
              role={highlight ? 'button' : undefined}
              style={{ cursor: highlight ? 'pointer' : 'default' }}
            >
              <h2>{label}</h2>
              <div className="value">{formatCurrency(totals.totalValue)}</div>
              <div className={clsx('delta', totals.gainLoss >= 0 ? 'positive' : 'negative')}>
                {totals.gainLoss >= 0 ? '+' : ''}
                {formatCurrency(totals.gainLoss)} ({percentage.toFixed(2)}%)
              </div>
              {highlight && (
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {highlight.assets.length} actif{highlight.assets.length > 1 ? 's' : ''} suivi
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};











