'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PortfolioSummary } from '@portefeuille/types';
import { api } from '@/lib/api';

interface ImportFormProps {
  portfolios: PortfolioSummary[];
}

const filterVisiblePortfolios = (items: PortfolioSummary[]) =>
  items.filter((portfolio) => portfolio.category !== 'GLOBAL');

export const ImportForm = ({ portfolios }: ImportFormProps) => {
  const visiblePortfolios = filterVisiblePortfolios(portfolios);
  const queryClient = useQueryClient();
  const [portfolioId, setPortfolioId] = useState<number>(visiblePortfolios[0]?.id ?? 0);
  const [source, setSource] = useState<'credit-agricole' | 'binance' | 'coinbase'>('credit-agricole');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
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
      setError('Aucun portefeuille disponible. Créez-en un avant d\'importer.');
      return;
    }
    if (!csvFile) {
      setError('Veuillez sélectionner un fichier CSV.');
      return;
    }
    try {
      setIsLoading(true);
      const text = await csvFile.text();
      const response = await api.importCsv({ portfolioId, source, csv: text });
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      const imported = response.imported ?? 0;
      const skipped = response.skipped ?? 0;
      const fragments = [`${imported} transaction${imported > 1 ? 's' : ''} importee${imported > 1 ? 's' : ''}`];
      if (skipped > 0) {
        fragments.push(`${skipped} doublon${skipped > 1 ? 's' : ''} ignore${skipped > 1 ? 's' : ''}`);
      }
      setStatus(fragments.join(' - '));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import.');
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = visiblePortfolios.length === 0 || isLoading;

  return (
    <form className="import-form" onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: '0.5rem', color: '#cbd5f5' }}>Import CSV</h3>
      <label style={{ fontSize: '0.85rem', color: '#94a3b8' }} htmlFor="portfolio-select">
        Portefeuille cible
      </label>
      <select
        id="portfolio-select"
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
      <label style={{ fontSize: '0.85rem', color: '#94a3b8' }} htmlFor="source-select">
        Source
      </label>
      <select id="source-select" value={source} onChange={(event) => setSource(event.target.value as any)} disabled={disabled}>
        <option value="credit-agricole">Crédit Agricole (PEA)</option>
        <option value="binance">Binance (Crypto)</option>
        <option value="coinbase">Coinbase (Crypto)</option>
      </select>
      <label style={{ fontSize: '0.85rem', color: '#94a3b8' }} htmlFor="csv-input">
        Fichier CSV
      </label>
      <input
        id="csv-input"
        type="file"
        accept=".csv"
        onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
        disabled={disabled}
      />
      <button className="primary" type="submit" disabled={disabled}>
        {isLoading ? 'Import en cours...' : 'Importer'}
      </button>
      {status && <div className="alert success">{status}</div>}
      {error && <div className="alert error">{error}</div>}
      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
        Formats attendus :
        <br />- Crédit Agricole : Date, Libellé, Quantité, Prix unitaire, Sens
        <br />- Binance : Date(UTC), Pair, Side, Price, Amount
        <br />- Coinbase : Timestamp, Asset, Transaction Type, Quantity, Spot Price
      </p>
    </form>
  );
};
