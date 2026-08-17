// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Shield,
  User,
  Calendar,
  Download,
  MoreVertical,
  Printer,
  Bell
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface DocumentExpiry {
  id: string;
  employee_id: string;
  document_type: string;
  document_number: string;
  expiry_date: string;
  status: 'Valid' | 'Expired' | 'Expiring Soon';
  profiles?: {
    full_name: string;
    employee_no?: string | null;
    department: string;
  };
}

const DocumentExpiry: React.FC = () => {
  const [docs, setDocs] = useState<DocumentExpiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, department, id_number, employee_no')
        .eq('is_active', true);

      if (data) {
        const mockDocs: DocumentExpiry[] = (data as Array<{ id: string; full_name: string; department: string; id_number: string | null; employee_no?: string | null }>).map((emp, index) => {
          const dates = ['2024-03-01', '2025-06-15', '2026-12-20', '2023-11-10', '2024-05-22'];
          const types = ['Police Clearance', 'ID Card', 'Guard License', 'NHIF Card', 'NSSF Card'];
          const expiryDate = dates[index % dates.length];
          const today = new Date();
          const expDate = new Date(expiryDate);
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          let status: DocumentExpiry['status'] = 'Valid';
          if (diffDays < 0) status = 'Expired';
          else if (diffDays < 30) status = 'Expiring Soon';

          return {
            id: `doc-${emp.id}`,
            employee_id: emp.id,
            document_type: types[index % types.length],
            document_number: emp.id_number || `DOC-${index + 1000}`,
            expiry_date: expiryDate,
            status,
            profiles: {
              full_name: emp.full_name,
              employee_no: emp.employee_no || null,
              department: emp.department
            }
          };
        });
        setDocs(mockDocs);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Valid':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30';
      case 'Expired':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30';
      case 'Expiring Soon':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30';
      default:
        return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const filteredDocs = docs.filter(d => {
    const matchesSearch =
      d.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.document_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: docs.length,
    expired: docs.filter(d => d.status === 'Expired').length,
    expiring: docs.filter(d => d.status === 'Expiring Soon').length,
    valid: docs.filter(d => d.status === 'Valid').length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Clock className="mr-3 text-brand-purple" size={32} />
              Document Expiry Tracker
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Automated compliance tracking for expiring staff documentation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => printWorkspacePage()}
              className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2"
              title="Print document expiry report"
            >
              <Printer size={16} /> Export Report
            </button>
            <button
              onClick={() => setToast({ message: 'Notices feature coming soon.', type: 'info' })}
              className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-brand-pink transition-colors shadow-lg shadow-brand-purple/20 flex items-center gap-2"
              title="Send expiry notification notices to staff"
            >
              <Bell size={16} /> Send Notices
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Tracked',  value: stats.total,    icon: User,         color: 'text-brand-purple bg-brand-purple/10' },
            { label: 'Expired Docs',   value: stats.expired,  icon: XCircle,      color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
            { label: 'Expiring Soon',  value: stats.expiring, icon: AlertCircle,  color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
            { label: 'Fully Valid',    value: stats.valid,    icon: CheckCircle2, color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-5"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by employee or document type..."
                title="Search compliance records"
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'Valid', 'Expiring Soon', 'Expired'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  title={`Filter by ${f} status`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap ${
                    statusFilter === f
                      ? 'bg-brand-purple text-white border-brand-purple shadow-sm shadow-brand-purple/20'
                      : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-brand-purple/40'
                  }`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Employee</th>
                  <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Document Type</th>
                  <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Ref / Serial No.</th>
                  <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Expiry Date</th>
                  <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <CustomLoader size={40} label="Loading compliance records..." />
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <Shield className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
                      <p className="text-gray-500 dark:text-gray-400 font-medium">No document records match your criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => (
                    <tr key={doc.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      {/* Employee */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-gray-500 dark:text-gray-400 uppercase shrink-0">
                            {doc.profiles?.full_name?.substring(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{doc.profiles?.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {doc.profiles?.employee_no} · {doc.profiles?.department}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Document Type */}
                      <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300">
                        {doc.document_type}
                      </td>
                      {/* Serial */}
                      <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {doc.document_number}
                      </td>
                      {/* Expiry Date */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="text-sm font-medium">
                            {new Date(doc.expiry_date).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                          </span>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${getStatusBadge(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="Download"
                            className="p-1.5 text-gray-400 hover:text-brand-purple transition-colors bg-white dark:bg-white/5 rounded-md shadow-sm border border-gray-200 dark:border-white/10"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            title="More Options"
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors bg-white dark:bg-white/5 rounded-md shadow-sm border border-gray-200 dark:border-white/10"
                          >
                            <MoreVertical size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!loading && filteredDocs.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 dark:border-white/10 text-xs text-gray-400">
              Showing {filteredDocs.length} of {docs.length} records
            </div>
          )}
        </div>
      </div>

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default DocumentExpiry;
