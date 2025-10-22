'use client';

import { useState, useCallback, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssetSummary, AssetDetail } from '@portefeuille/types';
import { api } from '@/lib/api';
import clsx from 'clsx';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: value < 1 ? 6 : 2,
    minimumFractionDigits: 0,
  }).format(value);

const computeTrendMetrics = (trend: AssetSummary['trend']) => {
  if (!trend || trend.length < 2) {
    return null;
  }
  const ordered = [...trend].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const first = ordered[0].value;
  const last = ordered[ordered.length - 1].value;
  const change = last - first;
  const percent = first !== 0 ? (change / first) * 100 : 0;
  const status = Math.abs(percent) < 0.1 ? 'flat' : change > 0 ? 'up' : 'down';
  return { change, percent, status };
};

interface AssetAccordionProps {
  assets: AssetSummary[];
  refreshTrigger?: number | null;
}

type RefreshFeedback = {
  message: string;
  variant: 'success' | 'error' | 'info';
};

export const AssetAccordion = ({ assets, refreshTrigger }: AssetAccordionProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, AssetDetail>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<Record<number, string>>({});
  const [refreshing, setRefreshing] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<Record<number, RefreshFeedback>>({});
  const queryClient = useQueryClient();
  const refreshMutation = useMutation({
    mutationFn: (assetId: number) => api.refreshAsset(assetId),
  });

  const loadAssetDetail = useCallback(async (assetId: number) => {
    try {
      setLoading((prev) => ({ ...prev, [assetId]: true }));
      const asset = await api.getAsset(assetId);
      setDetails((prev) => ({ ...prev, [assetId]: asset }));
      setError((prev) => ({ ...prev, [assetId]: '' }));
    } catch (err) {
      setError((prev) => ({
        ...prev,
        [assetId]: err instanceof Error ? err.message : 'Erreur inconnue',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [assetId]: false }));
    }
  }, []);

  const toggleAsset = useCallback(
    async (assetId: number) => {
      if (expandedId === assetId) {
        setExpandedId(null);
        return;
      }
      if (!details[assetId]) {
        await loadAssetDetail(assetId);
      }
      setExpandedId(assetId);
    },
    [details, expandedId, loadAssetDetail],
  );

  useEffect(() => {
    if (!refreshTrigger || !expandedId) {
      return;
    }
    void loadAssetDetail(expandedId);
  }, [refreshTrigger, expandedId, loadAssetDetail]);

  const handleRefreshAsset = useCallback(
    async (event: MouseEvent<HTMLButtonElement>, assetId: number) => {
      event.stopPropagation();
      setFeedback((prev) => ({
        ...prev,
        [assetId]: { message: 'Actualisation en cours...', variant: 'info' },
      }));
      setRefreshing((prev) => ({ ...prev, [assetId]: true }));
      try {
        await refreshMutation.mutateAsync(assetId);
        await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
        if (expandedId === assetId) {
          await loadAssetDetail(assetId);
        }
        setFeedback((prev) => ({
          ...prev,
          [assetId]: { message: 'Prix mis a jour.', variant: 'success' },
        }));
      } catch (err) {
        setFeedback((prev) => ({
          ...prev,
          [assetId]: {
            message: err instanceof Error ? err.message : 'Echec de la mise a jour.',
            variant: 'error',
          },
        }));
      } finally {
        setRefreshing((prev) => ({ ...prev, [assetId]: false }));
      }
    },
    [expandedId, loadAssetDetail, queryClient, refreshMutation],
  );

  return (
    <div className="asset-list">
      {assets.map((asset) => {
        const isExpanded = expandedId === asset.id;
        const assetDetail = details[asset.id];
        const trend = computeTrendMetrics(asset.trend);
        const trendColor =
          trend?.status === 'up'
            ? '#34d399'
            : trend?.status === 'down'
            ? '#f87171'
            : '#94a3b8';
        const trendIcon = trend?.status === 'up' ? '+' : trend?.status === 'down' ? '-' : '~';
        const lastUpdateDate = asset.lastPriceUpdateAt ? new Date(asset.lastPriceUpdateAt) : null;
        const lastUpdateLabel = lastUpdateDate
          ? lastUpdateDate.toLocaleString('fr-FR')
          : 'Jamais';
        const isAssetRefreshing = refreshing[asset.id] ?? false;
        const assetFeedback = feedback[asset.id];

        return (
          <div key={asset.id} className="asset-card">
            <div
              className={clsx('asset-row', { 'asset-row--expanded': isExpanded })}
              onClick={() => toggleAsset(asset.id)}
              role="button"
              aria-expanded={isExpanded}
            >
              <div>
                <div className="symbol">{asset.symbol}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{asset.name}</div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#cbd5f5' }}>
                  Qt globale&nbsp;:{' '}
                  <strong style={{ color: '#e2e8f0' }}>{formatQuantity(asset.quantity)}</strong>
                </div>
                {trend ? (
                  <div
                    style={{
                      marginTop: '0.2rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.68rem',
                      color: trendColor,
                      backgroundColor: 'rgba(148, 163, 184, 0.12)',
                      borderRadius: '9999px',
                      padding: '0.15rem 0.5rem',
                    }}
                  >
                    <span>{trendIcon}</span>
                    <span>{`${Math.abs(trend.percent).toFixed(2)}%`}</span>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.2rem', fontSize: '0.68rem', color: '#94a3b8' }}>
                    Tendance indisponible
                  </div>
                )}
                <div style={{ marginTop: '0.2rem', fontSize: '0.68rem', color: '#94a3b8' }}>
                  Derniere mise a jour :{' '}
                  <span style={{ color: '#e2e8f0' }}>{lastUpdateLabel}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="value" style={{ fontSize: '1rem' }}>
                  {formatCurrency(asset.marketValue)}
                </div>
                <div
                  className="delta"
                  style={{ color: asset.gainLossValue >= 0 ? '#34d399' : '#f87171', fontSize: '0.78rem' }}
                >
                  {asset.gainLossValue >= 0 ? '+' : ''}
                  {formatCurrency(asset.gainLossValue)} ({asset.gainLossPercentage.toFixed(2)}%)
                </div>
                <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Cours actuel&nbsp;:
                  <strong style={{ color: '#e2e8f0', marginLeft: '0.35rem' }}>
                    {asset.latestPrice !== null ? formatCurrency(asset.latestPrice) : '—'}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={(event) => handleRefreshAsset(event, asset.id)}
                  disabled={isAssetRefreshing}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '9999px',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    backgroundColor: '#0f172a',
                    color: '#38bdf8',
                    fontSize: '0.75rem',
                    cursor: isAssetRefreshing ? 'wait' : 'pointer',
                  }}
                >
                  {isAssetRefreshing ? 'Actualisation...' : 'Actualiser'}
                </button>
              </div>
            </div>
            <div
              className={clsx('asset-details', { 'asset-details--visible': isExpanded })}
              aria-hidden={!isExpanded}
            >
              {loading[asset.id] && <div className="alert">Chargement...</div>}
              {error[asset.id] && <div className="alert error">{error[asset.id]}</div>}
              {assetFeedback && (
                <div
                  className={`alert${
                    assetFeedback.variant === 'error'
                      ? ' error'
                      : assetFeedback.variant === 'success'
                      ? ' success'
                      : ''
                  }`}
                >
                  {assetFeedback.message}
                </div>
              )}
              {assetDetail && (
                <div style={{ display: 'grid', gap: '1.2rem' }}>
                  {assetDetail.priceHistory.length > 0 && (
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={assetDetail.priceHistory.map((point) => ({
                            date: new Date(point.date).toLocaleDateString('fr-FR'),
                            value: point.value,
                          }))}
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id={`priceGradient-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.55} />
                              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            minTickGap={20}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            stroke="rgba(148, 163, 184, 0.2)"
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            stroke="rgba(148, 163, 184, 0.2)"
                            width={45}
                            tickFormatter={(value) => value.toFixed(0)}
                          />
                          <Tooltip
                            cursor={{ stroke: 'rgba(96, 165, 250, 0.35)', strokeWidth: 1 }}
                            contentStyle={{
                              background: 'rgba(15, 23, 42, 0.92)',
                              border: '1px solid rgba(96, 165, 250, 0.35)',
                              borderRadius: 8,
                              fontSize: '0.75rem',
                              color: '#e2e8f0',
                            }}
                            formatter={(value: number) => [formatCurrency(value), 'Cours']}
                            labelStyle={{ color: '#94a3b8' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#60a5fa"
                            fill={`url(#priceGradient-${asset.id})`}
                            strokeWidth={1.8}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="table-responsive">
                    <table>
                      <thead>
                        <tr>
                      <th>Date</th>
                          <th>Type</th>
                          <th>Quantite</th>
                          <th>Prix</th>
                          <th>Montant</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetDetail.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
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
                            <td>{tx.quantity}</td>
                            <td>{formatCurrency(tx.price)}</td>
                            <td>{formatCurrency(tx.price * tx.quantity)}</td>
                            <td>{tx.source ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
