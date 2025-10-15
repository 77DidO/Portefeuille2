'use client';

import type { PortfolioSummary } from '@portefeuille/types';
import { AssetAccordion } from './AssetAccordion';

interface PortfolioSectionProps {
  portfolio: PortfolioSummary;
}

export const PortfolioSection = ({ portfolio }: PortfolioSectionProps) => {
  return (
    <section className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h3>{portfolio.name}</h3>
          <span>
            Valeur :{' '}
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
              portfolio.totalValue,
            )}
          </span>
        </div>
        <div className="badge">
          {portfolio.gainLossValue >= 0 ? 'Gain' : 'Perte'} :{' '}
          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
            portfolio.gainLossValue,
          )}
        </div>
      </div>
      <AssetAccordion assets={portfolio.assets} />
    </section>
  );
};
