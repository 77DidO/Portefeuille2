const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});

export const formatCurrency = (value: number): string => currencyFormatter.format(value);

type QuantityFormatOptions = Pick<Intl.NumberFormatOptions, 'minimumFractionDigits' | 'maximumFractionDigits'>;

export const formatQuantity = (value: number, options: QuantityFormatOptions = {}): string => {
  const maximumFractionDigits =
    options.maximumFractionDigits ?? (Math.abs(value) < 1 ? 6 : 2);
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;

  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value);
};

export const formatPercent = (value: number, digits = 2): string => {
  const formatted = value.toFixed(digits);
  return `${value > 0 ? '+' : ''}${formatted}%`;
};
