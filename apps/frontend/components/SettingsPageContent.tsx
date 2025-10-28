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

const defaultColors: Record<PortfolioCategory, string> = {
  GLOBAL: '#4ade80',
  CRYPTO: '#fbbf24',
  PEA: '#60a5fa',
  OTHER: '#a78bfa',
};

const getPortfolioColor = (portfolio: PortfolioSummary): string => {
  return portfolio.color || defaultColors[portfolio.category] || '#a78bfa';
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
  const [newPortfolioColor, setNewPortfolioColor] = useState('');
  const [portfolioStatus, setPortfolioStatus] = useState('');
  const [portfolioError, setPortfolioError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCategory, setEditingCategory] = useState<PortfolioCategory>('OTHER');
  const [editingColor, setEditingColor] = useState('');

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
      setNewPortfolioColor('');
      invalidatePortfolios();
    },
    onError: (err: unknown) => {
      setPortfolioStatus('');
      setPortfolioError(err instanceof Error ? err.message : 'Echec de la creation du portefeuille.');
    },
  });

  const updatePortfolioMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; category?: PortfolioCategory; color?: string } }) =>
      api.updatePortfolio(id, data),
    onSuccess: (portfolio) => {
      setPortfolioStatus(`Portefeuille "${portfolio.name}" mis a jour.`);
      setPortfolioError('');
      setEditingId(null);
      setEditingName('');
      setEditingColor('');
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
      color: newPortfolioColor || undefined,
    });
  };

  const startEditing = (portfolio: PortfolioSummary) => {
    setEditingId(portfolio.id);
    setEditingName(portfolio.name);
    setEditingCategory(portfolio.category);
    setEditingColor(portfolio.color || '');
    setPortfolioStatus('');
    setPortfolioError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    setEditingColor('');
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
      data: { 
        name: editingName.trim(), 
        category: editingCategory,
        color: editingColor || undefined,
      },
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
          <h1>⚙️ Configuration</h1>
          <p className="muted">Gérez vos portefeuilles, catégories et données de l'application.</p>
        </div>

        <div className="settings-layout">
          {/* Section Gestion des Portefeuilles */}
          <section className="settings-section">
            <div className="settings-section-header">
              <h2>📊 Gestion des portefeuilles</h2>
              <p className="muted">
                Créez, modifiez ou supprimez vos portefeuilles (crypto, PEA, assurances vie, etc.).
              </p>
            </div>

            <div className="settings-card">
              <h3 className="settings-card-title">Créer un nouveau portefeuille</h3>
              
              <form className="portfolio-form" onSubmit={handleCreatePortfolio}>
                <div className="form-group">
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

                <div className="form-group">
                  <label htmlFor="portfolio-category" className="form-label">
                    Catégorie
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

                <div className="form-group">
                  <label htmlFor="portfolio-color" className="form-label">
                    Couleur personnalisée (optionnel)
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      id="portfolio-color"
                      type="color"
                      value={newPortfolioColor || defaultColors[newPortfolioCategory]}
                      onChange={(event) => setNewPortfolioColor(event.target.value)}
                      className="input"
                      style={{ width: '80px', height: '40px', padding: '0.25rem', cursor: 'pointer' }}
                    />
                    {newPortfolioColor && (
                      <button
                        type="button"
                        onClick={() => setNewPortfolioColor('')}
                        className="btn-sm btn-ghost"
                        style={{ fontSize: '0.8rem' }}
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                  <p className="muted" style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
                    Par défaut : {categoryLabels[newPortfolioCategory]} → <span style={{ color: defaultColors[newPortfolioCategory] }}>●</span>
                  </p>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary-modern" 
                  disabled={createPortfolioMutation.isPending}
                >
                  {createPortfolioMutation.isPending ? '⏳ Création...' : '➕ Ajouter le portefeuille'}
                </button>
              </form>

              {portfolioStatus && (
                <div className="alert-modern alert-success">
                  <span className="alert-icon">✅</span>
                  {portfolioStatus}
                </div>
              )}
              {portfolioError && (
                <div className="alert-modern alert-error">
                  <span className="alert-icon">⚠️</span>
                  {portfolioError}
                </div>
              )}
            </div>

            <div className="settings-card">
              <h3 className="settings-card-title">Portefeuilles existants</h3>
              
              {portfoliosQuery.isLoading && (
                <div className="loading-state">⏳ Chargement des portefeuilles...</div>
              )}
              
              {portfoliosQuery.isError && (
                <div className="alert-modern alert-error">
                  <span className="alert-icon">⚠️</span>
                  Impossible de charger les portefeuilles.
                </div>
              )}

              {!portfoliosQuery.isLoading && !portfoliosQuery.isError && (
                <div className="portfolios-list">
                  {(portfoliosQuery.data ?? [])
                    .filter((portfolio) => portfolio.category !== 'GLOBAL')
                    .map((portfolio) => {
                      const isEditing = editingId === portfolio.id;
                      return (
                        <div key={portfolio.id} className="portfolio-item">
                          <div className="portfolio-item-content">
                            {isEditing ? (
                              <div className="portfolio-edit-form">
                                <input
                                  type="text"
                                  className="input input-sm"
                                  value={editingName}
                                  onChange={(event) => setEditingName(event.target.value)}
                                  placeholder="Nom du portefeuille"
                                />
                                <select 
                                  className="input input-sm" 
                                  value={editingCategory} 
                                  onChange={(event) => setEditingCategory(event.target.value as PortfolioCategory)}
                                >
                                  {Object.entries(categoryLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="color"
                                  className="input input-sm"
                                  value={editingColor || defaultColors[editingCategory]}
                                  onChange={(event) => setEditingColor(event.target.value)}
                                  style={{ width: '60px', padding: '0.25rem', cursor: 'pointer' }}
                                  title="Couleur"
                                />
                              </div>
                            ) : (
                              <>
                                <div className="portfolio-info">
                                  <span 
                                    style={{ 
                                      width: '12px', 
                                      height: '12px', 
                                      borderRadius: '50%', 
                                      backgroundColor: getPortfolioColor(portfolio),
                                      display: 'inline-block',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <h4 className="portfolio-name">{portfolio.name}</h4>
                                  <span className={`portfolio-badge portfolio-badge-${portfolio.category.toLowerCase()}`}>
                                    {categoryLabels[portfolio.category]}
                                  </span>
                                </div>
                                <div className="portfolio-value">
                                  {new Intl.NumberFormat('fr-FR', { 
                                    style: 'currency', 
                                    currency: 'EUR',
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }).format(portfolio.totalValue)}
                                </div>
                              </>
                            )}
                          </div>

                          <div className="portfolio-item-actions">
                            {isEditing ? (
                              <>
                                <button 
                                  type="button" 
                                  className="btn-sm btn-success" 
                                  onClick={handleUpdatePortfolio} 
                                  disabled={updatePortfolioMutation.isPending}
                                >
                                  {updatePortfolioMutation.isPending ? '⏳' : '✓ Valider'}
                                </button>
                                <button 
                                  type="button" 
                                  className="btn-sm btn-ghost" 
                                  onClick={cancelEditing} 
                                  disabled={updatePortfolioMutation.isPending}
                                >
                                  ✕ Annuler
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  type="button" 
                                  className="btn-sm btn-edit" 
                                  onClick={() => startEditing(portfolio)}
                                  title="Modifier"
                                >
                                  ✏️ Modifier
                                </button>
                                <button 
                                  type="button" 
                                  className="btn-sm btn-delete" 
                                  onClick={() => handleDeletePortfolio(portfolio)} 
                                  disabled={deletePortfolioMutation.isPending}
                                  title="Supprimer"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {portfoliosQuery.data && portfoliosQuery.data.filter(p => p.category !== 'GLOBAL').length === 0 && (
                    <div className="empty-state">
                      <span className="empty-state-icon">📭</span>
                      <p>Aucun portefeuille pour le moment.</p>
                      <p className="muted">Créez-en un ci-dessus pour commencer.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Section Maintenance */}
          <aside className="settings-sidebar">
            <section className="settings-section">
              <div className="settings-section-header">
                <h2>🔧 Maintenance</h2>
                <p className="muted">Outils de gestion des données.</p>
              </div>

              <div className="settings-card maintenance-card">
                <div className="maintenance-item">
                  <div className="maintenance-header">
                    <h4>🔄 Reconstruire l'historique</h4>
                    <p className="muted">
                      Récupère les cours depuis votre première date d'achat (Yahoo Finance pour les titres, Binance pour les cryptos).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary-modern"
                    onClick={() => {
                      setBackfillStatus('');
                      setBackfillError('');
                      backfillMutation.mutate();
                    }}
                    disabled={backfillMutation.isPending}
                  >
                    {backfillMutation.isPending ? '⏳ En cours...' : '🔄 Reconstruire'}
                  </button>
                  {backfillStatus && (
                    <div className="alert-modern alert-success">
                      <span className="alert-icon">✅</span>
                      {backfillStatus}
                    </div>
                  )}
                  {backfillError && (
                    <div className="alert-modern alert-error">
                      <span className="alert-icon">⚠️</span>
                      {backfillError}
                    </div>
                  )}
                </div>

                <div className="maintenance-divider" />

                <div className="maintenance-item">
                  <div className="maintenance-header">
                    <h4>🗑️ Réinitialiser toutes les données</h4>
                    <p className="muted danger-text">
                      ⚠️ Attention : Cette action supprime toutes les transactions, actifs et portefeuilles de manière irréversible.
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className="btn-danger-modern" 
                    onClick={handleReset} 
                    disabled={isResetLoading}
                  >
                    {isResetLoading ? '⏳ Suppression...' : '🗑️ Tout supprimer'}
                  </button>
                  {resetStatus && (
                    <div className="alert-modern alert-success">
                      <span className="alert-icon">✅</span>
                      {resetStatus}
                    </div>
                  )}
                  {resetError && (
                    <div className="alert-modern alert-error">
                      <span className="alert-icon">⚠️</span>
                      {resetError}
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-card">
                <div className="stale-assets-header">
                  <h4>⏰ Actifs nécessitant une mise à jour</h4>
                  <span className="stale-count">{staleAssets.length}</span>
                </div>
                
                {staleLoading ? (
                  <div className="loading-state">⏳ Analyse en cours...</div>
                ) : staleAssetsError ? (
                  <div className="alert-modern alert-error">
                    <span className="alert-icon">⚠️</span>
                    {staleAssetsError}
                  </div>
                ) : staleAssets.length === 0 ? (
                  <div className="empty-state-sm">
                    <span className="empty-state-icon">✅</span>
                    <p>Tous les actifs sont à jour !</p>
                  </div>
                ) : (
                  <ul className="stale-assets-list">
                    {staleAssets.map((asset) => (
                      <li key={asset.id} className="stale-asset-item">
                        <div className="stale-asset-info">
                          <span className="stale-asset-symbol">{asset.symbol}</span>
                          <span className="stale-asset-name">{asset.name}</span>
                        </div>
                        <div className="stale-asset-meta">
                          <span className="stale-portfolio">{asset.portfolioName}</span>
                          <span className="stale-date">
                            {formatDateTime(asset.lastPriceUpdateAt ?? asset.lastPricePointAt)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
