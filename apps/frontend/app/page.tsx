'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PortfolioSummary, RefreshAssetsResponse } from '@portefeuille/types';
import { api } from '@/lib/api';
import { DashboardCards } from '@/components/DashboardCards';
import { useToast } from '@/components/ToastProvider';

export default function HomePage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number | null>(null);
  const refreshToastId = useRef<string | null>(null);
  const { pushToast, dismissToast } = useToast();
  const queryClient = useQueryClient();
  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 60_000,
  });
  const refreshMutation = useMutation<RefreshAssetsResponse, Error, { portfolioId?: number } | undefined>({
    mutationFn: (payload?: { portfolioId?: number }) => api.refreshAssets(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });
  const portfolios = portfoliosQuery.data ?? [];
  const visiblePortfolios = useMemo(
    () => portfolios.filter((portfolio) => portfolio.assets.length > 0),
    [portfolios],
  );
  const assetLabels = useMemo(() => {
    const map = new Map<number, string>();
    portfolios.forEach((portfolio) => {
      portfolio.assets.forEach((asset) => {
        const parts = [asset.symbol?.toUpperCase(), asset.name].filter(Boolean);
        const label = parts.length > 0 ? parts.join(' · ') : `Actif #${asset.id}`;
        map.set(asset.id, `${portfolio.name} · ${label}`);
      });
    });
    return map;
  }, [portfolios]);

  useEffect(() => {
    if (visiblePortfolios.length === 0) {
      setSelectedPortfolioId(null);
      return;
    }
    setSelectedPortfolioId((current) => {
      if (current && visiblePortfolios.some((portfolio) => portfolio.id === current)) {
        return current;
      }
      return visiblePortfolios[0]?.id ?? null;
    });
  }, [visiblePortfolios]);

  const selectedPortfolio = useMemo(
    () => visiblePortfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [selectedPortfolioId, visiblePortfolios],
  );

  const handleSelect = (portfolioId: number) => {
    setSelectedPortfolioId(portfolioId);
  };

  const handleRefreshPrices = async (portfolioId?: number) => {
    const pendingToastId = pushToast({
      message: 'Actualisation des prix en cours...',
      variant: 'info',
      duration: 0,
    });
    refreshToastId.current = pendingToastId;
    try {
      const payload =
        portfolioId !== undefined
          ? { portfolioId }
          : selectedPortfolioId
          ? { portfolioId: selectedPortfolioId }
          : undefined;
      const result = await refreshMutation.mutateAsync(payload);
      const { refreshed, failures } = result;

      const summarizeList = (items: string[], limit = 4) => {
        if (items.length === 0) {
          return '';
        }
        const displayed = items.slice(0, limit);
        const remaining = items.length - displayed.length;
        let summary = displayed.join(', ');
        if (remaining > 0) {
          summary += ` +${remaining} autre${remaining > 1 ? 's' : ''}`;
        }
        return summary;
      };

      if (refreshed.length > 0) {
        const labels = refreshed.map((item) => assetLabels.get(item.assetId) ?? `Actif #${item.assetId}`);
        pushToast({
          message: `Mises à jour (${refreshed.length}) : ${summarizeList(labels)}`,
          variant: 'success',
        });
      } else {
        pushToast({ message: 'Aucun actif mis à jour.', variant: 'info' });
      }

      if (failures.length > 0) {
        const failureLabels = failures.map((failure) => {
          const base = assetLabels.get(failure.assetId) ?? `Actif #${failure.assetId}`;
          return `${base} (${failure.message})`;
        });
        pushToast({
          message: `Échecs (${failures.length}) : ${summarizeList(failureLabels, 3)}`,
          variant: 'error',
        });
      }
      setRefreshTrigger(Date.now());
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : 'Échec de la mise à jour des prix.',
        variant: 'error',
      });
    } finally {
      if (refreshToastId.current) {
        dismissToast(refreshToastId.current);
        refreshToastId.current = null;
      }
    }
  };

  return (
    <main>
      {portfoliosQuery.isLoading && <div className="card">Chargement des donnees...</div>}
      {portfoliosQuery.isError && (
        <div className="card">
          <div className="alert error">Impossible de charger les portefeuilles.</div>
        </div>
      )}

      {visiblePortfolios.length > 0 && (
        <DashboardCards
          portfolios={visiblePortfolios}
          onSelect={handleSelect}
          selectedPortfolioId={selectedPortfolioId}
          selectedPortfolio={selectedPortfolio}
          refreshTrigger={refreshTrigger}
          onRefresh={handleRefreshPrices}
          isRefreshing={refreshMutation.isPending}
        />
      )}

      {visiblePortfolios.length === 0 && !portfoliosQuery.isLoading && (
        <div className="card">
          <p style={{ color: '#94a3b8' }}>
            Aucun portefeuille pour le moment. Creez vos portefeuilles via l'API ou importez vos donnees CSV.
          </p>
        </div>
      )}
    </main>
  );
}
