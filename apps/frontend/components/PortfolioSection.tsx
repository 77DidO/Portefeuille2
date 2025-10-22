'use client';

import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';
import { AssetAccordion } from './AssetAccordion';

interface PortfolioSectionProps {
  portfolio: PortfolioSummary;
  refreshTrigger?: number | null;
}

export const PortfolioSection = ({ portfolio, refreshTrigger }: PortfolioSectionProps) => {
  const format = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  const gainClass = portfolio.gainLossValue === 0 ? '' : portfolio.gainLossValue > 0 ? 'positive' : 'negative';
  const gainPercentage =
    portfolio.investedValue !== 0 ? (portfolio.gainLossValue / portfolio.investedValue) * 100 : 0;
  const cashAsset = portfolio.assets.find((asset) => {
    const symbol = asset.symbol?.toUpperCase?.() ?? '';
    return symbol === 'PEA_CASH' || symbol === '_PEA_CASH' || symbol === 'CASH';
  });
  const cashValue =
    portfolio.cashValue !== undefined
      ? portfolio.cashValue
      : cashAsset
      ? cashAsset.marketValue
      : 0;
  const cashUpdatedAt = cashAsset?.lastPriceUpdateAt ?? null;
  const displayedAssets = portfolio.assets.filter((asset) => asset !== cashAsset);
  const trackedAssetsCount = displayedAssets.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{portfolio.name}</h3>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Catégorie : {portfolio.category}</div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Valeur</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{format(portfolio.totalValue)}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Investi</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{format(portfolio.investedValue)}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Plus/moins-value</div>
            <div className={clsx('delta', gainClass)} style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {portfolio.gainLossValue >= 0 ? '+' : ''}
              {format(portfolio.gainLossValue)} ({gainPercentage >= 0 ? '+' : ''}
              {gainPercentage.toFixed(2)}%)
            </div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Actifs suivis</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{trackedAssetsCount}</div>
          </div>
        </div>
      </div>
      {(cashAsset || cashValue > 0) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.1rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.65)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Trésorerie disponible</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#e2e8f0' }}>{format(cashValue)}</div>
          </div>
          <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.75rem' }}>
            {cashUpdatedAt && (
              <>
                Mise à jour&nbsp;:{' '}
                <span style={{ color: '#cbd5f5' }}>{new Date(cashUpdatedAt).toLocaleString('fr-FR')}</span>
              </>
            )}
          </div>
        </div>
      )}
      <AssetAccordion assets={displayedAssets} refreshTrigger={refreshTrigger} />
    </div>
  );
};
