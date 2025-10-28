'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetStaleness, PortfolioCategory, PortfolioSummary } from '@portefeuille/types';
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
  const [staleAssets, setStaleAssets] = useState<AssetStaleness[]>([]);
  const [staleLoading, setStaleLoading] = useState(false);
  const [staleAssetsError, setStaleAssetsError] = useState('');

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

  const loadStaleAssets = async () => {
    try {
      setStaleLoading(true);
      setStaleAssetsError('');
      const assets = await api.getStaleAssets({ staleDays: 1 });
      setStaleAssets(assets);
    } catch (err) {
      setStaleAssetsError(
        err instanceof Error ? err.message : 'Impossible de charger les actifs non mis à jour.',
      );
    } finally {
      setStaleLoading(false);
    }
  };

  useEffect(() => {
    void loadStaleAssets();
  }, []);

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
      void loadStaleAssets();
    },
    onError: (err: unknown) => {
      setBackfillStatus('');
      setBackfillError(err instanceof Error ? err.message : 'Echec de la reconstruction de l\'historique.');
      void loadStaleAssets();
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

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return 'Jamais';
    }
    return new Date(value).toLocaleString('fr-FR');
  };

  return (
    <main>
      <div className="page-inner">
      <div className="page-header">
        <h1>Configuration</h1>
        <p>Administre les donnees, cree de nouveaux portefeuilles et gere leurs categories.</p>
      </div>

      <section className="dashboard-grid settings-grid" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ gridColumn: 'span 7', display: 'grid', gap: '1.25rem' }}>
          <div>
            <h2>Gestion des portefeuilles</h2>
            <p className="muted" style={{ margin: 0 }}>
              Creez de nouveaux portefeuilles pour distinguer vos positions (crypto, actions, assurances vie, etc.). Vous pouvez aussi renommer ou changer la categorie des portefeuilles existants.
            </p>
          </div>

          <form className="form-row" onSubmit={handleCreatePortfolio}>
            <div style={{ flex: '2 1 220px' }}>
              <label htmlFor="portfolio-name" className="form-label">
                Nom du portefeuille
              </label>
              <input
                id="portfolio-name"
                type="text"
                value={newPortfolioName}
                onChange={(event) => setNewPortfolioName(event.target.value)}
                placeholder="Ex. PEA croissance"
                className="input"
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label htmlFor="portfolio-category" className="form-label">
                Categorie
              </label>
              <select
                id="portfolio-category"
                value={newPortfolioCategory}
                onChange={(event) => setNewPortfolioCategory(event.target.value as PortfolioCategory)}
                className="input"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="primary" disabled={createPortfolioMutation.isPending} style={{ alignSelf: 'flex-end' }}>
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
                    <td colSpan={4} className="muted" style={{ padding: '1rem' }}>
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
                            className="input"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                          />
                        ) : (
                          portfolio.name
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select className="input" value={editingCategory} onChange={(event) => setEditingCategory(event.target.value as PortfolioCategory)}>
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
                      <td className="card-actions">
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
                            <button type="button" className="danger" onClick={() => handleDeletePortfolio(portfolio)} disabled={deletePortfolioMutation.isPending}>
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
                    <td colSpan={4} className="muted" style={{ padding: '1rem' }}>
                      Aucun portefeuille pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 5', display: 'grid', gap: '0.75rem' }}>
          <h2>Maintenance des donnees</h2>
          <p className="muted" style={{ margin: 0 }}>
            Cette operation supprime toutes les transactions, actifs et portefeuilles. Utiliser cette action uniquement pour repartir a zero.
          </p>
          <button type="button" className="danger" onClick={handleReset} disabled={isResetLoading}>
            {isResetLoading ? 'Nettoyage en cours...' : 'Vider toutes les donnees'}
          </button>
          {resetStatus && <div className="alert success">{resetStatus}</div>}
          {resetError && <div className="alert error">{resetError}</div>}
          <hr style={{ border: 'none', borderTop: '1px solid rgba(148, 163, 184, 0.15)', margin: '0.75rem 0 0.5rem' }} />
          <p className="muted" style={{ margin: 0 }}>
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
          <div className="stale-panel">
            <div className="stale-panel__header">
              Actifs sans mise à jour récente
              <span className="stale-panel__count">({staleAssets.length})</span>
            </div>
            {staleLoading ? (
              <div className="stale-panel__message">Analyse en cours...</div>
            ) : staleAssetsError ? (
              <div className="alert error" style={{ marginTop: '0.5rem' }}>
                {staleAssetsError}
              </div>
            ) : staleAssets.length === 0 ? (
              <div className="stale-panel__message">Tous les actifs possèdent un prix mis à jour aujourd&rsquo;hui.</div>
            ) : (
              <ul className="stale-panel__list">
                {staleAssets.map((asset) => (
                  <li key={asset.id} className="stale-panel__item">
                    <div>
                      <div className="stale-panel__asset">
                        <span className="symbol">{asset.symbol}</span>
                        <span>{asset.name}</span>
                      </div>
                      <div className="stale-panel__meta">
                        Portefeuille&nbsp;: <strong>{asset.portfolioName}</strong>
                      </div>
                    </div>
                    <div className="stale-panel__meta">
                      Dernière mise à jour&nbsp;: <strong>{formatDateTime(asset.lastPriceUpdateAt ?? asset.lastPricePointAt)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
