'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PortfolioSummary, PortfolioDetail } from '@portefeuille/types';
import { api } from '@/lib/api';

export const usePortfolioData = () => {
  const queryClient = useQueryClient();

  const portfoliosQuery = useQuery({
    queryKey: ['portfolios'],
    queryFn: api.getPortfolios,
    staleTime: 60_000,
    select: (data: PortfolioSummary[]) => ({
      all: data,
      active: data.filter(p => p.assets.length > 0),
      byCategory: data.reduce((acc, p) => {
        if (!acc[p.category]) acc[p.category] = [];
        acc[p.category].push(p);
        return acc;
      }, {} as Record<string, PortfolioSummary[]>)
    })
  });

  const getPortfolioQuery = (id: number) => useQuery({
    queryKey: ['portfolio', id],
    queryFn: () => api.getPortfolio(id),
    staleTime: 30_000,
    enabled: !!id
  });

  const prefetchPortfolio = async (id: number) => {
    await queryClient.prefetchQuery({
      queryKey: ['portfolio', id],
      queryFn: () => api.getPortfolio(id)
    });
  };

  const invalidatePortfolios = () => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['portfolios'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    ]);
  };

  return {
    portfoliosQuery,
    getPortfolioQuery,
    prefetchPortfolio,
    invalidatePortfolios,
    isLoading: portfoliosQuery.isLoading,
    error: portfoliosQuery.error
  };
};