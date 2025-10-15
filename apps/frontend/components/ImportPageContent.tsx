'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ImportForm } from '@/components/ImportForm';

export function ImportPageContent() {
  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 60_000,
  });

  const portfolios = portfoliosQuery.data ?? [];

  return (
    <main>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/" className="primary-link">
            ← Retour au tableau de bord
          </Link>
          <span style={{ color: 'rgba(148, 163, 184, 0.5)' }}>•</span>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Import de flux externes</span>
        </div>
        <h1>Imports CSV</h1>
        <p>
          Chargez les exports de vos banques et plateformes crypto pour enrichir automatiquement vos portefeuilles.
          Les mouvements valides sont rapprochés de vos actifs existants ou créent automatiquement les lignes manquantes.
        </p>
      </div>

      {portfoliosQuery.isLoading && <div className="card">Récupération de vos portefeuilles...</div>}
      {portfoliosQuery.isError && (
        <div className="card">
          <div className="alert error">
            Une erreur est survenue lors du chargement des portefeuilles. Merci de réessayer plus tard.
          </div>
        </div>
      )}

      <section className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <h2>Importer un fichier CSV</h2>
          <p style={{ marginTop: 0, color: '#94a3b8' }}>
            Sélectionnez le portefeuille cible puis glissez votre export Crédit Agricole, Binance ou Coinbase. Nous
            détectons automatiquement les colonnes attendues.
          </p>
          <ImportForm portfolios={portfolios} />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card" style={{ gridColumn: 'span 12', display: 'grid', gap: '0.75rem' }}>
          <h2>Conseils pour un import optimal</h2>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#94a3b8', lineHeight: 1.6 }}>
            <li>Vérifiez que les entêtes des fichiers n’ont pas été modifiées après export.</li>
            <li>
              Les montants négatifs représentent des sorties (ventes, dépenses), les montants positifs des entrées (achats,
              dépôts).
            </li>
            <li>Vous pouvez relancer un import : les transactions existantes sont mises à jour ou fusionnées si besoin.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
