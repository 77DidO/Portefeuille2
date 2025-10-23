'use client';

import { useState } from 'react';
import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

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

const chartPalette = ['#38bdf8', '#34d399', '#facc15', '#f472b6', '#a855f7', '#f97316', '#22d3ee', '#f87171'];

export const DashboardCards = ({ portfolios, onSelect, selectedPortfolioId }: DashboardCardsProps) => {
  const visiblePortfolios = portfolios.filter(
    (portfolio) => portfolio.category !== 'GLOBAL' && portfolio.assets.length > 0,
  );
  const { totalValue, investedValue, gainLoss, gainLossPercentage, cashTotal: cashFromAssets } =
    computeGlobalMetrics(visiblePortfolios);
  const cashFromSummary = visiblePortfolios.reduce(
    (acc, portfolio) => acc + (portfolio.cashValue ?? 0),
    0,
  );
  const cashTotal = cashFromSummary > 0 ? cashFromSummary : cashFromAssets;
  const [chartsExpanded, setChartsExpanded] = useState(false);

  return (
    <section className="dashboard-grid" style={{ marginBottom: '2rem', gap: '1.5rem' }}>
      <div
        className="card"
        style={{
          gridColumn: 'span 12',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setChartsExpanded((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setChartsExpanded((prev) => !prev);
            }
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Vue d&apos;ensemble</h2>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              {visiblePortfolios.length} portefeuille{visiblePortfolios.length > 1 ? 's' : ''}
            </span>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: '#cbd5f5',
              fontSize: '0.85rem',
            }}
          >
            {chartsExpanded ? 'Masquer l’analyse' : 'Afficher l’analyse'}
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s ease',
                transform: chartsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </span>
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Valorisation totale</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 600, marginTop: '0.25rem' }}>{formatCurrency(totalValue)}</div>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Capital investi</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '0.25rem' }}>
              {formatCurrency(investedValue)}
            </div>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Plus/moins-value</div>
            <div
              className={clsx('delta', gainLoss >= 0 ? 'positive' : 'negative')}
              style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '0.25rem' }}
            >
              {gainLoss >= 0 ? '+' : ''}
              {formatCurrency(gainLoss)} ({gainLossPercentage.toFixed(2)}%)
            </div>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Trésorerie</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '0.25rem' }}>{formatCurrency(cashTotal)}</div>
          </div>
        </div>

        {chartsExpanded && (
          <div
            style={{
              marginTop: '1.15rem',
              paddingTop: '1.15rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.7rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Répartition par portefeuille</h3>
            {visiblePortfolios.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Aucun portefeuille à visualiser pour le moment.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: '0.85rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                }}
              >
                {visiblePortfolios.map((portfolio) => {
                  const assetsForChart = portfolio.assets.map((asset) => ({
                    id: asset.id,
                    name: asset.name,
                    value: Math.max(asset.marketValue, 0),
                }));
                const sortedAssets = [...assetsForChart].sort((a, b) => b.value - a.value);
                const hasValues = sortedAssets.some((asset) => asset.value > 0);
                const total = sortedAssets.reduce((acc, item) => acc + item.value, 0);
                const topAssets = sortedAssets.slice(0, 4);
                const othersValue = total - topAssets.reduce((acc, item) => acc + item.value, 0);
                const chartData =
                  othersValue > 0
                    ? topAssets.concat([{ id: -1, name: 'Autres', value: othersValue }])
                    : topAssets;
                const trackedAssetCount = portfolio.assets.filter((asset) => {
                  const symbol = asset.symbol?.toUpperCase?.() ?? '';
                  return symbol !== 'PEA_CASH' && symbol !== '_PEA_CASH' && symbol !== 'CASH';
                }).length;

                return (
                  <div
                    key={portfolio.id}
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.12)',
                      borderRadius: '14px',
                      padding: '0.9rem 1rem 1.1rem',
                      background: 'rgba(15, 23, 42, 0.45)',
                      display: 'grid',
                      gap: '0.7rem',
                      gridTemplateRows: 'auto auto 1fr',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e2e8f0' }}>{portfolio.name}</div>
                      <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8' }}>
                        <div>Valorisation</div>
                        <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                          {formatCurrency(portfolio.totalValue)}
                        </div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: 150 }}>
                      {hasValues ? (
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius="50%"
                              outerRadius="74%"
                              paddingAngle={1.2}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`${portfolio.id}-${entry.id}`} fill={chartPalette[index % chartPalette.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, _name: string, payload) => [
                                formatCurrency(value as number),
                                payload?.payload?.name ?? '',
                              ]}
                              contentStyle={{
                                background: 'rgba(15, 23, 42, 0.92)',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                borderRadius: 8,
                                color: '#e2e8f0',
                                fontSize: '0.8rem',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            padding: '1rem 0',
                          }}
                        >
                          Aucun actif valorisé.
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: '0.55rem 0.7rem',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                      }}
                    >
                      <div>
                        <div>Capital investi</div>
                        <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                          {formatCurrency(portfolio.investedValue)}
                        </div>
                      </div>
                      <div>
                        <div>Trésorerie</div>
                        <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                          {formatCurrency(portfolio.cashValue ?? 0)}
                        </div>
                      </div>
                      <div>
                        <div>Plus/moins-value</div>
                        <div
                          className={clsx(
                            'delta',
                            portfolio.gainLossValue === 0
                              ? ''
                              : portfolio.gainLossValue > 0
                              ? 'positive'
                              : 'negative',
                          )}
                          style={{ fontWeight: 600 }}
                        >
                          {portfolio.gainLossValue >= 0 ? '+' : ''}
                          {formatCurrency(portfolio.gainLossValue)}
                        </div>
                      </div>
                      <div>
                        <div>Actifs suivis</div>
                        <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{trackedAssetCount}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2', marginTop: '0.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {topAssets.map((asset, index) => {
                            const weight = total !== 0 ? (asset.value / total) * 100 : 0;
                            return (
                              <div
                                key={asset.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.6rem',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    color: '#e2e8f0',
                                  }}
                                >
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: 10,
                                      height: 10,
                                      borderRadius: '50%',
                                      background: chartPalette[index % chartPalette.length],
                                    }}
                                  />
                                  <span
                                    style={{
                                      maxWidth: '10rem',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {asset.name}
                                  </span>
                                </span>
                                <span style={{ color: '#94a3b8' }}>{weight.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                          {othersValue > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.6rem',
                                color: '#94a3b8',
                              }}
                            >
                              <span>Autres</span>
                              <span>{((othersValue / total) * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ gridColumn: 'span 12', padding: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ margin: 0 }}>Vos portefeuilles</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Cliquez sur un portefeuille pour voir le détail
          </span>
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
                const gainClass =
                  portfolio.gainLossValue === 0 ? '' : portfolio.gainLossValue > 0 ? 'positive' : 'negative';
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
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                      {portfolio.name}
                    </td>
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
