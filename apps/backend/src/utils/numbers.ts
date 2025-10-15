import { Decimal } from 'decimal.js';

type DecimalInput = Decimal | Decimal.Value | null | undefined;

export const toNumber = (value: DecimalInput): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return new Decimal(value).toNumber();
};

export const roundCurrency = (value: number, precision = 2): number => {
  return new Decimal(value).toDecimalPlaces(precision).toNumber();
};
