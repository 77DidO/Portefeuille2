'use client';

import { useState, useCallback } from 'react';
import type { AssetSummary, AssetDetail } from '@portefeuille/types';
import { api } from '@/lib/api';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

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
        return (
          <div key={asset.id}>
            <div className="asset-row" onClick={() => toggleAsset(asset.id)} role="button">
              <div>
                <div className="symbol">{asset.symbol}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{asset.name}</div>
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
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={assetDetail.priceHistory} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`asset-gradient-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.9} />
                              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                          <XAxis dataKey="date" hide />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b' }}
                            formatter={(value: number) => formatCurrency(value)}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#22d3ee"
                            fillOpacity={1}
                            fill={`url(#asset-gradient-${asset.id})`}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
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
