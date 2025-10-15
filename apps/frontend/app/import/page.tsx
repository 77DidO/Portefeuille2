import type { Metadata } from 'next';
import { ImportPageContent } from '@/components/ImportPageContent';

export const metadata: Metadata = {
  title: 'Imports CSV | Portefeuille Multi-Sources',
  description: 'Importez vos fichiers CSV Crédit Agricole, Binance et Coinbase pour enrichir vos portefeuilles.',
};

export default function ImportPage() {
  return <ImportPageContent />;
}
