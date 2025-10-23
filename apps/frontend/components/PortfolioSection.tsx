'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';
import { api } from '@/lib/api';
import { AssetAccordion } from './AssetAccordion';

interface PortfolioSectionProps {
  portfolio: PortfolioSummary;
  refreshTrigger?: number | null;
}

export const PortfolioSection = ({ portfolio, refreshTrigger }: PortfolioSectionProps) => {
  const format = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }),
    [],
  );
  const gainClass = portfolio.gainLossValue === 0 ? '' : portfolio.gainLossValue > 0 ? 'positive' : 'negative';
  const gainPercentage =
    portfolio.investedValue !== 0 ? (portfolio.gainLossValue / portfolio.investedValue) * 100 : 0;
  const detailQuery = useQuery({
    queryKey: ['portfolio-detail', portfolio.id],
    queryFn: () => api.getPortfolio(portfolio.id),
    staleTime: 60_000,
  });
  const priceHistory = useMemo(() => {
    if (!detailQuery.data?.priceHistory || detailQuery.data.priceHistory.length === 0) {
      return [];
    }
    return detailQuery.data.priceHistory.map((point) => ({
      date: new Date(point.date).getTime(),
      value: point.value,
    }));
  }, [detailQuery.data]);
  const cashSymbols = new Set(['PEA_CASH', '_PEA_CASH', 'CASH']);
  if (portfolio.category === 'CRYPTO') {
    cashSymbols.add('EUR');
    cashSymbols.add('USDT');
    cashSymbols.add('USDC');
  }
  const cashAsset = portfolio.assets.find((asset) => {
    const symbol = asset.symbol?.toUpperCase?.() ?? '';
    return cashSymbols.has(symbol);
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
  const renderPortfolioTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }
    const pointValueRaw = payload[0]?.value;
    const pointValue =
      typeof pointValueRaw === 'number' ? pointValueRaw : Number(pointValueRaw ?? 0);
    const labelValue =
      typeof label === 'number' ? dateFormatter.format(new Date(label)) : String(label ?? '');
    const delta = pointValue - portfolio.investedValue;
    const deltaColor = delta > 0 ? '#34d399' : delta < 0 ? '#f87171' : '#94a3b8';

    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(96, 165, 250, 0.35)',
          borderRadius: 8,
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          color: '#e2e8f0',
          minWidth: '7.5rem',
        }}
      >
        <div style={{ color: '#94a3b8', marginBottom: '0.3rem' }}>{labelValue}</div>
        <div style={{ marginBottom: '0.2rem' }}>Valeur : {format(pointValue)}</div>
        {portfolio.investedValue !== 0 && (
          <div style={{ color: deltaColor }}>
            Plus/moins-value : {delta >= 0 ? '+' : ''}
            {format(delta)}
          </div>
        )}
      </div>
    );
  };

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
      {detailQuery.isLoading && (
        <div
          style={{
            padding: '1.5rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.45)',
            color: '#94a3b8',
            fontSize: '0.9rem',
          }}
        >
          Chargement de l'historique...
        </div>
      )}
      {!detailQuery.isLoading && priceHistory.length > 0 && (
        <div
          style={{
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.45)',
            padding: '1rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#e2e8f0' }}>
            Evolution de la valorisation
          </h4>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={priceHistory} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`portfolioTrend-${portfolio.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  scale="time"
                  minTickGap={20}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="rgba(148, 163, 184, 0.2)"
                  tickFormatter={(value: number) => dateFormatter.format(new Date(value))}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="rgba(148, 163, 184, 0.2)"
                  width={60}
                  tickFormatter={(value) => format(value).replace(/,00$/, '')}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(96, 165, 250, 0.35)', strokeWidth: 1 }}
                  content={renderPortfolioTooltip}
                />
                {portfolio.investedValue > 0 && (
                  <ReferenceLine
                    y={portfolio.investedValue}
                    stroke="rgba(248, 113, 113, 0.65)"
                    strokeDasharray="4 4"
                    label={{
                      position: 'right',
                      value: `Investi ${format(portfolio.investedValue)}`,
                      fill: '#f8fafc',
                      fontSize: 10,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#60a5fa"
                  fill={`url(#portfolioTrend-${portfolio.id})`}
                  strokeWidth={1.8}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
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
