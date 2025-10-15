import type {
  PortfolioSummary,
  PortfolioDetail,
  ImportRequestBody,
  AssetDetail,
  PortfolioCreateInput,
  PortfolioUpdateInput,
} from '@portefeuille/types';
import { API_URL } from './config';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Erreur API');
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

export const api = {
  getPortfolios: () => request<PortfolioSummary[]>('/portfolios'),
  getPortfolio: (id: number) => request<PortfolioDetail>(`/portfolios/${id}`),
  getAsset: (id: number) => request<AssetDetail>(`/assets/${id}`),
  importCsv: (payload: ImportRequestBody) =>
    request<{ imported: number; skipped?: number }>(`/import`, {
      method: 'POST' satisfies HttpMethod,
      body: JSON.stringify(payload),
    }),
  resetData: () => request<void>(`/system/data`, {
    method: 'DELETE' satisfies HttpMethod,
  }),
  createPortfolio: (payload: PortfolioCreateInput) =>
    request<PortfolioSummary>(`/portfolios`, {
      method: 'POST' satisfies HttpMethod,
      body: JSON.stringify(payload),
    }),
  updatePortfolio: (id: number, payload: PortfolioUpdateInput) =>
    request<PortfolioSummary>(`/portfolios/${id}`, {
      method: 'PUT' satisfies HttpMethod,
      body: JSON.stringify(payload),
    }),
  deletePortfolio: (id: number) =>
    request<void>(`/portfolios/${id}`, {
      method: 'DELETE' satisfies HttpMethod,
    }),
};

