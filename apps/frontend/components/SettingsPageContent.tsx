"use client";

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetStaleness, PortfolioCategory, PortfolioSummary } from '@portefeuille/types';
import { api } from '@/lib/api';
import { BackupCard } from './BackupCard';
import { useToast } from './ToastProvider';

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
  // Portefeuilles
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioCategory, setNewPortfolioCategory] = useState<PortfolioCategory>('OTHER');
  const [newPortfolioColor, setNewPortfolioColor] = useState('');
  const [portfolioStatus, setPortfolioStatus] = useState('');
  const [portfolioError, setPortfolioError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCategory, setEditingCategory] = useState<PortfolioCategory>('OTHER');
  const [editingColor, setEditingColor] = useState('');

  // Maintenance
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState('');
  const [resetError, setResetError] = useState('');
  const [backfillStatus, setBackfillStatus] = useState('');
  const [backfillError, setBackfillError] = useState('');
  const [redisEnabled, setRedisEnabled] = useState<boolean | null>(null);
  const [redisToggleLoading, setRedisToggleLoading] = useState(false);
  const [redisToggleError, setRedisToggleError] = useState('');

  // Stale assets
  const [staleAssets, setStaleAssets] = useState<AssetStaleness[]>([]);
  const [staleLoading, setStaleLoading] = useState(false);
  const [staleAssetsError, setStaleAssetsError] = useState('');
  const [showBackups, setShowBackups] = useState(true);

  // Backups (derniers + création rapide)
  const backupsQuery = useQuery({
    queryKey: ['backups'],
    queryFn: api.getBackups,
    staleTime: 30_000,
  });
  const createBackupMutation = useMutation({
    mutationFn: () => api.createBackup(true),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      const stats = `${data.stats.portfolios} portefeuilles, ${data.stats.assets} actifs`;
      pushToast({ 
        message: `✓ Backup créé (${stats})`, 
        variant: 'success',
        duration: 5000,
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Échec de la création du backup';
      pushToast({ 
        message, 
        variant: 'error',
        duration: 6000,
      });
    },
  });

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

  useEffect(() => {
    api.getRedisEnabled()
      .then((res) => setRedisEnabled(res.enabled))
      .catch(() => setRedisEnabled(null));
  }, []);

  const handleToggleRedis = async () => {
    if (redisEnabled === null) return;
    setRedisToggleLoading(true);
    setRedisToggleError('');
    try {
      const res = await api.setRedisEnabled(!redisEnabled);
      setRedisEnabled(res.enabled);
    } catch (err) {
      setRedisToggleError('Erreur lors du changement de l\'état du cache Redis.');
    } finally {
      setRedisToggleLoading(false);
    }
  };

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
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.125rem', lineHeight: 1.25 }}>Configuration</h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Gérez vos portefeuilles, sauvegardes et outils de maintenance.
          </p>
        </div>

        <div className="dashboard-grid" style={{ gap: '1.25rem' }}>
          {/* Carte Gestion des Portefeuilles */}
          <section className="card" style={{ gridColumn: 'span 12' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Gestion des portefeuilles</h2>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Créez, modifiez ou supprimez vos portefeuilles (crypto, PEA, assurances vie, etc.).
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Portefeuilles existants</h3>
              
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
                                <div className="portfolio-value" style={{ fontSize: '0.95rem' }}>
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
                      <p className="muted">Créez-en un ci-dessous pour commencer.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Création d'un portefeuille */}
            <div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Créer un nouveau portefeuille</h3>
              
              <form className="portfolio-form" onSubmit={handleCreatePortfolio}>
                <div className="form-group">
                  <label htmlFor="portfolio-name" className="form-label" style={{ fontSize: '0.85rem' }}>
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
                  <label htmlFor="portfolio-category" className="form-label" style={{ fontSize: '0.85rem' }}>
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
                  <label htmlFor="portfolio-color" className="form-label" style={{ fontSize: '0.85rem' }}>
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
                  <p className="muted" style={{ fontSize: '0.8rem', margin: '0.35rem 0 0' }}>
                    Par défaut : {categoryLabels[newPortfolioCategory]} → <span style={{ color: defaultColors[newPortfolioCategory] }}>●</span>
                  </p>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary-modern btn-sm" 
                  disabled={createPortfolioMutation.isPending}
                >
                  {createPortfolioMutation.isPending ? '⏳ Création...' : 'Ajouter le portefeuille'}
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
          </section>

          {/* Carte Sauvegardes */}
          <section className="card" style={{ gridColumn: 'span 6' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Sauvegardes</h2>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Créez et gérez les sauvegardes de la base de données.
            </p>

            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="btn-primary-modern btn-sm"
                onClick={() => createBackupMutation.mutate()}
                disabled={createBackupMutation.isPending}
                title="Créer un backup maintenant"
              >
                {createBackupMutation.isPending ? '⏳ Création...' : 'Créer un backup'}
              </button>
            </div>

            {backupsQuery.isLoading && (
              <div className="loading-state" style={{ fontSize: '0.9rem' }}>⏳ Chargement des backups...</div>
            )}
            {backupsQuery.isError && (
              <div className="alert-modern alert-error" style={{ fontSize: '0.9rem' }}>
                <span className="alert-icon">⚠️</span>
                Impossible de charger les backups.
              </div>
            )}

            {backupsQuery.data && (
              <div className="flex flex-col gap-2">
                {backupsQuery.data.backups.slice(0, 5).map((b) => (
                  <BackupCard
                    key={b.filename}
                    filename={b.filename}
                    size={b.size}
                    createdAt={b.createdAt}
                    compressed={b.compressed}
                    onDelete={async (fn: string) => {
                      await api.deleteBackup(fn);
                      queryClient.invalidateQueries({ queryKey: ['backups'] });
                    }}
                    onDownload={(fn: string) => api.downloadBackup(fn)}
                  />
                ))}
                {backupsQuery.data.backups.length === 0 && (
                  <div className="empty-state-sm" style={{ fontSize: '0.9rem' }}>
                    <span className="empty-state-icon">📭</span>
                    <p>Aucun backup pour le moment.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Carte Maintenance */}
          <section className="card" style={{ gridColumn: 'span 6' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Maintenance</h2>
            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Outils de gestion des données.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <div className="maintenance-header" style={{ marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem' }}>Cache des prix (Redis)</h4>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Active ou désactive le cache des prix côté serveur (nécessite un redémarrage pour effet complet).
                </p>
              </div>
              <button
                type="button"
                className={(redisEnabled ? 'btn-secondary-modern' : 'btn-danger-modern') + ' btn-sm'}
                onClick={handleToggleRedis}
                disabled={redisToggleLoading || redisEnabled === null}
                style={{ minWidth: 180 }}
              >
                {redisToggleLoading
                  ? '⏳ Changement...'
                  : redisEnabled === null
                    ? 'Chargement...'
                    : redisEnabled
                      ? '✅ Cache activé'
                      : '❌ Cache désactivé'}
              </button>
              {redisToggleError && (
                <div className="alert-modern alert-error" style={{ marginTop: 8 }}>
                  <span className="alert-icon">⚠️</span>
                  {redisToggleError}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div className="maintenance-header" style={{ marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem' }}>Reconstruire l'historique</h4>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Récupère les cours depuis votre première date d'achat (Yahoo Finance pour les titres, Binance pour les cryptos).
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary-modern btn-sm"
                onClick={() => {
                  setBackfillStatus('');
                  setBackfillError('');
                  backfillMutation.mutate();
                }}
                disabled={backfillMutation.isPending}
              >
                {backfillMutation.isPending ? '⏳ En cours...' : 'Reconstruire'}
              </button>
              {backfillStatus && (
                <div className="alert-modern alert-success" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  <span className="alert-icon">✅</span>
                  {backfillStatus}
                </div>
              )}
              {backfillError && (
                <div className="alert-modern alert-error" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  <span className="alert-icon">⚠️</span>
                  {backfillError}
                </div>
              )}
            </div>

            <div className="maintenance-divider" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1rem 0' }} />

            <div style={{ marginBottom: '1rem' }}>
              <div className="maintenance-header" style={{ marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem' }}>Réinitialiser toutes les données</h4>
                <p className="muted danger-text" style={{ fontSize: '0.85rem' }}>
                  ⚠️ Attention : Cette action supprime toutes les transactions, actifs et portefeuilles de manière irréversible.
                </p>
              </div>
              <button 
                type="button" 
                className="btn-danger-modern btn-sm" 
                onClick={handleReset} 
                disabled={isResetLoading}
              >
                {isResetLoading ? '⏳ Suppression...' : 'Tout supprimer'}
              </button>
              {resetStatus && (
                <div className="alert-modern alert-success" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  <span className="alert-icon">✅</span>
                  {resetStatus}
                </div>
              )}
              {resetError && (
                <div className="alert-modern alert-error" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  <span className="alert-icon">⚠️</span>
                  {resetError}
                </div>
              )}
            </div>

            <div>
              <div className="stale-assets-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem' }}>Actifs nécessitant une mise à jour</h4>
                <span
                  className="rounded-full border px-2 py-0.5 text-xs"
                  style={{
                    borderColor: staleAssets.length > 0 ? 'rgba(251, 191, 36, 0.35)' : 'rgba(148, 163, 184, 0.25)',
                    background: 'rgba(255,255,255,0.04)',
                    color: staleAssets.length > 0 ? '#fbbf24' : '#cbd5e1',
                  }}
                >
                  {staleAssets.length}
                </span>
              </div>
              
              {staleLoading ? (
                <div className="loading-state" style={{ fontSize: '0.9rem' }}>⏳ Analyse en cours...</div>
              ) : staleAssetsError ? (
                <div className="alert-modern alert-error" style={{ fontSize: '0.9rem' }}>
                  <span className="alert-icon">⚠️</span>
                  {staleAssetsError}
                </div>
              ) : staleAssets.length === 0 ? (
                <div className="empty-state-sm" style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                  <p style={{ margin: 0 }}>Tous les actifs sont à jour !</p>
                </div>
              ) : (
                <ul className="stale-assets-list">
                  {staleAssets.map((asset) => (
                    <li key={asset.id} className="stale-asset-item">
                      <div className="stale-asset-info" style={{ fontSize: '0.9rem' }}>
                        <span className="stale-asset-symbol">{asset.symbol}</span>
                        <span className="stale-asset-name">{asset.name}</span>
                      </div>
                      <div className="stale-asset-meta" style={{ fontSize: '0.85rem' }}>
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
        </div>
      </div>
    </main>
  );
}
