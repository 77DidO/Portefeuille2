'use client';

import { useState, useCallback, useMemo } from 'react';
import { type TransactionHistoryItem } from '@portefeuille/types';

interface UseHistoryFiltersReturn {
  filters: {
    search: string;
    portfolioId: number | null;
    category: string | null;
  };
  pagination: {
    currentPage: number;
    pageSize: number;
    total: number;
  };
  filteredItems: TransactionHistoryItem[];
  displayedItems: TransactionHistoryItem[];
  setSearch: (search: string) => void;
  setPortfolioId: (id: number | null) => void;
  setCategory: (category: string | null) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function useHistoryFilters(items: TransactionHistoryItem[]): UseHistoryFiltersReturn {
  // État des filtres
  const [search, setSearch] = useState('');
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  
  // État de la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Application des filtres
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = search === '' || 
        (item.assetName?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (item.assetSymbol?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (item.note?.toLowerCase() || '').includes(search.toLowerCase());
        
      const matchesPortfolio = !portfolioId || item.portfolioId === portfolioId;
      const matchesCategory = !category || item.portfolioCategory === category;
      
      return matchesSearch && matchesPortfolio && matchesCategory;
    });
  }, [items, search, portfolioId, category]);

  // Pagination des résultats filtrés
  const displayedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Reset de la pagination quand les filtres changent
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handlePortfolioId = useCallback((id: number | null) => {
    setPortfolioId(id);
    setCurrentPage(1);
  }, []);

  const handleCategory = useCallback((cat: string | null) => {
    setCategory(cat);
    setCurrentPage(1);
  }, []);

  return {
    filters: { search, portfolioId, category },
    pagination: {
      currentPage,
      pageSize,
      total: filteredItems.length,
    },
    filteredItems,
    displayedItems,
    setSearch: handleSearch,
    setPortfolioId: handlePortfolioId,
    setCategory: handleCategory,
    setCurrentPage,
    setPageSize,
  };
}