import Decimal from 'decimal.js';

type DecimalInput = Parameters<typeof Decimal>[0];
type DecimalInstance = ReturnType<typeof Decimal>;

const isDecimalInstance = (value: unknown): value is DecimalInstance => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DecimalInstance).toDecimalPlaces === 'function' &&
    typeof (value as DecimalInstance).toNumber === 'function'
  );
};

export const toNumber = (value: DecimalInput | DecimalInstance | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (isDecimalInstance(value)) {
    return value.toNumber();
  }
  return Decimal(value as DecimalInput).toNumber();
};

export const roundCurrency = (value: number, precision = 2): number => {
  return Number(Decimal(value).toDecimalPlaces(precision).toNumber());
};
