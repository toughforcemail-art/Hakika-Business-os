// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Printer,
  DollarSign,
  X
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { sanitizeError, ToastType } from '../../components/CustomToast';
import AddableSelect from '../../components/AddableSelect';

interface ExpenseReport {
  id: string;
  employee_id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  profiles?: { full_name: string; employee_no?: string | null; department: string; };
}

const MOCK_REPORTS: ExpenseReport[] = [
  { id: '1', employee_id: 'e1', category: 'Travel',   amount: 4500, description: 'Fuel for site visit',   expense_date: '2026-03-10', status: 'Approved', profiles: { full_name: 'John Kamau',    employee_no: 'EMP001', department: 'Real Estate' } },
  { id: '2', employee_id: 'e2', category: 'Meals',    amount: 1200, description: 'Client lunch meeting',  expense_date: '2026-03-12', status: 'Pending',  profiles: { full_name: 'Sarah Ochieng', employee_no: 'EMP042', department: 'HR' } },
  { id: '3', employee_id: 'e1', category: 'Supplies', amount: 850,  description: 'Office stationery',     expense_date: '2026-03-14', status: 'Rejected', profiles: { full_name: 'John Kamau',    employee_no: 'EMP001', department: 'Real Estate' } },
];

const STATUS_BADGE: Record<string, string> = {
  Approved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
  Pending:  'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
  Rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
};

const ExpenseReports: React.FC = () => {
  const [reports] = useState<ExpenseReport[]>(MOCK_REPORTS);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [formData, setFormData] = useState({ employee_id: '', category: 'Travel', amount: 0, description: '', expense_date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name')
      .then(({ data }) => { if (data) setEmployees(data); });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToast({ message: 'Expense report submitted successfully', type: 'success' });
    setShowModal(false);
  };

  const filtered = reports.filter(r =>
    r.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalApproved = reports.filter(r => r.status === 'Approved').reduce((s, r) => s + r.amount, 0);
  const totalPending  = reports.filter(r => r.status === 'Pending').reduce((s, r) => s + r.amount, 0);

  const inputCls = "w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Receipt className="mr-3 text-brand-purple" size={32} />
              Expense Reports
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Track and process employee reimbursement requests.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => printWorkspacePage()} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2" title="Print expense reports">
              <Printer size={16} /> Print
            </button>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-xl font-medium hover:bg-brand-pink transition-colors shadow-lg shadow-brand-purple/20 text-sm" title="Submit new expense request">
              <Plus size={16} /> New Request
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Summary (MTD)</p>
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">KES {totalApproved.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">Total Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">KES {totalPending.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">Total Pending</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search staff or category..."
                title="Search expense reports"
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="lg:col-span-3 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Staff Member</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Category</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 text-right font-medium text-gray-500 dark:text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {filtered.map(rep => (
                    <tr key={rep.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple font-bold text-xs">
                            {rep.profiles?.full_name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{rep.profiles?.full_name}</p>
                            <p className="text-xs text-gray-400">{rep.profiles?.employee_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{rep.category}</td>
                      <td className="px-6 py-4 text-gray-500">{rep.expense_date}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">KES {rep.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[rep.status]}`}>{rep.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white bg-white dark:bg-white/5 rounded-md shadow-sm border border-gray-200 dark:border-white/10"
                          title="More options"
                          aria-label="More options"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Submit Expense Request</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" title="Close modal" aria-label="Close modal">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="employee_select" className={labelCls}>Select Staff</label>
                <select id="employee_select" title="Select Staff" required className={inputCls} value={formData.employee_id} onChange={e => setFormData({ ...formData, employee_id: e.target.value })}>
                  <option value="">— Choose Employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AddableSelect 
                  label="Category"
                  tableName="hr_expense_categories"
                  value={formData.category}
                  onChange={(val) => setFormData({...formData, category: val})}
                  required
                />
                <div>
                  <label htmlFor="amount_input" className={labelCls}>Amount (KES)</label>
                  <input id="amount_input" type="number" required placeholder="0.00" title="Amount in KES" className={inputCls} value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label htmlFor="description_textarea" className={labelCls}>Description</label>
                <textarea id="description_textarea" required rows={3} placeholder="Brief description of the expense..." title="Expense description" className={inputCls + ' resize-none'} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-brand-purple text-white text-sm font-bold rounded-lg hover:bg-brand-pink transition-colors shadow-lg shadow-brand-purple/20" title="Submit expense request">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ExpenseReports;
