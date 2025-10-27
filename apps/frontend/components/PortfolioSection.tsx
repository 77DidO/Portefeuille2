'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PortfolioSummary } from '@portefeuille/types';
import clsx from 'clsx';
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, Tooltip, Line, Legend } from 'recharts';
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
  const [dateRange, setDateRange] = useState<'1M' | '3M' | '6M' | 'ALL'>('3M');
  const rangeLookup: Record<typeof dateRange, number | null> = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    ALL: null,
  };
  const detailQuery = useQuery({
    queryKey: ['portfolio-detail', portfolio.id],
    queryFn: () => api.getPortfolio(portfolio.id),
    staleTime: 60_000,
  });
  const chartData = useMemo(() => {
    const detail = detailQuery.data;
    if (!detail || !detail.priceHistory || detail.priceHistory.length === 0) {
      return [];
    }
    const investedSeries = (detail.investedHistory ?? []).map((point) => ({
      ts: new Date(point.date).getTime(),
      value: typeof point.value === 'number' ? point.value : Number(point.value ?? 0),
    }));
    const cashSeries = (detail.cashHistory ?? []).map((point) => ({
      ts: new Date(point.date).getTime(),
      value: typeof point.value === 'number' ? point.value : Number(point.value ?? 0),
    }));
    let investedIdx = 0;
    let cashIdx = 0;
    let lastInvested = investedSeries[0]?.value ?? 0;
    let lastCash = cashSeries[0]?.value ?? 0;

    const lastTimestamp = new Date(detail.priceHistory[detail.priceHistory.length - 1].date).getTime();
    const rangeDays = rangeLookup[dateRange];
    const cutoffTimestamp =
      rangeDays === null ? Number.NEGATIVE_INFINITY : lastTimestamp - rangeDays * 24 * 60 * 60 * 1000;

    return detail.priceHistory
      .map((point) => {
        const timestamp = new Date(point.date).getTime();
        while (investedIdx < investedSeries.length && investedSeries[investedIdx].ts <= timestamp) {
          lastInvested = investedSeries[investedIdx].value;
          investedIdx += 1;
        }
      while (cashIdx < cashSeries.length && cashSeries[cashIdx].ts <= timestamp) {
        lastCash = cashSeries[cashIdx].value;
        cashIdx += 1;
      }
        let pointValue = typeof point.value === 'number' ? point.value : Number(point.value ?? 0);
        let investedValue = lastInvested;
        let cashValue = lastCash;
        const assetsValue = pointValue - cashValue;
        if (investedValue > 0 && assetsValue <= 0) {
          pointValue = investedValue + cashValue;
        }
        return {
          date: timestamp,
          value: pointValue,
          invested: investedValue,
          cash: cashValue,
        };
      })
      .filter((point) => point.date >= cutoffTimestamp);
  }, [dateRange, detailQuery.data]);
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
    const valueEntry = payload.find((entry) => entry.dataKey === 'value');
    const investedEntry = payload.find((entry) => entry.dataKey === 'invested');
    const cashEntry = payload.find((entry) => entry.dataKey === 'cash');
    const pointValueRaw = valueEntry?.value;
    const pointValue =
      typeof pointValueRaw === 'number' ? pointValueRaw : Number(pointValueRaw ?? 0);
    const investedRaw = investedEntry?.value;
    const investedValue =
      typeof investedRaw === 'number'
        ? investedRaw
        : Number(
            investedRaw ??
              (valueEntry && typeof valueEntry.payload === 'object'
                ? (valueEntry.payload as any)?.invested
                : portfolio.investedValue ?? 0),
          );
    const cashRaw = cashEntry?.value;
    const cashForTooltip =
      typeof cashRaw === 'number'
        ? cashRaw
        : Number(
            cashRaw ??
              (valueEntry && typeof valueEntry.payload === 'object'
                ? (valueEntry.payload as any)?.cash
                : cashValue ?? 0),
          );
    let assetValue = pointValue - cashForTooltip;
    if (investedValue > 0 && assetValue <= 0) {
      assetValue = investedValue;
    }
    const labelValue =
      typeof label === 'number' ? dateFormatter.format(new Date(label)) : String(label ?? '');
    const delta = assetValue - investedValue;
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
        <div style={{ marginBottom: '0.2rem' }}>Valeur totale : {format(pointValue)}</div>
        <div style={{ marginBottom: '0.2rem' }}>Solde de tresorerie : {format(cashForTooltip)}</div>
        <div style={{ marginBottom: '0.2rem' }}>Valeur hors tresorerie : {format(assetValue)}</div>
        <div style={{ marginBottom: '0.2rem' }}>Capital investi : {format(investedValue)}</div>
        <div style={{ color: deltaColor }}>
          Plus/moins-value : {delta >= 0 ? '+' : ''}
          {format(delta)}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
      }}
    >
      {detailQuery.isLoading && (
        <div
          style={{
            padding: '0.9rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.45)',
            color: '#94a3b8',
            fontSize: '0.9rem',
          }}
        >
          Chargement de l'historique...
        </div>
      )}
      {!detailQuery.isLoading && chartData.length > 0 && (
        <div
          style={{
            flex: '1 1 auto',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.45)',
            padding: '0.75rem',
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#e2e8f0' }}>
            Evolution de la valorisation
          </h4>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            {(['1M', '3M', '6M', 'ALL'] as const).map((rangeKey) => (
              <button
                key={rangeKey}
                type="button"
                onClick={() => setDateRange(rangeKey)}
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  background:
                    dateRange === rangeKey ? 'rgba(59, 130, 246, 0.35)' : 'rgba(30, 41, 59, 0.65)',
                  color: dateRange === rangeKey ? '#e0f2fe' : '#cbd5f5',
                  transition: 'background 0.2s ease, color 0.2s ease',
                }}
              >
                {rangeKey === 'ALL' ? 'Tout' : rangeKey}
              </button>
            ))}
          </div>
          <div style={{ width: '100%', height: '100%', minHeight: 220, flex: '1 1 auto' }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`portfolioTrend-${portfolio.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.08} />
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
                <Legend
                  wrapperStyle={{ color: '#e2e8f0', fontSize: '0.8rem' }}
                  formatter={(_, entry) =>
                    entry?.dataKey === 'invested' ? 'Capital investi' : 'Valeur totale'
                  }
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Valeur totale"
                  stroke="#60a5fa"
                  fill={`url(#portfolioTrend-${portfolio.id})`}
                  strokeWidth={1.8}
                />
                <Line
                  type="monotone"
                  dataKey="invested"
                  name="Capital investi"
                  stroke="#f8fafc"
                  strokeWidth={1.1}
                  dot={false}
                  strokeDasharray="5 5"
                  strokeOpacity={0.9}
                  connectNulls
                  activeDot={{ r: 4.5, stroke: '#f8fafc', fill: '#0f172a', strokeWidth: 1.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <AssetAccordion assets={displayedAssets} refreshTrigger={refreshTrigger} />
    </div>
  );
};




