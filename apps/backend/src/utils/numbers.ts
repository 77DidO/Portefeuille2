import Decimal from 'decimal.js';

export const toNumber = (value: Decimal.Value | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (Decimal.isDecimal(value)) {
    return value.toNumber();
  }
  return new Decimal(value).toNumber();
};

export const roundCurrency = (value: number, precision = 2): number => {
  return Number(new Decimal(value).toDecimalPlaces(precision).toNumber());
};
