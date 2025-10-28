'use client';

import { ReactNode } from 'react';

interface DashboardLayoutProps {
  portfoliosList: ReactNode;
  overview: ReactNode;
  detail: ReactNode;
}

export const DashboardLayout = ({ portfoliosList, overview, detail }: DashboardLayoutProps) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '360px minmax(0, 1fr)',
        gap: '1.5rem',
        width: '100%',
        alignItems: 'start',
      }}
    >
      {/* Colonne gauche: Liste des portefeuilles */}
      <div>{portfoliosList}</div>

      {/* Colonne droite: Vue d'ensemble + Détail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {overview}
        {detail}
      </div>
    </div>
  );
};
