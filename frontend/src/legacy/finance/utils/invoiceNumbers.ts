// @ts-nocheck
export function generateInvoiceNumber(prefix = 'INV') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${timestamp}-${randomSuffix}`;
}
