// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { TrendingDown, Search, Printer, Wrench, AlertOctagon, DollarSign, Download } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import jsPDF from 'jspdf';

interface ExpenseItem {
  id: string;
  type: 'maintenance' | 'penalty';
  description: string;
  amount: number;
  date: string;
  property_name: string | null;
  unit_name: string | null;
}
const firstRelation = <T,>(value: T[] | T | null | undefined): T | null => (Array.isArray(value) ? value[0] || null : value || null);

const csvEscape = (value: string | number | null | undefined) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function ExpenseReport() {
  const { profile } = useAccess();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const [maintRes, penaltyRes] = await Promise.all([
        supabase
          .from('re_maintenance')
          .select('id, title, actual_cost, completion_date, created_at, property:re_properties(name), unit:re_units(unit_number)')
          .gt('actual_cost', 0),
        supabase
          .from('re_payments')
          .select('id, notes, amount, payment_date, unit:re_units(unit_number, property:re_properties(name))')
          .eq('payment_type', 'penalty'),
      ]);

      const maintItems: ExpenseItem[] = (maintRes.data || []).map((m: any) => ({
        id: m.id,
        type: 'maintenance' as const,
        description: m.title,
        amount: m.actual_cost || 0,
        date: m.completion_date || m.created_at,
        property_name: firstRelation(m.property)?.name || null,
        unit_name: firstRelation(m.unit)?.unit_number ? `Unit ${firstRelation(m.unit)?.unit_number}` : null,
      }));

      const penaltyItems: ExpenseItem[] = (penaltyRes.data || []).map((p: any) => ({
        id: p.id,
        type: 'penalty' as const,
        description: p.notes || 'Late payment penalty',
        amount: p.amount,
        date: p.payment_date,
        property_name: firstRelation(p.unit?.property)?.name || null,
        unit_name: firstRelation(p.unit)?.unit_number ? `Unit ${firstRelation(p.unit)?.unit_number}` : null,
      }));

      const all = [...maintItems, ...penaltyItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setExpenses(all);
    } catch (err: any) {
      setToast({ message: 'Failed to load expense data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) fetchExpenses(); }, [profile]);

  const filtered = expenses.filter(e => {
    const matchSearch =
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.property_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'all' || e.type === typeFilter;
    const date = new Date(e.date);
    const afterStart = !startDate || date >= new Date(startDate);
    const beforeEnd = !endDate || date <= new Date(endDate);
    return matchSearch && matchType && afterStart && beforeEnd;
  });

  const totalMaintenance = filtered.filter(e => e.type === 'maintenance').reduce((sum, e) => sum + e.amount, 0);
  const totalPenalties = filtered.filter(e => e.type === 'penalty').reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = totalMaintenance + totalPenalties;
  const statementMeta = {
    title: 'Hakika Real Estate',
    subtitle: 'Expense Report',
    description: 'Maintenance costs and penalty charges across your portfolio.',
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Hakika Real Estate', margin, y);
    y += 18;
    doc.setFontSize(14);
    doc.text('Expense Report', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Maintenance costs and penalty charges across your portfolio.', margin, y);
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: Ksh ${grandTotal.toLocaleString()}`, margin, y);
    y += 18;

    const headers = ['Type', 'Description', 'Property / Unit', 'Date', 'Amount'];
    const rows = filtered.map((row) => [
      row.type,
      row.description,
      [row.property_name, row.unit_name].filter(Boolean).join(' / ') || '-',
      new Date(row.date).toLocaleDateString(),
      `Ksh ${row.amount.toLocaleString()}`,
    ]);

    const colWidths = [75, 205, 145, 95, 95];
    const rowHeight = 18;
    const drawRow = (values: string[], isHeader = false) => {
      let x = margin;
      if (y + rowHeight > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        y = 40;
      }
      if (isHeader) {
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, y - 12, pageWidth - margin * 2, rowHeight, 'F');
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      values.forEach((value, index) => {
        doc.text(String(value), x + 4, y);
        x += colWidths[index];
      });
      y += rowHeight;
    };

    drawRow(headers, true);
    rows.forEach((row) => drawRow(row));

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: Ksh ${grandTotal.toLocaleString()}`, margin, y);
    doc.save(`expense-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportCsv = () => {
    const rows = [
      ['Type', 'Description', 'Property / Unit', 'Date', 'Amount'],
      ...filtered.map((row) => [
        row.type,
        row.description,
        [row.property_name, row.unit_name].filter(Boolean).join(' / ') || '-',
        new Date(row.date).toLocaleDateString(),
        row.amount,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 flex items-center text-3xl font-bold text-gray-900 dark:text-white">
              <TrendingDown className="mr-3 text-red-500" size={32} />
              Expense Report
            </h1>
            <p className="text-gray-500 dark:text-gray-400">{statementMeta.description}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} title="Export this expense report to CSV" className="px-4 py-2 bg-white dark:bg-white/10 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-white/15 transition-colors flex items-center gap-2">
              <Download size={18} /> CSV
            </button>
            <button onClick={exportPdf} title="Export this expense report to PDF" className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center gap-2">
              <Printer size={18} /> PDF
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400"><Wrench size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalMaintenance.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Maintenance Costs</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400"><AlertOctagon size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalPenalties.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Penalty Charges</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4 border-brand-purple/30">
            <div className="w-11 h-11 bg-brand-purple/10 rounded-xl flex items-center justify-center text-brand-purple"><DollarSign size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {grandTotal.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Grand Total</p></div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0f3548] p-5 text-white shadow-[0_24px_80px_-48px_rgba(0,0,0,0.3)]">
          <div className="mb-6 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6a00]/15 text-[#ffb07a]">
                    <TrendingDown size={22} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">{statementMeta.title}</p>
                    <h2 className="text-2xl font-black text-white">{statementMeta.subtitle}</h2>
                  </div>
                </div>
                <div className="max-w-3xl text-sm leading-6 text-slate-300">
                  Search and review expense lines by property, unit, date, and type. Export as CSV or PDF for filing.
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mb-6">
          <div className="relative sm:col-span-2">
            <label htmlFor="search-expenses" className="sr-only">Search expenses by description or property</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" id="search-expenses" placeholder="Search expense or property..." title="Search for expenses by description or property name" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" />
          </div>
          <div>
            <label htmlFor="type-filter" className="sr-only">Filter by expense type</label>
            <select id="type-filter" title="Filter expenses by type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple">
              <option value="all">All Types</option>
              <option value="maintenance">Maintenance</option>
              <option value="penalty">Penalty</option>
            </select>
          </div>
          <div>
            <label htmlFor="start-date-filter" className="sr-only">Filter by start date</label>
            <input type="date" id="start-date-filter" title="Filter expenses starting from this date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple" />
          </div>
        </div>

          {/* Table */}
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading expenses..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingDown size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Expenses Found</h3>
              <p className="text-gray-500 dark:text-gray-400">Completed maintenance with costs and penalties will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Description</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Property / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(e => (
                    <tr key={`${e.type}-${e.id}`} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border gap-1 ${
                          e.type === 'maintenance'
                            ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30'
                        }`}>
                          {e.type === 'maintenance' ? <Wrench size={10} /> : <AlertOctagon size={10} />}
                          {e.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-gray-200 max-w-xs truncate">{e.description}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          {e.property_name && <span className="text-sm text-gray-700 dark:text-gray-300">{e.property_name}</span>}
                          {e.unit_name && <span className="text-xs text-gray-500 dark:text-gray-400">{e.unit_name}</span>}
                          {!e.property_name && !e.unit_name && <span className="text-gray-400 italic text-sm">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">Ksh {e.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 font-bold text-gray-700 dark:text-gray-300">Grand Total ({filtered.length} items)</td>
                    <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400 text-base">Ksh {grandTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-300">Prepared By</h3>
              <div className="mt-3 text-sm text-slate-200">Hakika Real Estate Finance Desk</div>
              <div className="mt-2 text-sm text-slate-400">This report is system-generated and should be reviewed before filing.</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-300">Print Note</h3>
              <div className="mt-3 text-sm text-slate-200">Use the PDF export for a fixed-layout printable copy.</div>
            </div>
          </div>
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
