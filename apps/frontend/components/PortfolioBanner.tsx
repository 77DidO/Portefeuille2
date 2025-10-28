import type { PortfolioSummary } from '@portefeuille/types';
import { formatCurrency } from '@/lib/formatters';

interface PortfolioBannerProps {
  title: string;
  description?: string;
  portfolios: PortfolioSummary[];
  onSelect: (portfolioId: number) => void;
}

const defaultColors: Record<string, string> = {
  GLOBAL: '#4ade80',
  CRYPTO: '#fbbf24',
  PEA: '#60a5fa',
  OTHER: '#a78bfa',
};

const getPortfolioColor = (portfolio: PortfolioSummary): string => {
  return portfolio.color || defaultColors[portfolio.category] || '#a78bfa';
};

export function PortfolioBanner({ title, description, portfolios, onSelect }: PortfolioBannerProps) {
  if (portfolios.length === 0) {
    return null;
  }

  const totalValue = portfolios.reduce((acc, portfolio) => acc + portfolio.totalValue, 0);
  const investedValue = portfolios.reduce((acc, portfolio) => acc + portfolio.investedValue, 0);
  const gainLoss = totalValue - investedValue;
  const percent = investedValue !== 0 ? (gainLoss / investedValue) * 100 : 0;

  return (
    <section className='card banner'>
      <div className='banner__header'>
        <div>
          <h2>{title}</h2>
          {description && <p className='banner__description'>{description}</p>}
        </div>
        <div className={gainLoss >= 0 ? 'delta positive' : 'delta negative'}>
          {gainLoss >= 0 ? '+' : ''}
          {formatCurrency(gainLoss)} ({percent.toFixed(2)}%)
        </div>
      </div>
      <div className='banner__quick'>
        <div>
          <span className='banner__label'>Valeur totale</span>
          <span className='banner__value'>{formatCurrency(totalValue)}</span>
        </div>
        <div>
          <span className='banner__label'>Nombre de portefeuilles</span>
          <span className='banner__value'>{portfolios.length}</span>
        </div>
        <div className='banner__actions'>
          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              type='button'
              onClick={() => onSelect(portfolio.id)}
              className='banner__action'
              style={{
                borderLeft: `4px solid ${getPortfolioColor(portfolio)}`,
              }}
            >
              {portfolio.name}
              {portfolio.category === 'CRYPTO' && <span style={{ marginLeft: '0.5rem', color: '#fbbf24', fontSize: '0.85em' }}>🟡 Crypto</span>}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
