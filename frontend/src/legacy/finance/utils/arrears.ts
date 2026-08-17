// @ts-nocheck
export interface ArrearsInvoiceLike {
  id?: string | null;
  invoice_number?: string | null;
  amount_due?: number | string | null;
  amount_paid?: number | string | null;
  due_date?: string | null;
  invoice_date?: string | null;
  status?: string | null;
}

export function toMoney(value: number | string | null | undefined) {
  return Number(value || 0);
}

export function getInvoiceBalance(invoice: ArrearsInvoiceLike) {
  return Math.max(0, toMoney(invoice.amount_due) - toMoney(invoice.amount_paid));
}

export function getDerivedArrearsStatus(invoice: ArrearsInvoiceLike) {
  const balance = getInvoiceBalance(invoice);
  if (balance <= 0) return 'paid';

  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const paidAmount = toMoney(invoice.amount_paid);
  const isPastDue = dueDate ? dueDate.getTime() < Date.now() : false;

  if (isPastDue) return 'overdue';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function formatInvoiceDate(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}
