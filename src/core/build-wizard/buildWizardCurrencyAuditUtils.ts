export const parseCurrencyText = (value: string): number | null => {
  const cleaned = String(value || '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatCurrencyForInput = (value: number | null | undefined): string => {
  if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) {
    return '';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};

const CURRENCY_AUDIT_FIELDS = new Set([
  'estimated_cost',
  'actual_cost',
  'purchase_unit_price',
  'receipt_total',
  'receipt_amount',
  'hoa_fee_monthly',
]);

export const formatAuditValue = (
  value: unknown,
  fieldName: string | undefined,
  formatCurrency: (amount: number) => string,
): string => {
  if (value === null || typeof value === 'undefined') {
    return 'null';
  }
  const normalizedField = String(fieldName || '').trim().toLowerCase();
  if (normalizedField && CURRENCY_AUDIT_FIELDS.has(normalizedField)) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return formatCurrency(numericValue);
    }
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
};
