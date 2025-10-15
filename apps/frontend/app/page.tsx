'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PortfolioSummary } from '@portefeuille/types';
import { api } from '@/lib/api';
import { DashboardCards } from '@/components/DashboardCards';
import { PortfolioSection } from '@/components/PortfolioSection';
import { ImportForm } from '@/components/ImportForm';

export default function HomePage() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<number | null>(null);
  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 60_000,
  });

  const portfolios = portfoliosQuery.data ?? [];
  const focusedPortfolios = useMemo(() => {
    if (!selectedPortfolio) return portfolios;
    return portfolios.filter((portfolio) => portfolio.id === selectedPortfolio);
  }, [portfolios, selectedPortfolio]);

  const handleSelect = (portfolioId: number) => {
    setSelectedPortfolio((prev) => (prev === portfolioId ? null : portfolioId));
  };

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#f8fafc' }}>Portefeuille Multi-Sources</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#94a3b8' }}>
            Visualisez et synchronisez vos investissements crypto, PEA et portefeuilles externes.
          </p>
        </div>
      </header>

      {portfoliosQuery.isLoading && <div className="card">Chargement des données...</div>}
      {portfoliosQuery.isError && (
        <div className="card">
          <div className="alert error">Impossible de charger les portefeuilles.</div>
        </div>
      )}

      {portfolios.length > 0 && (
        <DashboardCards portfolios={portfolios} onSelect={handleSelect} />
      )}

      <section className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <ImportForm portfolios={portfolios} />
        </div>
      </section>

      {focusedPortfolios.map((portfolio: PortfolioSummary) => (
        <PortfolioSection key={portfolio.id} portfolio={portfolio} />
      ))}

      {portfolios.length === 0 && !portfoliosQuery.isLoading && (
        <div className="card">
          <p style={{ color: '#94a3b8' }}>
            Aucun portefeuille pour le moment. Créez vos portefeuilles via l'API ou importez vos données CSV.
          </p>
        </div>
      )}
    </main>
  );
}
