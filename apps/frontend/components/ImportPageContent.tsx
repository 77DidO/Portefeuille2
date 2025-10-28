'use client';

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
      <div className="page-inner">
      <div className="page-header">
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
          <p className="muted" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
            Sélectionnez le portefeuille cible puis glissez votre export Crédit Agricole, Binance ou Coinbase.
          </p>
          <ImportForm portfolios={portfolios} />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card" style={{ gridColumn: 'span 12', padding: '0.9rem 1rem' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#cbd5e1', fontSize: '0.9rem' }}>
              💡 Conseils pour un import optimal
            </summary>
            <ul className="muted" style={{ margin: '0.5rem 0 0', paddingLeft: '1.3rem', lineHeight: 1.6, fontSize: '0.85rem' }}>
              <li>Vérifiez que les entêtes des fichiers n'ont pas été modifiées après export.</li>
              <li>
                Les montants négatifs représentent des sorties (ventes, dépenses), les montants positifs des entrées (achats,
                dépôts).
              </li>
              <li>Vous pouvez relancer un import : les transactions existantes sont mises à jour ou fusionnées si besoin.</li>
            </ul>
          </details>
        </div>
      </section>
      </div>
    </main>
  );
}
