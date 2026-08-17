// @ts-nocheck
import React, { useState } from 'react';
import {
  BarChart3,
  Plus,
  DollarSign,
  Printer,
  Upload,
  X
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import CustomToast, { ToastType } from '../../components/CustomToast';
import AddableSelect from '../../components/AddableSelect';

interface StatutoryReturn {
  id: string;
  return_type: string;
  tax_period: string;
  amount: number;
  filed_at: string | null;
  acknowledgement_number: string;
  status: 'Pending' | 'Filed' | 'Overdue';
}

const MOCK_RETURNS: StatutoryReturn[] = [
  { id: '1', return_type: 'NSSF',         tax_period: '02/2026', amount: 45000,  filed_at: '2026-03-05', acknowledgement_number: 'NSSF-ACK-8821', status: 'Filed' },
  { id: '2', return_type: 'NHIF',         tax_period: '02/2026', amount: 32000,  filed_at: '2026-03-05', acknowledgement_number: 'NHIF-REC-9912', status: 'Filed' },
  { id: '3', return_type: 'PAYE',         tax_period: '02/2026', amount: 684000, filed_at: null,         acknowledgement_number: '',               status: 'Pending' },
  { id: '4', return_type: 'Housing Levy', tax_period: '02/2026', amount: 89000,  filed_at: null,         acknowledgement_number: '',               status: 'Overdue' },
];

const STATUS_BADGE: Record<string, string> = {
  Filed:   'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
  Pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
  Overdue: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
};

const StatutoryReturns: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [formData, setFormData] = useState({
    return_type: 'NSSF',
    tax_period: new Date().toISOString().slice(0, 7),
    amount: 0,
    acknowledgement_number: '',
    status: 'Pending' as const,
    filed_at: '',
  });

  const totalLiability = MOCK_RETURNS.filter(r => r.status !== 'Filed').reduce((s, r) => s + r.amount, 0);

  const inputCls = "w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <BarChart3 className="mr-3 text-brand-purple" size={32} />
              Statutory Returns
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Monitor and record monthly compliance returns for NSSF, NHIF, and PAYE.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => printWorkspacePage()} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2" title="Print audit report">
              <Printer size={16} /> Print Audit
            </button>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-xl font-medium hover:bg-brand-pink transition-colors shadow-lg shadow-brand-purple/20 text-sm" title="Record a new statutory filing">
              <Plus size={16} /> Record Filing
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main table */}
          <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Return Type</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Period</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Acknowledgement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {MOCK_RETURNS.map(ret => (
                    <tr key={ret.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-brand-purple/10 flex items-center justify-center text-brand-purple font-bold text-sm">
                            {ret.return_type[0]}
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">{ret.return_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{ret.tax_period}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">KES {ret.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[ret.status]}`}>{ret.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-gray-400">{ret.acknowledgement_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-gray-900 dark:bg-white/5 rounded-xl p-5 text-white shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-medium opacity-50 uppercase tracking-wider">Current Liability</p>
                <DollarSign size={18} className="text-brand-purple opacity-60" />
              </div>
              <p className="text-3xl font-bold">KES {totalLiability.toLocaleString()}</p>
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                <p className="text-xs text-gray-400 uppercase">Next Deadline</p>
                <p className="text-xs font-bold text-red-400">MAR 09, 2026</p>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl border border-dashed border-gray-300 dark:border-white/10 shadow-sm p-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400">
                <Upload size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Upload iTax Receipts</p>
                <p className="text-xs text-gray-500 mt-1">Batch process generated receipts to auto-update status.</p>
              </div>
              <button
                onClick={() => setToast({ message: 'Upload feature coming soon.', type: 'info' })}
                className="text-xs font-bold text-brand-purple hover:underline"
                title="Select iTax receipt files for upload"
              >
                Select Files
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Filing Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Record Statutory Filing</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" aria-label="Close modal" title="Close modal">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); setToast({ message: 'Return logged successfully', type: 'success' }); setShowModal(false); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <AddableSelect 
                  label="Return Type"
                  tableName="hr_statutory_types"
                  value={formData.return_type}
                  onChange={(val) => setFormData({...formData, return_type: val})}
                  required
                />
                <div>
                  <label htmlFor="stat-amount" className={labelCls}>Amount Paid (KES)</label>
                  <input id="stat-amount" type="number" required placeholder="0.00" title="Amount paid in KES" className={inputCls} value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label htmlFor="stat-ack" className={labelCls}>Acknowledgement / Receipt Number</label>
                <input id="stat-ack" type="text" required placeholder="e.g. PRN-2026-X8829" title="Acknowledgement or Receipt Number" className={inputCls + ' font-mono'} value={formData.acknowledgement_number} onChange={e => setFormData({ ...formData, acknowledgement_number: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors" title="Cancel filing record">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-brand-purple text-white text-sm font-bold rounded-lg hover:bg-brand-pink transition-colors shadow-lg shadow-brand-purple/20" title="Confirm and save statutory filing">Confirm Filing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default StatutoryReturns;
