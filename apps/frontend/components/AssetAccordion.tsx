'use client';

import { useState, useCallback } from 'react';
import type { AssetSummary, AssetDetail } from '@portefeuille/types';
import { api } from '@/lib/api';

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
  const status =
    Math.abs(percent) < 0.1 ? 'flat' : change > 0 ? 'up' : 'down';
  return { change, percent, status };
};

interface AssetAccordionProps {
  assets: AssetSummary[];
}

export const AssetAccordion = ({ assets }: AssetAccordionProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, AssetDetail>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<Record<number, string>>({});

  const toggleAsset = useCallback(
    async (assetId: number) => {
      if (expandedId === assetId) {
        setExpandedId(null);
        return;
      }
      if (!details[assetId]) {
        try {
          setLoading((prev) => ({ ...prev, [assetId]: true }));
          const asset = await api.getAsset(assetId);
          setDetails((prev) => ({ ...prev, [assetId]: asset }));
          setError((prev) => ({ ...prev, [assetId]: '' }));
        } catch (err) {
          setError((prev) => ({ ...prev, [assetId]: err instanceof Error ? err.message : 'Erreur inconnue' }));
        } finally {
          setLoading((prev) => ({ ...prev, [assetId]: false }));
        }
      }
      setExpandedId(assetId);
    },
    [details, expandedId],
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
        const trendIcon =
          trend?.status === 'up'
            ? '↑'
            : trend?.status === 'down'
            ? '↓'
            : '→';
        return (
          <div key={asset.id}>
            <div className="asset-row" onClick={() => toggleAsset(asset.id)} role="button">
              <div>
                <div className="symbol">{asset.symbol}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{asset.name}</div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#cbd5f5' }}>
                  Qté globale&nbsp;: <strong style={{ color: '#e2e8f0' }}>{formatQuantity(asset.quantity)}</strong>
                </div>
                {trend ? (
                  <div
                    style={{
                      marginTop: '0.25rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem',
                      color: trendColor,
                      backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      borderRadius: '9999px',
                      padding: '0.2rem 0.6rem',
                    }}
                  >
                    <span>{trendIcon}</span>
                    <span>{`${Math.abs(trend.percent).toFixed(2)}%`}</span>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Tendance indisponible
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="value">{formatCurrency(asset.marketValue)}</div>
                <div className="delta" style={{ color: asset.gainLossValue >= 0 ? '#34d399' : '#f87171' }}>
                  {asset.gainLossValue >= 0 ? '+' : ''}
                  {formatCurrency(asset.gainLossValue)} ({asset.gainLossPercentage.toFixed(2)}%)
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="asset-details">
                {loading[asset.id] && <div className="alert">Chargement...</div>}
                {error[asset.id] && <div className="alert error">{error[asset.id]}</div>}
                {assetDetail && (
                  <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <div className="table-responsive">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Quantité</th>
                            <th>Prix</th>
                            <th>Montant</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assetDetail.transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                              <td>{tx.type === 'BUY' ? 'Achat' : 'Vente'}</td>
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
            )}
          </div>
        );
      })}
    </div>
  );
};
