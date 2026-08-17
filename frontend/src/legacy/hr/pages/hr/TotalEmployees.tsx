// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Download, UserPlus, Edit, Trash2, Eye, Mail, Upload, UserX, UserCheck, Printer, Plus } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import Toast from '../../components/Toast';
import { cache } from '../../utils/cache';
import { Skeleton } from '../../components/Skeleton';
import BulkImportModal from '../../components/BulkImportModal';
import { useAccess } from '../../context/AccessContext';
import { extractEdgeFunctionErrorMessage } from '../../utils/edgeFunctionError';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';

interface Employee {
  id: string;
  employee_no?: string | null;
  full_name: string;
  email: string;
  phone?: string;
  phone_number?: string | null;
  department?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  id_number?: string | null;
  marital_status?: string | null;
  salary?: number;
  role?: string;
  created_at: string;
  company_id?: string | null;
  company_code?: string | null;
  module?: string | null;
  employment_type?: string | null;
  employment_start_date?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  account_number?: string | null;
}

const TotalEmployees: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: userRole, profile } = useAccess();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('all');
  const [resendModal, setResendModal] = useState<{ show: boolean; employee: Employee | null }>({ show: false, employee: null });
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; employee: Employee | null }>({ show: false, employee: null });
  const [deactivateModal, setDeactivateModal] = useState<{ show: boolean; employee: Employee | null }>({ show: false, employee: null });
  const [viewModal, setViewModal] = useState<{ show: boolean; employee: Employee | null }>({ show: false, employee: null });
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  useEffect(() => {
    const cached = cache.get<Employee[]>('employees_list');
    if (cached) {
      setEmployees(cached);
      setLoading(false);
    }
    fetchEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [searchTerm, departmentFilter, employmentTypeFilter, employees]);

  const fetchEmployees = async () => {
    try {
      const selectAttempts = [
        'id, employee_no, full_name, email, phone, phone_number, salary, role, company_id, company_code, module, department, created_at',
        'id, full_name, email, phone, phone_number, role, company_id, company_code, module, department, created_at',
        '*',
      ] as const;

      let data: Employee[] | null = null;
      let lastError: any = null;
      
      const userRoleLower = (userRole || '').toLowerCase();
      const isElevated = ['super admin', 'director', 'director / super admin'].includes(userRoleLower);
      
      const scopeFilters = isElevated 
        ? [] 
        : profile?.company_id
          ? [{ kind: 'company_id' as const, value: profile.company_id }]
          : profile?.company_code
            ? [{ kind: 'company_code' as const, value: profile.company_code }]
            : [];
            
      const filterSets = scopeFilters.length > 0 ? scopeFilters : [{ kind: 'none' as const, value: null }];

      for (const fields of selectAttempts) {
        for (const filter of filterSets) {
          let query = supabase
            .schema('hr')
            .from('employees')
            .select('id, employee_no:employee_number, full_name:display_name, email, phone, employment_type, employment_start_date, company_id, role:employment_status, created_at')
            .order('created_at', { ascending: false });

          if (filter.kind === 'company_id') {
            query = query.eq('company_id', filter.value);
          } else if (filter.kind === 'company_code') {
            query = query.eq('company_code', filter.value);
          }

          const result = await query;
          data = result.data as Employee[] | null;
          lastError = result.error;
          if (!result.error && (result.data?.length ?? 0) > 0) {
            break;
          }
        }

        if (!lastError && (data?.length ?? 0) > 0) break;
      }

      if (lastError) throw lastError;
      if ((!data || data.length === 0) && profile?.company_id) {
        const fallback = await supabase
          .schema('hr')
          .from('employees')
          .select('id, employee_no:employee_number, full_name:display_name, email, phone, employment_type, employment_start_date, company_id, role:employment_status, created_at')
          .order('created_at', { ascending: false });

        if (!fallback.error) {
          data = fallback.data as Employee[] | null;
        }
      }

      setEmployees(data || []);
      cache.set('employees_list', data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = [...employees];

    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employee_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter(emp => (emp.module || emp.company_code || emp.role || '').toLowerCase().includes(departmentFilter.toLowerCase()));
    }

    if (employmentTypeFilter !== 'all') {
      filtered = filtered.filter(emp => (emp.employment_type || emp.role || '').toLowerCase().includes(employmentTypeFilter.toLowerCase()));
    }

    setFilteredEmployees(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Employee No', 'Name', 'Email', 'Phone', 'Scope', 'Designation', 'Role', 'Type', 'Start Date'];
    const rows = filteredEmployees.map(emp => [
      emp.employee_no,
      emp.full_name,
      emp.email,
      emp.phone,
      emp.module || emp.company_code || 'N/A',
      'N/A',
      emp.role || 'N/A',
      emp.role || 'N/A',
      emp.created_at
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleResendCredentials = async () => {
    if (!resendModal.employee) return;
    
    setSending(true);
    try {
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const phoneNumber = resendModal.employee.phone_number || resendModal.employee.phone;

      const data = await invokeEdgeFunction('reset-password', {
        userId: resendModal.employee.id,
        email: resendModal.employee.email,
        fullName: resendModal.employee.full_name,
        phoneNumber,
        newPassword: tempPassword,
        sendEmail: true,
        sendSms: true,
        module: 'hr'
      }, {
        accessToken: session.access_token
      });
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to resend credentials.');
      }

      const channelSummary = [
        data?.emailSent ? 'email' : null,
        data?.smsSent ? 'sms' : null
      ].filter(Boolean).join(' and ');

      if (!data?.smsSent && data?.emailSent) {
        const warningText = Array.isArray(data?.warnings) && data.warnings.length > 0
          ? `SMS failed: ${data.warnings.join(' | ')}`
          : 'SMS failed to send.';
        setToast({
          message: `Email sent to ${resendModal.employee.full_name}. ${warningText}`,
          type: 'warning'
        });
      } else {
        setToast({ 
          message: channelSummary 
            ? `Credentials sent via ${channelSummary} to ${resendModal.employee.full_name}`
            : `Credentials updated for ${resendModal.employee.full_name}`, 
          type: 'success' 
        });
      }
      setResendModal({ show: false, employee: null });
    } catch (error) {
      console.error('Error resending credentials:', error);
      const message = extractEdgeFunctionErrorMessage(error, 'Failed to resend credentials. Please try again.');
      setToast({ message, type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteModal.employee) return;
    
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const data = await invokeEdgeFunction('delete-user', { userId: deleteModal.employee.id }, {
        accessToken: session.access_token
      });
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to delete employee account.');
      }
      
      setToast({ message: `Employee ${deleteModal.employee.full_name} and their account deleted successfully`, type: 'success' });
      setDeleteModal({ show: false, employee: null });
      await fetchEmployees();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      const message = extractEdgeFunctionErrorMessage(error, 'Failed to delete employee. Please try again.');
      setToast({ message, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const departments = ['HR', 'Finance', 'Security', 'Real Estate', 'Property Management', 'Administration', 'IT', 'Operations'];
  const employmentTypes = ['Permanent', 'Casual', 'Consultant'];
  const panelCls = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface';
  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-brand-purple/30 dark:border-white/10 dark:bg-black/20 dark:text-white';
  const subtleButtonCls = 'px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2';
  const modalCls = 'bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg p-6';

  // No longer blocking with full page loader if we have cache

  return (
    <div className="hr-employees-page p-6 space-y-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="hr-employees-header flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {(location.pathname.includes('real-estate') || location.pathname.includes('security')) ? 'Workforce Hub' : 'Total Employees'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{filteredEmployees.length} employees found</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => printWorkspacePage()}
            className={subtleButtonCls}
            title="Print List"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            title="Upload employee data from CSV/Excel"
            className={`${subtleButtonCls} text-brand-purple dark:text-brand-purple hover:bg-brand-purple/10`}
          >
            <Upload size={16} />
            Bulk Import
          </button>
          <button
            onClick={() => navigate('/app/hr/add-employee')}
            title="Open form to add a new employee"
            className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20"
          >
            <Plus size={16} />
            Add Employee
          </button>
        </div>
      </div>

      <div className={`${panelCls} hr-employees-controls p-4`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              id="emp-search"
              type="text"
              placeholder="Search employees..."
              title="Search employees by name, number, or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-10`}
            />
          </div>

          <select
            id="dept-filter"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            title="Filter employees by department"
            className={inputCls}
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            id="type-filter"
            value={employmentTypeFilter}
            onChange={(e) => setEmploymentTypeFilter(e.target.value)}
            title="Filter employees by employment type"
            className={inputCls}
          >
            <option value="all">All Types</option>
            {employmentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <button
            onClick={exportToCSV}
            title="Download current list as CSV"
            className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-center gap-2 text-gray-700 dark:text-gray-200"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className={`${panelCls} hr-employees-table-panel`}>
        <div className="overflow-x-auto pb-2" style={{ scrollbarGutter: 'stable both-edges' }}>
          <table className="w-full min-w-[980px]">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Designation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {loading && employees.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2"><Skeleton className="h-6 w-6 rounded" /><Skeleton className="h-6 w-6 rounded" /></td>
                  </tr>
                ))
              ) : filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {employee.employee_no || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    <div className="min-w-[220px]">
                      <div className="font-medium text-gray-900 dark:text-white">{employee.full_name}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {employee.email || 'No email'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {employee.phone_number || employee.phone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {employee.department || employee.module || employee.company_code || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {employee.role || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {employee.role || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      employee.employment_type === 'Permanent' ? 'bg-green-100 text-green-800' :
                      employee.employment_type === 'Casual' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {employee.employment_type || 'Staff'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {employee.employment_start_date ? new Date(employee.employment_start_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setResendModal({ show: true, employee })}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                        title="Resend Credentials"
                      >
                        <Mail className="w-4 h-4 text-brand-purple" />
                      </button>
                      <button 
                        onClick={() => navigate(`/app/hr/edit-employee/${employee.id}`)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        View
                      </button>
                      <button 
                        onClick={() => navigate(`/app/hr/edit-employee/${employee.id}`)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 transition-colors"
                        title="Edit Employee"
                      >
                        <Edit className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        Edit
                      </button>
                      <button 
                        onClick={() => setViewModal({ show: true, employee })}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                        title="View employee"
                      >
                        <UserCheck className="w-4 h-4 text-green-600" />
                      </button>
                      {['Super Admin', 'Director', 'Director / Super Admin'].includes(userRole || '') && (
                        <button 
                          onClick={() => setDeleteModal({ show: true, employee })}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No employees found</p>
          </div>
        )}
      </div>

      {/* View Employee Modal */}
      {viewModal.show && viewModal.employee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${modalCls} max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Employee Details</h3>
              <button onClick={() => setViewModal({ show: false, employee: null })} className="text-gray-400 hover:text-gray-600 text-2xl" title="Close details view" aria-label="Close">
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-sm text-gray-600 dark:text-gray-400">Employee No:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.employee_no || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Full Name:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.full_name}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Email:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.email}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Phone:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.phone_number || viewModal.employee.phone || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Date of Birth:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.date_of_birth || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Gender:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.gender || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">ID Number:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.id_number || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Marital Status:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.marital_status || 'N/A'}</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Employment Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Scope:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.module || viewModal.employee.company_code || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Designation:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.role || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Role:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.role || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Employment Type:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.employment_type || 'N/A'}</span></div>
                  <div><span className="text-sm text-gray-600 dark:text-gray-400">Start Date:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.employment_start_date ? new Date(viewModal.employee.employment_start_date).toLocaleDateString() : 'N/A'}</span></div>
                  {viewModal.employee.salary && <div><span className="text-sm text-gray-600 dark:text-gray-400">Salary:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">KES {viewModal.employee.salary.toLocaleString()}</span></div>}
                </div>
              </div>

              {(viewModal.employee.bank_name || viewModal.employee.account_number) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Bank Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {viewModal.employee.bank_name && <div><span className="text-sm text-gray-600 dark:text-gray-400">Bank:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.bank_name}</span></div>}
                    {viewModal.employee.bank_branch && <div><span className="text-sm text-gray-600 dark:text-gray-400">Branch:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.bank_branch}</span></div>}
                    {viewModal.employee.account_number && <div><span className="text-sm text-gray-600 dark:text-gray-400">Account Number:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewModal.employee.account_number}</span></div>}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setViewModal({ show: false, employee: null });
                  navigate(`/app/hr/edit-employee/${viewModal.employee?.id}`);

                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                
              >
                <Edit className="w-4 h-4" />
                Edit Employee
              </button>
              <button
                onClick={() => setViewModal({ show: false, employee: null })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${modalCls} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-semibold text-amber-600 mb-4">Archive Employee</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to archive <strong>{deleteModal.employee?.full_name}</strong>? 
              Their record will be moved to the <strong>Past Employees</strong> directory and their login account will be deactivated.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ show: false, employee: null })}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                title="Cancel and close"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                disabled={deleting}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                title="Confirm archiving"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Archive Employee
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resend Credentials Modal */}
      {resendModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${modalCls} max-w-md w-full mx-4`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resend Credentials</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This will send new login credentials to <strong>{resendModal.employee?.full_name}</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setResendModal({ show: false, employee: null })}
                disabled={sending}
                className="px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                title="Cancel and close"
              >
                Cancel
              </button>
              <button
                onClick={handleResendCredentials}
                disabled={sending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                title="Confirm resend"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Resend
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={async () => {
            setToast({ message: 'Employees imported successfully', type: 'success' });
            await fetchEmployees();
          }}
        />
      )}
    </div>
  );
};

export default TotalEmployees;
