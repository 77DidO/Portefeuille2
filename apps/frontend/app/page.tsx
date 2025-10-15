'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PortfolioSummary } from '@portefeuille/types';
import { api } from '@/lib/api';
import { DashboardCards } from '@/components/DashboardCards';
import { PortfolioSection } from '@/components/PortfolioSection';
import { PortfolioBanner } from '@/components/PortfolioBanner';

export default function HomePage() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<number | null>(null);
  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 60_000,
  });
  const portfolios = portfoliosQuery.data ?? [];
  const focusedPortfolios = useMemo(() => {
    if (!selectedPortfolio) {
      return portfolios;
    }
    return portfolios.filter((portfolio) => portfolio.id === selectedPortfolio);
  }, [portfolios, selectedPortfolio]);

  const cryptoPortfolios = useMemo(
    () => focusedPortfolios.filter((portfolio) => portfolio.category === 'CRYPTO'),
    [focusedPortfolios],
  );
  const peaPortfolios = useMemo(
    () => focusedPortfolios.filter((portfolio) => portfolio.category === 'PEA'),
    [focusedPortfolios],
  );
  const otherPortfolios = useMemo(
    () =>
      focusedPortfolios.filter(
        (portfolio) => portfolio.category !== 'CRYPTO' && portfolio.category !== 'PEA',
      ),
    [focusedPortfolios],
  );

  const handleSelect = (portfolioId: number) => {
    setSelectedPortfolio((prev) => (prev === portfolioId ? null : portfolioId));
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
      </header>

      {portfoliosQuery.isLoading && <div className="card">Chargement des donnees...</div>}
      {portfoliosQuery.isError && (
        <div className="card">
          <div className="alert error">Impossible de charger les portefeuilles.</div>
        </div>
      )}

      {portfolios.length > 0 && <DashboardCards portfolios={portfolios} onSelect={handleSelect} />}

      {cryptoPortfolios.length > 0 && (
        <>
          <PortfolioBanner
            title="Portefeuilles Crypto"
            description="Suivez vos positions sur les plateformes d'echange."
            portfolios={cryptoPortfolios}
            onSelect={handleSelect}
          />
          <h2 style={{ margin: '2rem 0 1rem', color: '#cbd5f5', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Portefeuilles Crypto
          </h2>
          {cryptoPortfolios.map((portfolio, index) => (
            <div key={portfolio.id} id={index === 0 ? 'portfolios' : undefined}>
              <PortfolioSection portfolio={portfolio} />
            </div>
          ))}
        </>
      )}

      {peaPortfolios.length > 0 && (
        <>
          <PortfolioBanner
            title="Portefeuilles PEA"
            description="Vue d'ensemble de vos titres loges sur PEA."
            portfolios={peaPortfolios}
            onSelect={handleSelect}
          />
          <h2 style={{ margin: '2rem 0 1rem', color: '#cbd5f5', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Portefeuilles PEA
          </h2>
          {peaPortfolios.map((portfolio) => (
            <PortfolioSection key={portfolio.id} portfolio={portfolio} />
          ))}
        </>
      )}

      {otherPortfolios.length > 0 && (
        <>
          <PortfolioBanner
            title="Autres portefeuilles"
            description="Investissements complementaires (compte-titres, assurance-vie, etc.)."
            portfolios={otherPortfolios}
            onSelect={handleSelect}
          />
          <h2 style={{ margin: '2rem 0 1rem', color: '#cbd5f5', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Autres portefeuilles
          </h2>
          {otherPortfolios.map((portfolio) => (
            <PortfolioSection key={portfolio.id} portfolio={portfolio} />
          ))}
        </>
      )}

      {portfolios.length === 0 && !portfoliosQuery.isLoading && (
        <div className="card">
          <p style={{ color: '#94a3b8' }}>
            Aucun portefeuille pour le moment. Creez vos portefeuilles via l'API ou importez vos donnees CSV.
          </p>
        </div>
      )}
    </main>
  );
}
