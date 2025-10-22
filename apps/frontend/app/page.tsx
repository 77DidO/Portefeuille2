'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PortfolioSummary, RefreshAssetsResponse } from '@portefeuille/types';
import { api } from '@/lib/api';
import { DashboardCards } from '@/components/DashboardCards';
import { PortfolioSection } from '@/components/PortfolioSection';

export default function HomePage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [refreshStatus, setRefreshStatus] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState<number | null>(null);
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

  const handleRefreshPrices = async () => {
    try {
      setRefreshStatus('');
      setRefreshError('');
      const payload = selectedPortfolioId ? { portfolioId: selectedPortfolioId } : undefined;
      const result = await refreshMutation.mutateAsync(payload);
      const { refreshed, failures } = result;
      setRefreshStatus(
        refreshed.length > 0
          ? `${refreshed.length} actif${refreshed.length > 1 ? 's' : ''} mis a jour.`
          : 'Aucun actif mis a jour.',
      );
      if (failures.length > 0) {
        const messages = failures
          .slice(0, 3)
          .map((failure) => `#${failure.assetId}: ${failure.message}`)
          .join(' | ');
        setRefreshError(
          `${failures.length} echec${failures.length > 1 ? 's' : ''}. ${messages}`,
        );
      }
      setRefreshTrigger(Date.now());
    } catch (error) {
      setRefreshStatus('');
      setRefreshError(
        error instanceof Error ? error.message : 'Echec de la mise a jour des prix.',
      );
    }
  };

  return (
    <main>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          gap: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>Vue d'ensemble</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', maxWidth: 520 }}>
            Suivez la performance de vos portefeuilles globaux, PEA et crypto en temps reel. Importez vos donnees en
            quelques clics pour conserver une vision consolidee.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.65rem' }}>
          <button
            type="button"
            className="primary"
            onClick={handleRefreshPrices}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? 'Actualisation...' : 'Actualiser les prix'}
          </button>
          {(refreshStatus || refreshError) && (
            <div style={{ fontSize: '0.8rem', maxWidth: 320, textAlign: 'right' }}>
              {refreshStatus && <div style={{ color: '#38bdf8' }}>{refreshStatus}</div>}
              {refreshError && <div style={{ color: '#f87171' }}>{refreshError}</div>}
            </div>
          )}
        </div>
      </header>

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
        />
      )}

      {selectedPortfolio && (
        <section className="dashboard-grid" style={{ marginBottom: '2rem' }}>
          <div className="card" style={{ gridColumn: 'span 12' }}>
            <h2 style={{ margin: '0 0 1rem' }}>Détails du portefeuille</h2>
            <PortfolioSection portfolio={selectedPortfolio} refreshTrigger={refreshTrigger} />
          </div>
        </section>
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
