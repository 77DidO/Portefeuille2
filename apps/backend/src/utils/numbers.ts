import DecimalJs from 'decimal.js';

export const toNumber = (value: DecimalJs | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return new DecimalJs(value).toNumber();
};

export const roundCurrency = (value: number, precision = 2): number => {
  return Number(new DecimalJs(value).toDecimalPlaces(precision).toNumber());
};
