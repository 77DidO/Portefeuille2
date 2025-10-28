'use client';

import { useState } from 'react';
import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

import { PortfolioSection } from './PortfolioSection';

interface DashboardCardsProps {
  portfolios: PortfolioSummary[];
  onSelect: (portfolioId: number) => void;
  selectedPortfolioId?: number | null;
  selectedPortfolio?: PortfolioSummary | null;
  refreshTrigger?: number | null;
  onRefresh?: (portfolioId?: number) => void | Promise<void>;
  isRefreshing?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

const computeGlobalMetrics = (portfolios: PortfolioSummary[]) => {
  const totalValue = portfolios.reduce((acc, p) => acc + p.totalValue, 0);
  const investedValue = portfolios.reduce((acc, p) => acc + p.investedValue, 0);
  const gainLoss = portfolios.reduce((acc, p) => acc + p.gainLossValue, 0);
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

const defaultCategoryColors: Record<PortfolioSummary['category'], string> = {
  GLOBAL: '#4ade80',
  CRYPTO: '#fbbf24',
  PEA: '#60a5fa',
  OTHER: '#a78bfa',
};

const getPortfolioColor = (portfolio: PortfolioSummary): string => {
  return portfolio.color || defaultCategoryColors[portfolio.category] || '#a78bfa';
};

const chartPalette = ['#60a5fa', '#4ade80', '#fbbf24', '#a78bfa', '#f87171', '#34d399', '#22d3ee', '#f472b6'];

export const DashboardCards = ({
  portfolios,
  onSelect,
  selectedPortfolioId,
  selectedPortfolio,
  refreshTrigger,
  onRefresh,
  isRefreshing = false,
}: DashboardCardsProps) => {
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
  const portfolioForDetail =
    selectedPortfolio ??
    (selectedPortfolioId ? visiblePortfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null : null);

  const overviewMetrics = [
    {
      key: 'total',
      label: 'Valorisation totale',
      value: formatCurrency(totalValue),
      accent: 'rgba(59, 130, 246, 0.18)',
      valueClass: undefined,
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4 12.5 8.5 8l3 3 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M4 16h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: 'invested',
      label: 'Capital investi',
      value: formatCurrency(investedValue),
      accent: 'rgba(45, 212, 191, 0.2)',
      valueClass: undefined,
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M5.5 8.5 10 4l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: 'gain',
      label: 'Plus ou moins-value',
      value: `${gainLoss >= 0 ? '+' : ''}${formatCurrency(gainLoss)} (${gainLossPercentage.toFixed(2)}%)`,
      accent: gainLoss >= 0 ? 'rgba(34, 197, 94, 0.18)' : 'rgba(248, 113, 113, 0.18)',
      valueClass: gainLoss >= 0 ? 'delta positive' : 'delta negative',
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4 14 8.5 9.5l3 3L16 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: 'cash',
      label: 'Tresorerie',
      value: formatCurrency(cashTotal),
      accent: 'rgba(250, 204, 21, 0.2)',
      valueClass: undefined,
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 7.5v5M8.25 9.5h3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <section className="dashboard-grid" style={{ marginBottom: '2rem', gap: '1.5rem' }}>
      <div
        className="card"
        style={{
          gridColumn: 'span 12',
          padding: '0.95rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
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
            <h2 style={{ margin: 0 }}>Vue d'ensemble</h2>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
              {visiblePortfolios.length} portefeuille{visiblePortfolios.length > 1 ? 's' : ''}
            </span>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            {onRefresh && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRefresh();
                }}
                disabled={isRefreshing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  border: '1px solid rgba(96, 165, 250, 0.45)',
                  background: 'rgba(37, 99, 235, 0.18)',
                  color: '#e0f2fe',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  opacity: isRefreshing ? 0.6 : 1,
                  transition: 'background 0.2s ease, border 0.2s ease, opacity 0.2s ease',
                }}
                title="Actualiser les valorisations"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: 'block' }}
                >
                  <path
                    d="M3 10a7 7 0 0 1 11.9-5l.6.6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m15.5 3.5.5 2.8-2.8-.4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 10a7 7 0 0 1-11.9 5l-.6-.6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m4.5 16.5-.5-2.8 2.8.4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{isRefreshing ? 'Actualisation...' : 'Actualiser'}</span>
              </button>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                color: '#cbd5f5',
                fontSize: '0.8rem',
              }}
            >
              {chartsExpanded ? 'Masquer analyse' : 'Afficher analyse'}
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  transition: 'transform 0.2s ease',
                  transform: chartsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                v
              </span>
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '0.85rem',
          }}
        >
          {overviewMetrics.map((metric) => {
            const valueStyle = {
              fontSize: '1.05rem',
              fontWeight: 600,
              marginTop: '0.2rem',
              color: metric.valueClass ? undefined : '#f8fafc',
            } as const;
            return (
              <div
                key={metric.key}
                style={{
                  padding: '0.7rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.62)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(226, 232, 240, 0.95)',
                    background: metric.accent,
                  }}
                >
                  {metric.icon}
                </span>
                <div>
                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {metric.label}
                  </div>
                  <div className={metric.valueClass ?? undefined} style={valueStyle}>
                    {metric.value}
                  </div>
                </div>
              </div>
            );
          })}
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
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Repartition par portefeuille</h3>
            {visiblePortfolios.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Aucun portefeuille a visualiser pour le moment.
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
                          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{formatCurrency(portfolio.totalValue)}</div>
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
                                  <Cell
                                    key={`${portfolio.id}-${entry.id}`}
                                    fill={chartPalette[index % chartPalette.length]}
                                  />
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
                            Aucun actif valorise.
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
                          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{formatCurrency(portfolio.investedValue)}</div>
                        </div>
                        <div>
                          <div>Tresorerie</div>
                          <div style={{ color: '#cbd5f5', fontWeight: 500 }}>{formatCurrency(portfolio.cashValue ?? 0)}</div>
                        </div>
                        <div>
                          <div>Actifs suivis</div>
                          <div style={{ color: '#cbd5f5', fontWeight: 500 }}>{trackedAssetCount}</div>
                        </div>
                        <div>
                          <div>Performance</div>
                          <div
                            className={clsx('delta', portfolio.gainLossValue >= 0 ? 'positive' : 'negative')}
                            style={{ fontWeight: 600 }}
                          >
                            {portfolio.gainLossValue >= 0 ? '+' : ''}
                            {formatCurrency(portfolio.gainLossValue)}
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

      <div
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: '360px minmax(0, 1fr)',
          alignItems: 'stretch',
          width: '100%',
          minHeight: 0,
          gridColumn: 'span 12',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            alignItems: 'stretch',
            width: '100%',
          }}
        >
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
              <div
                key={portfolio.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => onSelect(portfolio.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(portfolio.id);
                  }
                }}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: '1rem',
                  background: isSelected ? 'rgba(12, 20, 36, 0.88)' : 'rgba(15, 23, 42, 0.72)',
                  border: isSelected ? '1px solid rgba(96, 165, 250, 0.55)' : '1px solid rgba(148, 163, 184, 0.12)',
                  boxShadow: isSelected
                    ? '0 18px 32px rgba(37, 99, 235, 0.25)'
                    : '0 12px 28px rgba(2, 6, 23, 0.5)',
                  outline: 'none',
                  overflow: 'hidden',
                  transition: 'border 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    padding: '0.95rem 1.2rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    background: `linear-gradient(120deg, ${getPortfolioColor(portfolio)}30, rgba(15, 23, 42, 0.96))`,
                    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#f8fafc',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {portfolio.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.6rem',
                        color: '#cbd5f5',
                        opacity: 0.7,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        marginTop: '0.35rem',
                      }}
                    >
                      {trackedAssetCount} actif{trackedAssetCount > 1 ? 's' : ''} suivis
                    </div>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      backgroundColor: `${getPortfolioColor(portfolio)}1A`,
                      color: '#f8fafc',
                      border: `1px solid ${getPortfolioColor(portfolio)}33`,
                      boxShadow: `inset 0 0 0 1px ${getPortfolioColor(portfolio)}24`,
                    }}
                  >
                    <span
                      style={{
                        width: '0.6rem',
                        height: '0.6rem',
                        borderRadius: '999px',
                        backgroundColor: getPortfolioColor(portfolio),
                        boxShadow: '0 0 8px rgba(15, 23, 42, 0.8)',
                      }}
                    />
                    {categoryLabel[portfolio.category]}
                  </span>
                </div>
                <div
                  style={{
                    padding: '0.75rem 0.95rem 0.9rem',
                    display: 'grid',
                    gap: '0.85rem 1rem',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    alignItems: 'start',
                    flex: '1 1 auto',
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Valeur totale
                    </div>
                    <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.1rem', marginTop: '0.35rem' }}>
                      {formatCurrency(portfolio.totalValue)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Investi
                    </div>
                    <div style={{ color: '#cbd5f5', fontWeight: 600, fontSize: '1rem', marginTop: '0.35rem' }}>
                      {formatCurrency(portfolio.investedValue)}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div>
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: '0.65rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        Tresorerie
                      </div>
                      <div style={{ color: '#cbd5f5', fontWeight: 600, fontSize: '1rem', marginTop: '0.35rem' }}>
                        {formatCurrency(portfolio.cashValue ?? 0)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: '0.6rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          P/L
                        </div>
                        <div className={clsx('delta', gainClass)} style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.25rem' }}>
                          {portfolio.gainLossValue >= 0 ? '+' : ''}
                          {formatCurrency(portfolio.gainLossValue)}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: '0.6rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          P/L %
                        </div>
                        <div className={clsx('delta', gainClass)} style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.25rem' }}>
                          {gainPercentage >= 0 ? '+' : ''}
                          {gainPercentage.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {portfolioForDetail && (
          <div
            style={{
              flex: '1 1 auto',
              width: '100%',
              minWidth: 0,
              borderRadius: '1rem',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              background: 'rgba(15, 23, 42, 0.55)',
              padding: '0.95rem',
              boxShadow: '0 18px 35px rgba(2, 6, 23, 0.4)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <PortfolioSection portfolio={portfolioForDetail} refreshTrigger={refreshTrigger} />
          </div>
        )}
      </div>
    </section>
  );
};








