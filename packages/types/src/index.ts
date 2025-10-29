export * from './symbols.js';

export type PortfolioCategory = 'GLOBAL' | 'CRYPTO' | 'PEA' | 'OTHER';
export type AssetType = 'STOCK' | 'CRYPTO' | 'ETF' | 'FUND' | 'OTHER';
export type TransactionType = 'BUY' | 'SELL';

export interface PortfolioSummary {
  id: number;
  name: string;
  category: PortfolioCategory;
  color?: string | null;
  totalValue: number;
  investedValue: number;
  gainLossValue: number;
  gainLossPercentage: number;
  cashValue?: number;
  dividendsValue?: number;
  assets: AssetSummary[];
}

export interface AssetSummary {
  id: number;
  name: string;
  symbol: string;
  assetType: AssetType;
  latestPrice: number | null;
  lastPriceUpdateAt: string | null;
  quantity: number;
  marketValue: number;
  investedValue: number;
  gainLossValue: number;
  gainLossPercentage: number;
  trend?: TrendPoint[];
}

export interface AssetRefreshResult {
  assetId: number;
  price: number;
  priceDate: string;
  source: string;
  lastPriceUpdateAt: string;
}

export interface AssetRefreshFailure {
  assetId: number;
  message: string;
}

export interface RefreshAssetsResponse {
  refreshed: AssetRefreshResult[];
  failures: AssetRefreshFailure[];
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

export interface TransactionHistoryItem {
  id: number;
  assetId: number;
  assetName: string | null;
  assetSymbol: string | null;
  assetType: AssetType | null;
  portfolioId: number | null;
  portfolioName: string | null;
  portfolioCategory: PortfolioCategory | null;
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
  investedHistory: TrendPoint[]; // Capital total investi (versements)
  investedInAssetsHistory?: TrendPoint[]; // Coût d'achat des actifs (pour calcul +/- value)
  cashHistory?: TrendPoint[];
  dividendsHistory?: TrendPoint[];
}

export interface ImportRequestBody {
  portfolioId: number;
  source: 'credit-agricole' | 'binance' | 'coinbase';
  csv: string;
}

export interface PortfolioCreateInput {
  name: string;
  category: PortfolioCategory;
  color?: string;
}

export interface PortfolioUpdateInput {
  name?: string;
  category?: PortfolioCategory;
  color?: string;
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

export interface BackfillPriceHistoryResult {
  assetId: number;
  symbol: string;
  pointsInserted: number;
}

export interface BackfillPriceHistorySkip {
  assetId: number;
  symbol: string;
  reason: string;
}

export interface BackfillPriceHistoryError {
  assetId: number;
  symbol: string;
  message: string;
}

export interface BackfillPriceHistoryResponse {
  processed: BackfillPriceHistoryResult[];
  skipped: BackfillPriceHistorySkip[];
  errors: BackfillPriceHistoryError[];
}

export interface AssetStaleness {
  id: number;
  portfolioId: number;
  portfolioName: string;
  symbol: string;
  name: string;
  lastPriceUpdateAt: string | null;
  lastPricePointAt: string | null;
}
