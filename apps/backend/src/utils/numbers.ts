const hasToNumber = (value: unknown): value is { toNumber: () => number } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  );
};

const hasValueOf = (value: unknown): value is { valueOf: () => unknown } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { valueOf?: unknown }).valueOf === 'function'
  );
};

const hasToString = (value: unknown): value is { toString: () => string } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toString?: unknown }).toString === 'function'
  );
};

const toFinite = (value: number): number => {
  return Number.isFinite(value) ? value : 0;
};

export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return toFinite(value);
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (hasToNumber(value)) {
    const numeric = value.toNumber();
    return toFinite(numeric);
  }

  if (hasValueOf(value)) {
    const primitive = value.valueOf();
    if (typeof primitive === 'number') {
      return toFinite(primitive);
    }
    if (typeof primitive === 'string') {
      const parsed = Number.parseFloat(primitive);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  if (hasToString(value)) {
    const parsed = Number.parseFloat(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const roundCurrency = (value: number, precision = 2): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
