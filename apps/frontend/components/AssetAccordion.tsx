'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { MouseEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssetSummary, AssetDetail } from '@portefeuille/types';
import { api } from '@/lib/api';
import clsx from 'clsx';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';
import { useToast } from '@/components/ToastProvider';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: value < 1 ? 6 : 2,
    minimumFractionDigits: 0,
  }).format(value);

const getTransactionTypeLabel = (type: string, source?: string | null): string => {
  if (source === 'dividend') return 'Dividende';
  if (source === 'tax-refund') return 'Remb. fiscal';
  if (type === 'BUY') return 'Achat';
  if (type === 'SELL') return 'Vente';
  return type;
};

const getTransactionTypeClass = (type: string, source?: string | null): string => {
  if (source === 'dividend') return 'tx-chip--dividend';
  if (source === 'tax-refund') return 'tx-chip--tax-refund';
  if (type === 'BUY') return 'tx-chip--buy';
  if (type === 'SELL') return 'tx-chip--sell';
  return 'tx-chip--other';
};

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
  return { change, percent, status, first, last };
};

const buildAssetTooltip =
  (detail: AssetDetail | undefined, formatDate: (value: number) => string) =>
  ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }
    const pointValueRaw = payload[0]?.value;
    const price =
      typeof pointValueRaw === 'number' ? pointValueRaw : Number(pointValueRaw ?? 0);
    const quantity = detail?.quantity ?? 0;
    const invested = detail?.investedValue ?? 0;
    const hasQuantity = quantity > 0 && invested !== 0;
    const totalValue = hasQuantity ? price * quantity : 0;
    const delta = hasQuantity ? totalValue - invested : 0;
    const deltaColor = delta > 0 ? '#34d399' : delta < 0 ? '#f87171' : '#94a3b8';
    const labelValue =
      typeof label === 'number' ? formatDate(label) : String(label ?? '');

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
        <div style={{ marginBottom: hasQuantity ? '0.2rem' : 0 }}>
          Cours : {formatCurrency(price)}
        </div>
        {hasQuantity && (
          <>
            <div style={{ marginBottom: '0.2rem' }}>
              Valeur totale : {formatCurrency(totalValue)}
            </div>
            <div style={{ color: deltaColor }}>
              Plus/moins-value : {delta >= 0 ? '+' : ''}
              {formatCurrency(delta)}
            </div>
          </>
        )}
      </div>
    );
  };

interface AssetAccordionProps {
  assets: AssetSummary[];
  refreshTrigger?: number | null;
}

