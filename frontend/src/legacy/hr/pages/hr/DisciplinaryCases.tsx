// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  MoreVertical,
  X,
  Printer,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { sanitizeError, ToastType } from '../../components/CustomToast';
import { activityLogger } from '../../utils/activityLogger';

interface DisciplinaryCase {
  id: string;
  employee_id: string;
  case_date: string;
  incident_type: string;
  description: string;
  verdict: string;
  action_taken: string;
  status: 'Pending' | 'Resolved' | 'Appealed';
  created_at: string;
  profiles?: { full_name: string; employee_no?: string | null; };
}

const STATUS_BADGE: Record<string, string> = {
  Resolved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
  Pending:  'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
  Appealed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
};

const DisciplinaryCases: React.FC = () => {
  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [formData, setFormData] = useState({
    employee_id: '',
    case_date: new Date().toISOString().split('T')[0],
    incident_type: 'Misconduct',
    description: '',
    verdict: '',
    action_taken: 'Warning Letter',
    status: 'Pending' as const,
  });

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: eData } = await supabase.from('profiles').select('id, full_name').order('full_name');
      if (eData) setEmployees(eData);
      await fetchCases();
    } catch (error) { console.error('Fetch error:', error); }
    setLoading(false);
  };

  const fetchCases = async () => {
    const { data, error } = await supabase
      .from('disciplinary_cases')
      .select('*, profiles(full_name)')
      .order('case_date', { ascending: false });
    if (!error && data) setCases(data);
    else setCases([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from('disciplinary_cases').insert([formData]);
      if (error) throw error;
      setToast({ message: 'Disciplinary case recorded successfully', type: 'success' });
      setShowModal(false);
      setFormData({ employee_id: '', case_date: new Date().toISOString().split('T')[0], incident_type: 'Misconduct', description: '', verdict: '', action_taken: 'Warning Letter', status: 'Pending' });
      await fetchCases();
      activityLogger.log({ actionType: 'create', actionCategory: 'hr', resourceType: 'disciplinary_case', resourceId: formData.employee_id, description: `Recorded ${formData.incident_type} case. Action: ${formData.action_taken}`, metadata: { ...formData } });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setSubmitting(false);
  };

  const filtered = cases.filter(c =>
    c.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.incident_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputCls = "w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <AlertTriangle className="mr-3 text-red-500" size={32} />
              Disciplinary Cases
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Manage staff conduct, warnings, and case resolutions.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => printWorkspacePage()} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2" title="Print disciplinary cases list">
              <Printer size={16} /> Print List
            </button>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 text-sm" title="Record new disciplinary case">
              <Plus size={16} /> Record Case
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Search & Filter</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Search employee..."
                  title="Search disciplinary cases"
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400 text-gray-900 dark:text-white"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="bg-red-500 rounded-xl p-5 text-white shadow-lg shadow-red-500/20">
              <AlertCircle size={24} className="mb-3 opacity-60" />
              <h4 className="text-sm font-bold mb-2">Policy Reminder</h4>
              <p className="text-xs opacity-80 leading-relaxed">
                Ensure all disciplinary actions follow the Employment Act procedures. Document all verbal warnings before formalizing cases.
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="lg:col-span-3 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Employee</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Incident</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Action Taken</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {loading ? (
                    <tr><td colSpan={6} className="py-16 text-center"><CustomLoader size={36} /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <CheckCircle2 className="mx-auto text-gray-200 dark:text-gray-700 mb-3" size={40} />
                        <p className="text-gray-400 font-medium">No disciplinary cases recorded.</p>
                      </td>
                    </tr>
                  ) : filtered.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 font-bold text-xs">
                            {item.profiles?.full_name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{item.profiles?.full_name}</p>
                            <p className="text-xs text-gray-400">{item.profiles?.employee_no || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">{item.incident_type}</td>
                      <td className="px-6 py-4 text-gray-500">{item.case_date}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded text-xs font-medium">{item.action_taken}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[item.status]}`}>{item.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white bg-white dark:bg-white/5 rounded-md shadow-sm border border-gray-200 dark:border-white/10" title="More options" aria-label="More options">
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

      {/* Record Case Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" /> Record Disciplinary Case
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" title="Close modal" aria-label="Close modal">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Target Employee *</label>
                  <select required className={inputCls} value={formData.employee_id} onChange={e => setFormData({ ...formData, employee_id: e.target.value })} title="Select target employee">
                    <option value="">— Select Employee —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Incident Date</label>
                  <input type="date" required className={inputCls} value={formData.case_date} onChange={e => setFormData({ ...formData, case_date: e.target.value })} title="Incident Date" />
                </div>
                <div>
                  <label className={labelCls}>Incident Category</label>
                  <select className={inputCls} value={formData.incident_type} onChange={e => setFormData({ ...formData, incident_type: e.target.value })} title="Select incident category">
                    <option>Misconduct</option><option>Absenteeism</option><option>Theft / Fraud</option>
                    <option>Negligence</option><option>Safety Violation</option><option>Insubordination</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Recommended Action</label>
                  <select className={inputCls} value={formData.action_taken} onChange={e => setFormData({ ...formData, action_taken: e.target.value })} title="Select recommended action">
                    <option>Verbal Warning</option><option>1st Warning Letter</option><option>2nd Warning Letter</option>
                    <option>Final Warning</option><option>Suspension</option><option>Termination</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Case Description / Evidence *</label>
                <textarea rows={4} required placeholder="Provide details about the incident..." title="Case details and evidence" className={inputCls + ' resize-none'} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors" title="Cancel recording">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center gap-2" title="Record disciplinary case">
                  {submitting ? <CustomLoader size={16} /> : null}
                  {submitting ? 'Saving...' : 'Record Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default DisciplinaryCases;
