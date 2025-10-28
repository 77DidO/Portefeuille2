import type { TransactionType } from '@portefeuille/types';

const isDividend = (source: string | null | undefined): boolean =>
  source?.toLowerCase() === 'dividend';

const isTaxRefund = (source: string | null | undefined): boolean =>
  source?.toLowerCase() === 'tax-refund';

export const getTransactionTypeLabel = (
  type: TransactionType | string,
  source?: string | null,
): string => {
  if (isDividend(source)) {
    return 'Dividende';
  }
  if (isTaxRefund(source)) {
    return 'Remb. fiscal';
  }
  if (type === 'BUY') {
    return 'Achat';
  }
  if (type === 'SELL') {
    return 'Vente';
  }
  return typeof type === 'string' ? type : '';
};

export const getTransactionTypeClass = (
  type: TransactionType | string,
  source?: string | null,
): string => {
  if (isDividend(source)) {
    return 'tx-chip--dividend';
  }
  if (isTaxRefund(source)) {
    return 'tx-chip--tax-refund';
  }
  if (type === 'BUY') {
    return 'tx-chip--buy';
  }
  if (type === 'SELL') {
    return 'tx-chip--sell';
  }
  return 'tx-chip--other';
};