export const AssetAccordion = ({ assets, refreshTrigger }: AssetAccordionProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, AssetDetail>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<Record<number, string>>({});
  const [refreshing, setRefreshing] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();
  const refreshMutation = useMutation({
    mutationFn: (assetId: number) => api.refreshAsset(assetId),
  });
  const { pushToast, dismissToast } = useToast();
  const refreshToastRef = useRef<Record<number, string | null>>({});
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }),
    [],
  );
  const formatDate = useCallback(
    (value: number) => dateFormatter.format(new Date(value)),
    [dateFormatter],
  );
  // Ajout refs pour scroll automatique
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (expandedId !== null && cardRefs.current[expandedId]) {
      // Attendre que l'animation d'ouverture soit terminée
      setTimeout(() => {
        const element = cardRefs.current[expandedId];
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const headerHeight = 150; // Hauteur du header sticky + marge de sécurité généreuse
        const targetY = Math.max(0, rect.top + scrollTop - headerHeight);
        const duration = 600;
        const startY = window.scrollY;
        const diff = targetY - startY;
        
        let start: number | undefined;
        function step(timestamp: number) {
          if (!start) start = timestamp;
          const elapsed = timestamp - start;
          const progress = Math.min(elapsed / duration, 1);
          window.scrollTo(0, startY + diff * easeInOutQuad(progress));
          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        }
        function easeInOutQuad(t: number) {
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }
        window.requestAnimationFrame(step);
      }, 250);
    }
  }, [expandedId]);

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

  useEffect(
    () => () => {
      Object.values(refreshToastRef.current).forEach((toastId) => {
        if (toastId) {
          dismissToast(toastId);
        }
      });
      refreshToastRef.current = {};
    },
    [dismissToast],
  );

  const handleRefreshAsset = useCallback(
    async (event: MouseEvent<HTMLButtonElement>, assetId: number) => {
      event.stopPropagation();
      const toastId = pushToast({
        message: 'Actualisation en cours...',
        variant: 'info',
        duration: 0,
      });
      refreshToastRef.current[assetId] = toastId;
      setRefreshing((prev) => ({ ...prev, [assetId]: true }));
      try {
        await refreshMutation.mutateAsync(assetId);
        await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
        if (expandedId === assetId) {
          await loadAssetDetail(assetId);
        }
        pushToast({ message: 'Prix mis a jour.', variant: 'success' });
      } catch (err) {
        pushToast({
          message: err instanceof Error ? err.message : 'Echec de la mise a jour.',
          variant: 'error',
        });
      } finally {
        const progressToastId = refreshToastRef.current[assetId];
        if (progressToastId) {
          dismissToast(progressToastId);
          delete refreshToastRef.current[assetId];
        }
        setRefreshing((prev) => ({ ...prev, [assetId]: false }));
      }
    },
    [dismissToast, expandedId, loadAssetDetail, pushToast, queryClient, refreshMutation],
  );

  return (
    <div className="asset-list">
  {assets.map((asset) => {
        const isExpanded = expandedId === asset.id;
        const assetDetail = details[asset.id];
        const trend = computeTrendMetrics(asset.trend);
        const trendIcon = trend?.status === 'up' ? '+' : trend?.status === 'down' ? '-' : '~';
        const trendClassName = clsx('asset-trend', {
          'asset-trend--up': trend?.status === 'up',
          'asset-trend--down': trend?.status === 'down',
          'asset-trend--flat': trend?.status === 'flat',
        });
        const lastUpdateDate = asset.lastPriceUpdateAt ? new Date(asset.lastPriceUpdateAt) : null;
        const lastUpdateLabel = lastUpdateDate
          ? lastUpdateDate.toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Jamais';
        const lastUpdateTitle = lastUpdateDate
          ? `Dernière mise à jour : ${lastUpdateDate.toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}`
          : 'Jamais mis à jour';
        const isAssetRefreshing = refreshing[asset.id] ?? false;

        const deltaClassName = clsx('asset-metrics__delta', {
          'asset-metrics__delta--up': asset.gainLossValue >= 0,
          'asset-metrics__delta--down': asset.gainLossValue < 0,
        });

        const latestPriceLabel =
          asset.latestPrice !== null ? formatCurrency(asset.latestPrice) : '-';

        return (
          <div
            key={asset.id}
            className="asset-card"
            ref={el => { cardRefs.current[asset.id] = el; }}
          >
            <div
              className={clsx('asset-row', { 'asset-row--expanded': isExpanded })}
              onClick={() => toggleAsset(asset.id)}
              role="button"
              aria-expanded={isExpanded}
            >
              <div className="asset-info">
                <div className="asset-info__body">
                  <div className="asset-info__identity">
                    <div className="symbol">{asset.symbol}</div>
                    {asset.symbol &&
                    ['EUR', 'USDC', 'USDT', 'USD', 'GBP', 'CHF'].includes(asset.symbol.toUpperCase()) ? (
                      <span className="badge badge--muted">Fiat</span>
                    ) : null}
                    <span className="asset-info__name">{asset.name}</span>
                    <span className="asset-info__quantity">
                      Qt globale&nbsp;:<strong>{formatQuantity(asset.quantity)}</strong>
                    </span>
                    {trend ? (
                      <span
                        className={trendClassName}
                        title={`Performance sur la période récente. Cours initial : ${formatCurrency(
                          trend.first,
                        )} • Cours actuel : ${formatCurrency(trend.last)} • Variation absolue : ${
                          trend.change >= 0 ? '+' : ''
                        }${formatCurrency(trend.change)}`}
                      >
                        <span>{trendIcon}</span>
                        <span>{`${Math.abs(trend.percent).toFixed(2)}%`}</span>
                      </span>
                    ) : (
                      <span className="asset-trend asset-trend--empty">Tendance indisponible</span>
                    )}
                  </div>
                  <div className="asset-info__meta">
                    <div className="asset-metrics">
                      <span className="asset-metrics__value">{formatCurrency(asset.marketValue)}</span>
                      <span className={deltaClassName}>
                        {asset.gainLossValue >= 0 ? '+' : ''}
                        {formatCurrency(asset.gainLossValue)} ({asset.gainLossPercentage.toFixed(2)}%)
                      </span>
                      <span className="asset-metrics__price">
                        Cours&nbsp;:<strong>{latestPriceLabel}</strong>
                      </span>
                    </div>
                    <div className="asset-actions">
                      <div className="asset-updated" title={lastUpdateTitle}>
                        <svg
                          className="asset-updated__icon"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
                          <path
                            d="M10 6v4l2.6 1.6"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="asset-updated__label">{lastUpdateLabel}</span>
                      </div>
                      <button
                        type="button"
                        className={clsx('asset-refresh', { 'asset-refresh--loading': isAssetRefreshing })}
                        onClick={(event) => handleRefreshAsset(event, asset.id)}
                        disabled={isAssetRefreshing}
                        aria-label="Actualiser l'actif"
                        title="Actualiser l'actif"
                      >
                        <svg
                          className="asset-refresh__icon"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
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
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className={clsx('asset-details', { 'asset-details--visible': isExpanded })}
              aria-hidden={!isExpanded}
            >
              {loading[asset.id] && <div className="alert">Chargement...</div>}
              {error[asset.id] && <div className="alert error">{error[asset.id]}</div>}
              {assetDetail && (
                <div style={{ display: 'grid', gap: '1.2rem' }}>
                  {assetDetail.priceHistory.length > 0 && (
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={assetDetail.priceHistory.map((point) => ({
                            date: new Date(point.date).getTime(),
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
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            scale="time"
                            minTickGap={20}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            stroke="rgba(148, 163, 184, 0.2)"
                            tickFormatter={(value: number) => formatDate(value)}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            stroke="rgba(148, 163, 184, 0.2)"
                            width={45}
                            tickFormatter={(value) => value.toFixed(0)}
                          />
                          <Tooltip
                            cursor={{ stroke: 'rgba(96, 165, 250, 0.35)', strokeWidth: 1 }}
                            content={buildAssetTooltip(assetDetail, formatDate)}
                          />
                          {assetDetail.investedValue > 0 && assetDetail.quantity > 0 && (
                            <ReferenceLine
                              y={assetDetail.investedValue / assetDetail.quantity}
                              stroke="#f8fafc"
                              strokeDasharray="4 4"
                              label={{
                                position: 'right',
                                value: `Cout moyen ${formatCurrency(
                                  assetDetail.investedValue / assetDetail.quantity,
                                )}`,
                                fill: '#f8fafc',
                                fontSize: 10,
                              }}
                            />
                          )}
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
                          <th>Frais</th>
                          <th>Montant</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetDetail.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                            <td>
                              <span className={clsx('tx-chip', getTransactionTypeClass(tx.type, tx.source))}>
                                {getTransactionTypeLabel(tx.type, tx.source)}
                              </span>
                            </td>
                            <td>{tx.quantity}</td>
                            <td>{formatCurrency(tx.price)}</td>
                            <td>{tx.fee !== null && tx.fee !== undefined ? formatCurrency(tx.fee) : '-'}</td>
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

