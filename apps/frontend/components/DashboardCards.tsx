'use client';

import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';

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

const sampleTrend = (portfolio: PortfolioSummary) => {
  const assetWithTrend = portfolio.assets.find((asset) => asset.trend && asset.trend.length > 0);
  return (
    assetWithTrend?.trend?.slice(-12).map((point) => ({
      date: point.date,
      value: point.value,
    })) ?? []
  );
};

export const DashboardCards = ({ portfolios, onSelect }: DashboardCardsProps) => {
  const { totalValue, gainLoss, gainLossPercentage } = computeGlobalMetrics(portfolios);

  const highlight = (category: PortfolioSummary['category']) =>
    portfolios.find((p) => p.category === category);

  const renderCard = (portfolio: PortfolioSummary | undefined, label: string) => {
    if (!portfolio) return null;
    const trend = sampleTrend(portfolio);
    return (
      <div className="card" key={portfolio.id} onClick={() => onSelect(portfolio.id)} role="button">
        <h2>{label}</h2>
        <div className="value">{formatCurrency(portfolio.totalValue)}</div>
        <div className={clsx('delta', portfolio.gainLossValue >= 0 ? 'positive' : 'negative')}>
          {portfolio.gainLossValue >= 0 ? '+' : ''}
          {formatCurrency(portfolio.gainLossValue)} ({portfolio.gainLossPercentage.toFixed(2)}%)
        </div>
        {trend.length > 1 && (
          <div style={{ height: 80, marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={`gradient-${portfolio.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#38bdf8"
                  fillOpacity={1}
                  fill={`url(#gradient-${portfolio.id})`}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

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
      <div className="card" style={{ gridColumn: 'span 12', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {renderCard(highlight('CRYPTO'), 'Portefeuille Crypto')}
          {renderCard(highlight('PEA'), 'Portefeuille PEA')}
          {renderCard(highlight('OTHER'), 'Autres Portefeuilles')}
        </div>
      </div>
    </section>
  );
};
