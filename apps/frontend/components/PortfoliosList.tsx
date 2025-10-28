'use client';

import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';

interface PortfoliosListProps {
  portfolios: PortfolioSummary[];
  selectedPortfolioId?: number | null;
  onSelect: (portfolioId: number) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

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

export const PortfoliosList = ({ portfolios, selectedPortfolioId, onSelect }: PortfoliosListProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {portfolios.map((portfolio) => {
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
            className="card"
            style={{
              cursor: 'pointer',
              background: isSelected ? 'rgba(12, 20, 36, 0.88)' : undefined,
              border: isSelected ? '1px solid rgba(96, 165, 250, 0.55)' : undefined,
              boxShadow: isSelected
                ? '0 18px 32px rgba(37, 99, 235, 0.25)'
                : '0 12px 28px rgba(2, 6, 23, 0.5)',
              padding: 0,
              overflow: 'hidden',
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
                    Trésorerie
                  </div>
                  <div style={{ color: '#cbd5f5', fontWeight: 600, fontSize: '1rem', marginTop: '0.35rem' }}>
                    {formatCurrency(portfolio.cashValue ?? 0)}
                  </div>
                </div>
                {portfolio.dividendsValue !== undefined && portfolio.dividendsValue > 0 && (
                  <div>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Dividendes
                    </div>
                    <div style={{ color: '#a78bfa', fontWeight: 600, fontSize: '1rem', marginTop: '0.35rem' }}>
                      {formatCurrency(portfolio.dividendsValue)}
                    </div>
                  </div>
                )}
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
  );
};
