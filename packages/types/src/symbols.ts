export const BASE_FIAT_SYMBOLS = ['EUR', 'USD', 'GBP'] as const;
export const STABLECOIN_SYMBOLS = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD'] as const;
export const CASH_SYMBOLS = ['PEA_CASH', '_PEA_CASH', 'CASH'] as const;

const BASE_FIAT_SET = new Set<string>(BASE_FIAT_SYMBOLS);
const STABLECOIN_SET = new Set<string>(STABLECOIN_SYMBOLS);
const CASH_SET = new Set<string>(CASH_SYMBOLS);

export const normalizeSymbol = (symbol: string | null | undefined): string =>
  symbol?.trim().toUpperCase() ?? '';

export const isFiatSymbol = (symbol: string | null | undefined): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }
  return BASE_FIAT_SET.has(normalized);
};

export const isStablecoinSymbol = (symbol: string | null | undefined): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }
  return STABLECOIN_SET.has(normalized);
};

export const isCashSymbol = (symbol: string | null | undefined): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }

  if (normalized.endsWith('_CASH')) {
    return true;
  }

  return CASH_SET.has(normalized) || isFiatSymbol(normalized);
};

export const isCashLikeSymbol = (symbol: string | null | undefined): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }
  return isCashSymbol(normalized) || isStablecoinSymbol(normalized);
};
