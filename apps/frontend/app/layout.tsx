import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export const metadata: Metadata = {
  title: 'Portefeuille Multi-Sources',
  description: 'Dashboard financier pour portefeuilles crypto et PEA',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </body>
    </html>
  );
}
