import type { Metadata } from 'next';
import { SettingsPageContent } from '@/components/SettingsPageContent';

export const metadata: Metadata = {
  title: 'Configuration | Portefeuille Multi-Sources',
  description: 'Administrez vos options et reinitialisez les donnees du portefeuille.',
};

export default function SettingsPage() {
  return <SettingsPageContent />;
}

