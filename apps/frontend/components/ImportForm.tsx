'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PortfolioSummary } from '@portefeuille/types';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

interface ImportFormProps {
  portfolios: PortfolioSummary[];
}

const filterVisiblePortfolios = (items: PortfolioSummary[]) =>
  items.filter((portfolio) => portfolio.category !== 'GLOBAL');

export const ImportForm = ({ portfolios }: ImportFormProps) => {
  const visiblePortfolios = filterVisiblePortfolios(portfolios);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [portfolioId, setPortfolioId] = useState<number>(visiblePortfolios[0]?.id ?? 0);
  const [source, setSource] = useState<'credit-agricole' | 'binance' | 'coinbase'>('credit-agricole');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visiblePortfolios.length === 0) {
      setPortfolioId(0);
      return;
    }
    setPortfolioId((current) => {
      const stillExists = visiblePortfolios.some((portfolio) => portfolio.id === current);
      return stillExists && current !== 0 ? current : visiblePortfolios[0].id;
    });
  }, [visiblePortfolios]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (visiblePortfolios.length === 0) {
      pushToast({
        message: "Aucun portefeuille disponible. Créez-en un avant d'importer.",
        variant: 'error',
      });
      return;
    }
    if (!csvFile) {
      pushToast({ message: 'Veuillez sélectionner un fichier CSV.', variant: 'error' });
      return;
    }
    try {
      setIsLoading(true);
      const text = await csvFile.text();
      const response = await api.importCsv({ portfolioId, source, csv: text });
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      const imported = response.imported ?? 0;
      const skipped = response.skipped ?? 0;
      const fragments = [`${imported} transaction${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}`];
      if (skipped > 0) {
        fragments.push(`${skipped} doublon${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''}`);
      }
      pushToast({ message: fragments.join(' - '), variant: 'success' });
      setCsvFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : "Erreur lors de l'import.",
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = visiblePortfolios.length === 0 || isLoading;

  return (
    <form className="import-form-compact" onSubmit={handleSubmit}>
      <div className="import-form-grid">
        <div className="form-field">
          <label className="form-label" htmlFor="portfolio-select">
            Portefeuille cible
          </label>
          <select
            id="portfolio-select"
            className="input"
            value={portfolioId}
            onChange={(event) => setPortfolioId(Number(event.target.value))}
            disabled={disabled}
          >
            {visiblePortfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="source-select">
            Source
          </label>
          <select
            id="source-select"
            className="input"
            value={source}
            onChange={(event) => setSource(event.target.value as 'credit-agricole' | 'binance' | 'coinbase')}
            disabled={disabled}
          >
            <option value="credit-agricole">Crédit Agricole (PEA)</option>
            <option value="binance">Binance (Crypto)</option>
            <option value="coinbase">Coinbase (Crypto)</option>
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="csv-input">
            Fichier CSV
          </label>
          <div className="file-input-wrapper">
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
              disabled={disabled}
              className="file-input-hidden"
            />
            <label htmlFor="csv-input" className="file-input-label">
              {csvFile ? csvFile.name : 'Choisir un fichier'}
            </label>
          </div>
        </div>

        <div className="form-field" style={{ alignSelf: 'flex-end' }}>
          <button className="primary" type="submit" disabled={disabled} style={{ width: '100%' }}>
            {isLoading ? 'Import en cours...' : 'Importer'}
          </button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
        Formats attendus : Crédit Agricole (Date, Libellé, Quantité, Prix unitaire, Sens) • Binance (Date(UTC), Pair, Side, Price, Amount) • Coinbase (Timestamp, Asset, Transaction Type, Quantity, Spot Price)
      </p>
    </form>
  );
};

