'use client';

import { useMemo } from 'react';

interface PaginationProps {
  total: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ total, pageSize, currentPage, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  
  const pages = useMemo(() => {
    const items: (number | '...')[] = [];
    if (totalPages <= 7) {
      // Si peu de pages, on les affiche toutes
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      // Sinon on affiche 1, 2, ..., currentPage-1, currentPage, currentPage+1, ..., totalPages
      items.push(1);
      if (currentPage > 3) items.push('...');
      
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentPage + 1, totalPages - 1); i++) {
        items.push(i);
      }
      
      if (currentPage < totalPages - 2) items.push('...');
      items.push(totalPages);
    }
    return items;
  }, [currentPage, totalPages]);

  return (
    <div className="pagination">
      <button
        className="pagination__btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Précédent
      </button>
      
      <div className="pagination__pages">
        {pages.map((page, index) => (
          <button
            key={`${page}-${index}`}
            className={`pagination__page ${page === currentPage ? 'pagination__page--active' : ''} ${
              page === '...' ? 'pagination__page--dots' : ''
            }`}
            onClick={() => (page !== '...' ? onPageChange(page) : undefined)}
            disabled={page === '...'}
          >
            {page}
          </button>
        ))}
      </div>
      
      <button
        className="pagination__btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Suivant
      </button>
    </div>
  );
}