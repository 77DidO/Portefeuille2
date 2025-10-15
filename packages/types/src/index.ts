export type PortfolioCategory = 'GLOBAL' | 'CRYPTO' | 'PEA' | 'OTHER';
export type AssetType = 'STOCK' | 'CRYPTO' | 'ETF' | 'FUND' | 'OTHER';
export type TransactionType = 'BUY' | 'SELL';

export interface PortfolioSummary {
  id: number;
  name: string;
  category: PortfolioCategory;
  totalValue: number;
  investedValue: number;
  gainLossValue: number;
  gainLossPercentage: number;
  assets: AssetSummary[];
}

export interface AssetSummary {
  id: number;
  name: string;
  symbol: string;
  assetType: AssetType;
  latestPrice: number | null;
  quantity: number;
  marketValue: number;
  investedValue: number;
  gainLossValue: number;
  gainLossPercentage: number;
  trend?: TrendPoint[];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TransactionDTO {
  id: number;
  type: TransactionType;
  quantity: number;
  price: number;
  fee?: number | null;
  date: string;
  source?: string | null;
  note?: string | null;
}

export interface AssetDetail extends AssetSummary {
  transactions: TransactionDTO[];
  priceHistory: TrendPoint[];
}

export interface PortfolioDetail extends PortfolioSummary {
  priceHistory: TrendPoint[];
}

export interface ImportRequestBody {
  portfolioId: number;
  source: 'credit-agricole' | 'binance' | 'coinbase';
  csv: string;
}

export interface PortfolioCreateInput {
  name: string;
  category: PortfolioCategory;
}

export interface PortfolioUpdateInput {
  name?: string;
  category?: PortfolioCategory;
}

export interface AssetCreateInput {
  portfolioId: number;
  symbol: string;
  name: string;
  assetType: AssetType;
}

export interface TransactionCreateInput {
  assetId: number;
  type: TransactionType;
  quantity: number;
  price: number;
  fee?: number | null;
  date: string;
  source?: string | null;
  note?: string | null;
}

export interface PricePointDTO {
  id: number;
  assetId: number;
  price: number;
  date: string;
  source?: string | null;
}
