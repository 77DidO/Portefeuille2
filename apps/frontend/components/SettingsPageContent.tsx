'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PortfolioCategory, PortfolioSummary } from '@portefeuille/types';
import { api } from '@/lib/api';

const categoryLabels: Record<PortfolioCategory, string> = {
  GLOBAL: 'Global',
  CRYPTO: 'Crypto',
  PEA: 'PEA',
  OTHER: 'Autre',
};

export function SettingsPageContent() {
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState('');
  const [resetError, setResetError] = useState('');
  const [backfillStatus, setBackfillStatus] = useState('');
  const [backfillError, setBackfillError] = useState('');

  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioCategory, setNewPortfolioCategory] = useState<PortfolioCategory>('OTHER');
  const [portfolioStatus, setPortfolioStatus] = useState('');
  const [portfolioError, setPortfolioError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCategory, setEditingCategory] = useState<PortfolioCategory>('OTHER');

  const queryClient = useQueryClient();
  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.getPortfolios(),
    staleTime: 30_000,
  });

  const invalidatePortfolios = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolios'] });
  };

  const createPortfolioMutation = useMutation({
    mutationFn: api.createPortfolio,
    onSuccess: (portfolio) => {
      setPortfolioStatus(`Portefeuille "${portfolio.name}" cree.`);
      setPortfolioError('');
      setNewPortfolioName('');
      setNewPortfolioCategory('OTHER');
      invalidatePortfolios();
    },
    onError: (err: unknown) => {
      setPortfolioStatus('');
      setPortfolioError(err instanceof Error ? err.message : 'Echec de la creation du portefeuille.');
    },
  });

  const updatePortfolioMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; category: PortfolioCategory } }) =>
      api.updatePortfolio(id, data),
    onSuccess: (portfolio) => {
      setPortfolioStatus(`Portefeuille "${portfolio.name}" mis a jour.`);
      setPortfolioError('');
      setEditingId(null);
      setEditingName('');
      invalidatePortfolios();
    },
    onError: (err: unknown) => {
      setPortfolioStatus('');
      setPortfolioError(err instanceof Error ? err.message : 'Echec de la mise a jour.');
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: api.deletePortfolio,
    onSuccess: () => {
      setPortfolioStatus('Portefeuille supprime.');
      setPortfolioError('');
      invalidatePortfolios();
    },
    onError: (err: unknown) => {
      setPortfolioStatus('');
      setPortfolioError(err instanceof Error ? err.message : 'Echec de la suppression.');
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () => api.backfillPriceHistory(),
    onSuccess: (result) => {
      const processedCount = result.processed.length;
      const insertedPoints = result.processed.reduce((acc, item) => acc + item.pointsInserted, 0);
      const skippedCount = result.skipped.length;
      const errorCount = result.errors.length;
      const fragments: string[] = [];
      if (processedCount > 0) {
        fragments.push(`${processedCount} actif${processedCount > 1 ? 's' : ''} reconstruit${processedCount > 1 ? 's' : ''} (${insertedPoints} points)`);
      }
      if (skippedCount > 0) {
        fragments.push(`${skippedCount} actif${skippedCount > 1 ? 's' : ''} ignore${skippedCount > 1 ? 's' : ''}`);
      }
      if (errorCount > 0) {
        fragments.push(`${errorCount} erreur${errorCount > 1 ? 's' : ''}`);
      }
      setBackfillStatus(fragments.join(' · ') || 'Aucun changement.');
      setBackfillError('');
      invalidatePortfolios();
    },
    onError: (err: unknown) => {
      setBackfillStatus('');
      setBackfillError(err instanceof Error ? err.message : 'Echec de la reconstruction de l\'historique.');
    },
  });

  const handleReset = async () => {
    if (!window.confirm('Confirmer la suppression de toutes les donnees ?')) {
      return;
    }
    try {
      setIsResetLoading(true);
      setResetStatus('');
      setResetError('');
      setBackfillStatus('');
      setBackfillError('');
      await api.resetData();
      setResetStatus('Toutes les donnees ont ete supprimees.');
      invalidatePortfolios();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Echec de la suppression.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleCreatePortfolio = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPortfolioName.trim()) {
      setPortfolioError('Veuillez renseigner un nom de portefeuille.');
      setPortfolioStatus('');
      return;
    }
    createPortfolioMutation.mutate({
      name: newPortfolioName.trim(),
      category: newPortfolioCategory,
    });
  };

  const startEditing = (portfolio: PortfolioSummary) => {
    setEditingId(portfolio.id);
    setEditingName(portfolio.name);
    setEditingCategory(portfolio.category);
    setPortfolioStatus('');
    setPortfolioError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    setPortfolioStatus('');
    setPortfolioError('');
  };

  const handleUpdatePortfolio = () => {
    if (editingId === null) {
      return;
    }
    if (!editingName.trim()) {
      setPortfolioError('Veuillez renseigner un nom de portefeuille.');
      return;
    }
    updatePortfolioMutation.mutate({
      id: editingId,
      data: { name: editingName.trim(), category: editingCategory },
    });
  };

  const handleDeletePortfolio = (portfolio: PortfolioSummary) => {
    if (portfolio.category === 'GLOBAL') {
      setPortfolioError('Le portefeuille Global ne peut pas etre supprime.');
      return;
    }
    if (!window.confirm(`Supprimer le portefeuille "${portfolio.name}" ?`)) {
      return;
    }
    deletePortfolioMutation.mutate(portfolio.id);
  };

  return (
    <main>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/" className="primary-link">
            Retour au tableau de bord
          </Link>
          <span style={{ color: 'rgba(148, 163, 184, 0.5)' }}>|</span>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Configuration generale</span>
        </div>
        <h1>Configuration</h1>
        <p>Administre les donnees, cree de nouveaux portefeuilles et gere leurs categories.</p>
      </div>

      <section className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ gridColumn: 'span 12', display: 'grid', gap: '0.75rem' }}>
          <h2>Maintenance des donnees</h2>
          <p style={{ margin: 0, color: '#94a3b8' }}>
            Cette operation supprime toutes les transactions, actifs et portefeuilles. Utiliser cette action uniquement pour repartir a zero.
          </p>
          <button type="button" className="danger" onClick={handleReset} disabled={isResetLoading}>
            {isResetLoading ? 'Nettoyage en cours...' : 'Vider toutes les donnees'}
          </button>
          {resetStatus && <div className="alert success">{resetStatus}</div>}
          {resetError && <div className="alert error">{resetError}</div>}
          <hr style={{ border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.15)', margin: '0.75rem 0 0.5rem' }} />
          <p style={{ margin: 0, color: '#94a3b8' }}>
            Reconstruit les historiques de cours a partir de votre premiere date d'achat pour chaque actif (Yahoo Finance pour les titres, Binance pour les cryptos).
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setBackfillStatus('');
              setBackfillError('');
              backfillMutation.mutate();
            }}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? 'Reconstruction en cours...' : 'Reconstruire l\'historique des cours'}
          </button>
          {backfillStatus && <div className="alert success">{backfillStatus}</div>}
          {backfillError && <div className="alert error">{backfillError}</div>}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card" style={{ gridColumn: 'span 12', display: 'grid', gap: '1.25rem' }}>
          <div>
            <h2>Gestion des portefeuilles</h2>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Creez de nouveaux portefeuilles pour distinguer vos positions (crypto, actions, assurances vie, etc.). Vous pouvez aussi renommer ou changer la categorie des portefeuilles existants.
            </p>
          </div>

          <form style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }} onSubmit={handleCreatePortfolio}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                Nom du portefeuille
              </label>
              <input
                type="text"
                value={newPortfolioName}
                onChange={(event) => setNewPortfolioName(event.target.value)}
                placeholder="Ex. PEA croissance"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                Categorie
              </label>
              <select value={newPortfolioCategory} onChange={(event) => setNewPortfolioCategory(event.target.value as PortfolioCategory)}>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="primary" disabled={createPortfolioMutation.isPending}>
              {createPortfolioMutation.isPending ? 'Creation...' : 'Ajouter un portefeuille'}
            </button>
          </form>

          {portfolioStatus && <div className="alert success">{portfolioStatus}</div>}
          {portfolioError && <div className="alert error">{portfolioError}</div>}

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Categorie</th>
                  <th>Valeur</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {portfoliosQuery.isLoading && (
                  <tr>
                    <td colSpan={4} style={{ color: '#94a3b8', padding: '1rem' }}>
                      Chargement des portefeuilles...
                    </td>
                  </tr>
                )}
                {portfoliosQuery.isError && (
                  <tr>
                    <td colSpan={4} style={{ color: '#f87171', padding: '1rem' }}>
                      Impossible de charger les portefeuilles.
                    </td>
                  </tr>
                )}
                {(portfoliosQuery.data ?? [])
                  .filter((portfolio) => portfolio.category !== 'GLOBAL')
                  .map((portfolio) => {
                  const isEditing = editingId === portfolio.id;
                  return (
                    <tr key={portfolio.id}>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                          />
                        ) : (
                          portfolio.name
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select value={editingCategory} onChange={(event) => setEditingCategory(event.target.value as PortfolioCategory)}>
                            {Object.entries(categoryLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          categoryLabels[portfolio.category]
                        )}
                      </td>
                      <td>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(portfolio.totalValue)}</td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        {isEditing ? (
                          <>
                            <button type="button" className="primary" onClick={handleUpdatePortfolio} disabled={updatePortfolioMutation.isPending}>
                              {updatePortfolioMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button type="button" className="danger" onClick={cancelEditing} disabled={updatePortfolioMutation.isPending}>
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="primary" onClick={() => startEditing(portfolio)}>
                              Modifier
                            </button>
                            <button type="button" className="danger" onClick={() => handleDeletePortfolio(portfolio)} disabled={deletePortfolioMutation.isPending || isGlobal}>
                              Supprimer
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {portfoliosQuery.data && portfoliosQuery.data.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: '#94a3b8', padding: '1rem' }}>
                      Aucun portefeuille pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
