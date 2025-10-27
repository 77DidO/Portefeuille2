'use client';

import { type ReactNode } from 'react';

interface LoadingStateProps {
  isLoading: boolean;
  children: ReactNode;
  skeleton?: ReactNode;
  size?: 'small' | 'medium' | 'large';
  label?: string;
}

export function LoadingState({ 
  isLoading, 
  children, 
  skeleton, 
  size = 'medium',
  label = 'Chargement en cours...'
}: LoadingStateProps) {
  if (!isLoading) return <>{children}</>;
  
  if (skeleton) return <>{skeleton}</>;
  
  const dimensions = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  return (
    <div className="loading-state">
      <svg
        className={`loading-state__spinner ${dimensions[size]}`}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="loading-state__circle"
          cx="12"
          cy="12"
          r="10"
          fill="none"
          strokeWidth="3"
        />
      </svg>
      {label && <span className="loading-state__label">{label}</span>}
    </div>
  );
}