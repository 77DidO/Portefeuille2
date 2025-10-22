'use client';

import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';

interface DashboardCardsProps {
  portfolios: PortfolioSummary[];
  onSelect: (portfolioId: number) => void;
  selectedPortfolioId?: number | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

const computeGlobalMetrics = (portfolios: PortfolioSummary[]) => {
  const totalValue = portfolios.reduce((acc, p) => acc + p.totalValue, 0);
  const investedValue = portfolios.reduce((acc, p) => acc + p.investedValue, 0);
  const gainLoss = totalValue - investedValue;
  const gainLossPercentage = investedValue !== 0 ? (gainLoss / investedValue) * 100 : 0;
  const cashTotal = portfolios
    .flatMap((portfolio) => portfolio.assets)
    .filter((asset) => {
      const symbol = asset.symbol?.toUpperCase?.() ?? '';
      return symbol === 'PEA_CASH' || symbol === '_PEA_CASH' || symbol === 'CASH';
    })
    .reduce((acc, asset) => acc + asset.marketValue, 0);
  return { totalValue, investedValue, gainLoss, gainLossPercentage, cashTotal };
};

const categoryLabel: Record<PortfolioSummary['category'], string> = {
  GLOBAL: 'Global',
  CRYPTO: 'Crypto',
  PEA: 'PEA',
  OTHER: 'Autre',
};

export const DashboardCards = ({ portfolios, onSelect, selectedPortfolioId }: DashboardCardsProps) => {
  const visiblePortfolios = portfolios.filter((portfolio) => portfolio.category !== 'GLOBAL' && portfolio.assets.length > 0);
  const {
    totalValue,
    investedValue,
    gainLoss,
    gainLossPercentage,
    cashTotal: cashFromAssets,
  } = computeGlobalMetrics(visiblePortfolios);
  const cashFromSummary = visiblePortfolios.reduce(
    (acc, portfolio) => acc + (portfolio.cashValue ?? 0),
    0,
  );
  const cashTotal = cashFromSummary > 0 ? cashFromSummary : cashFromAssets;

  return (
    <section className="dashboard-grid" style={{ marginBottom: '2rem', gap: '1.5rem' }}>
      <div className="card" style={{ gridColumn: 'span 12' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Vue d'ensemble</h2>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {visiblePortfolios.length} portefeuille{visiblePortfolios.length > 1 ? 's' : ''}
          </span>
        </header>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Valorisation totale</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 600, marginTop: '0.25rem' }}>{formatCurrency(totalValue)}</div>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Capital investi</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '0.25rem' }}>
              {formatCurrency(investedValue)}
            </div>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Plus/moins-value</div>
            <div
              className={clsx('delta', gainLoss >= 0 ? 'positive' : 'negative')}
              style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '0.25rem' }}
            >
              {gainLoss >= 0 ? '+' : ''}
              {formatCurrency(gainLoss)} ({gainLossPercentage.toFixed(2)}%)
            </div>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Trésorerie</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '0.25rem' }}>{formatCurrency(cashTotal)}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ gridColumn: 'span 12', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>Vos portefeuilles</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Cliquez sur un portefeuille pour voir le détail</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Nom</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Catégorie</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Valeur</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Investi</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Trésorerie</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>P/L</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>P/L %</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Actifs</th>
              </tr>
            </thead>
            <tbody>
              {visiblePortfolios.map((portfolio) => {
                const gainClass = portfolio.gainLossValue === 0 ? '' : portfolio.gainLossValue > 0 ? 'positive' : 'negative';
                const gainPercentage =
                  portfolio.investedValue !== 0 ? (portfolio.gainLossValue / portfolio.investedValue) * 100 : 0;
                const isSelected = selectedPortfolioId === portfolio.id;
                const trackedAssetCount = portfolio.assets.filter((asset) => {
                  const symbol = asset.symbol?.toUpperCase?.() ?? '';
                  return symbol !== 'PEA_CASH' && symbol !== '_PEA_CASH' && symbol !== 'CASH';
                }).length;
                return (
                  <tr
                    key={portfolio.id}
                    onClick={() => onSelect(portfolio.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                    }}
                  >
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#e2e8f0' }}>{portfolio.name}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#94a3b8' }}>
                      {categoryLabel[portfolio.category]}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#e2e8f0' }}>
                      {formatCurrency(portfolio.totalValue)}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#94a3b8' }}>
                      {formatCurrency(portfolio.investedValue)}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#94a3b8' }}>
                      {formatCurrency(portfolio.cashValue ?? 0)}
                    </td>
                    <td
                      style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}
                      className={clsx('delta', gainClass)}
                    >
                      {portfolio.gainLossValue >= 0 ? '+' : ''}
                      {formatCurrency(portfolio.gainLossValue)}
                    </td>
                    <td
                      style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}
                      className={clsx('delta', gainClass)}
                    >
                      {gainPercentage >= 0 ? '+' : ''}
                      {gainPercentage.toFixed(2)}%
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#94a3b8' }}>
                      {trackedAssetCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};











