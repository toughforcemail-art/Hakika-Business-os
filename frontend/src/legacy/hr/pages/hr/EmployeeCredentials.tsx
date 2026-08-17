// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, RefreshCw, Copy, Check, Users, Home, Building2, KeyRound, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { extractEdgeFunctionErrorMessage } from '../../utils/edgeFunctionError';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';

const EmployeeCredentials: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [landlords, setLandlords] = useState<any[]>([]);
  const [caretakers, setCaretakers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'employees' | 'tenants' | 'landlords' | 'caretakers'>('employees');
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [employeesRes, tenantsRes, landlordsRes] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('id, full_name, username, email, phone, phone_number, role, employee_no, company_code, module, credentials_sent_at')
          .not('role', 'in', '(tenant,landlord)')
          .not('full_name', 'is', null)
          .order('created_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name, email, phone, login_username, login_sent_at, login_active, tenant_no').order('id', { ascending: false }),
        supabase.from('re_personnel').select('id, full_name, email, phone, login_username, login_sent_at, login_active, role, property:re_properties(name)').eq('role', 'landlord').order('created_at', { ascending: false }),
      ]);

      if (employeesRes.status === 'fulfilled') {
        const { data, error } = employeesRes.value;
        if (error) setError((prev) => prev || `Employees: ${error.message}`);
        setEmployees(data || []);
      }
      if (tenantsRes.status === 'fulfilled') {
        const { data, error } = tenantsRes.value;
        if (error) setError((prev) => prev || `Tenants: ${error.message}`);
        setTenants(data || []);
      }
      if (landlordsRes.status === 'fulfilled') {
        const { data, error } = landlordsRes.value;
        if (error) setError((prev) => prev || `Landlords: ${error.message}`);
        setLandlords(data || []);
      }

      const caretakersRes = await supabase
        .from('re_personnel')
        .select('id, full_name, email, phone, login_username, login_sent_at, login_active, role, property:re_properties(name)')
        .eq('role', 'caretaker')
        .is('deleted_at', null)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (caretakersRes.error) {
        setError((prev) => prev || `Caretakers: ${caretakersRes.error.message}`);
      } else {
        setCaretakers(caretakersRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
      setError('Failed to load credentials hub.');
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
  };

  const resetPassword = async (employee: any) => {
    setResetting(employee.id);
    try {
      const newPassword = generatePassword();
      const username = employee.username || employee.email?.split('@')[0] || employee.full_name?.toLowerCase().replace(/\s+/g, '.') || 'user';
      const phoneNumber = employee.phone_number || employee.phone;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const data = await invokeEdgeFunction('reset-password', {
        userId: employee.id,
        email: employee.email,
        fullName: employee.full_name,
        phoneNumber,
        newPassword,
        sendEmail: true,
        sendSms: true,
        module: 'hr'
      }, {
        accessToken: session.access_token
      });
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reset credentials.');
      }

      const channelSummary = [
        data?.emailSent ? 'email' : null,
        data?.smsSent ? 'sms' : null
      ].filter(Boolean).join(' and ');

      if (!data?.smsSent && data?.emailSent) {
        const warningText = Array.isArray(data?.warnings) && data.warnings.length > 0
          ? `SMS failed: ${data.warnings.join(' | ')}`
          : 'SMS failed to send.';
        alert(
          `Password reset successful!\nUsername: ${username}\nNew Password: ${newPassword}\n\n` +
          `Email sent.\n${warningText}`
        );
      } else {
        alert(
          `Password reset successful!\nUsername: ${username}\nNew Password: ${newPassword}\n\n` +
          (channelSummary ? `Credentials sent via ${channelSummary}.` : 'Credentials updated.')
        );
      }
    } catch (error: any) {
      const message = extractEdgeFunctionErrorMessage(error, error.message || 'Failed to reset credentials.');
      alert('Error resetting password: ' + message);
    } finally {
      setResetting(null);
    }
  };

  const resendCredentials = async (employee: any) => {
    setResetting(employee.id);
    try {
      const newPassword = generatePassword();
      const username = employee.username || employee.email?.split('@')[0] || employee.full_name?.toLowerCase().replace(/\s+/g, '.') || 'user';
      const phoneNumber = employee.phone_number || employee.phone;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const data = await invokeEdgeFunction('reset-password', {
        userId: employee.id,
        email: employee.email,
        fullName: employee.full_name,
        phoneNumber,
        newPassword,
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

      alert(
        `Credentials resent successfully!\nUsername: ${username}\nNew Password: ${newPassword}\n\n` +
        (channelSummary ? `Credentials sent via ${channelSummary}.` : 'Credentials updated.')
      );
      await fetchAll();
    } catch (error: any) {
      const message = extractEdgeFunctionErrorMessage(error, error.message || 'Failed to resend credentials.');
      alert('Error resending credentials: ' + message);
    } finally {
      setResetting(null);
    }
  };

  const resetTenantLogin = async (tenant: any, resend = false) => {
    setResetting(tenant.id);
    try {
      await invokeEdgeFunction('admin-create-tenant-login', {
        tenant_id: tenant.id,
        ...(resend ? { resend: true } : { reset: true }),
      });
      await fetchAll();
    } catch (error: any) {
      alert('Error updating tenant login: ' + (error?.message || 'Unknown error'));
    } finally {
      setResetting(null);
    }
  };

  const resetCaretakerLogin = async (caretaker: any) => {
    setResetting(caretaker.id);
    try {
      const newPassword = generatePassword();
      const username = caretaker.login_username || caretaker.email?.split('@')[0] || caretaker.full_name?.toLowerCase().replace(/\s+/g, '.') || 'user';
      const phoneNumber = caretaker.phone;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const data = await invokeEdgeFunction('reset-password', {
        userId: caretaker.id,
        email: caretaker.email,
        fullName: caretaker.full_name,
        phoneNumber,
        newPassword,
        sendEmail: true,
        sendSms: true,
        module: 'real_estate'
      }, { accessToken: session.access_token });

      if (!data?.success) throw new Error(data?.error || 'Failed to reset caretaker credentials.');
      await fetchAll();
    } catch (error: any) {
      alert('Error resetting caretaker credentials: ' + (error?.message || 'Unknown error'));
    } finally {
      setResetting(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.role?.toLowerCase?.() !== 'tenant' &&
    emp.role?.toLowerCase?.() !== 'landlord' &&
    (
      emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      (emp.employee_no || '').toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const filteredTenants = tenants.filter(tenant =>
    tenant.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    (tenant.tenant_no || '').toLowerCase().includes(search.toLowerCase()) ||
    tenant.email?.toLowerCase().includes(search.toLowerCase()) ||
    tenant.login_username?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLandlords = landlords.filter(landlord =>
    landlord.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    landlord.email?.toLowerCase().includes(search.toLowerCase()) ||
    landlord.login_username?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCaretakers = caretakers.filter((caretaker) =>
    caretaker.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    caretaker.email?.toLowerCase().includes(search.toLowerCase()) ||
    caretaker.login_username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] text-black dark:text-white">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button 
              onClick={() => navigate('/app/hr/dashboard')} 
              className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-gray-500 transition hover:border-[#ff6a00]/40 hover:bg-white hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.08] dark:hover:text-white"
              title="Back to HR Dashboard"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Credentials Hub</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">View and manage employee, tenant, landlord, and caretaker credentials</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface sm:p-6">
          <div className="mb-6 flex flex-wrap gap-2">
            <TabButton active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} icon={<Users size={14} />} label="Employees" count={employees.length} />
            <TabButton active={activeTab === 'tenants'} onClick={() => setActiveTab('tenants')} icon={<Home size={14} />} label="Tenants" count={tenants.length} />
            <TabButton active={activeTab === 'landlords'} onClick={() => setActiveTab('landlords')} icon={<Building2 size={14} />} label="Landlords" count={landlords.length} />
            <TabButton active={activeTab === 'caretakers'} onClick={() => setActiveTab('caretakers')} icon={<KeyRound size={14} />} label="Caretakers" count={caretakers.length} />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-text" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'employees'
                    ? 'Search by name, employee number, or email...'
                    : activeTab === 'tenants'
                      ? 'Search by name, tenant number, username, or email...'
                      : 'Search by name, username, or email...'
                }
                title="Search for employee credentials"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm text-black outline-none placeholder:text-gray-400 focus:border-[#ff6a00]/40 focus:ring-1 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{error}</div>}
          {loading ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : (
            <>
              {activeTab === 'employees' && renderEmployeeList(filteredEmployees, copied, copyToClipboard, resetPassword, resendCredentials, resetting)}
              {activeTab === 'tenants' && renderTenantList(filteredTenants, resetTenantLogin, resetting)}
              {activeTab === 'landlords' && renderLandlordList(filteredLandlords, copied, copyToClipboard)}
              {activeTab === 'caretakers' && renderCaretakerList(filteredCaretakers, resetCaretakerLogin, resendCredentials, resetting)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'bg-[#ff6a00] text-white shadow-lg shadow-[#ff6a00]/20'
          : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
      }`}
    >
      {icon}
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-slate-200'}`}>{count}</span>
    </button>
  );
}

function renderEmployeeList(
  rows: any[],
  copied: string | null,
  copyToClipboard: (text: string, id: string) => void,
  resetPassword: (employee: any) => Promise<void>,
  resendCredentials: (employee: any) => Promise<void>,
  resetting: string | null,
) {
  return rows.length === 0 ? (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 py-12 text-center text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">No employees found</div>
  ) : (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Employee No</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Username</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Sent</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Scope</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((emp) => {
            const username = emp.username || emp.email?.split('@')[0] || emp.full_name?.toLowerCase().replace(/\s+/g, '.') || 'N/A';
            return (
              <tr key={emp.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5">
                <td className="px-4 py-4 text-sm text-gray-700 dark:text-slate-300">{emp.employee_no || 'N/A'}</td>
                <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">{emp.full_name}</td>
                <td className="px-4 py-4 text-sm text-gray-700 dark:text-slate-300">{emp.email || 'N/A'}</td>
                <td className="px-4 py-4 text-sm font-mono text-gray-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{username}</span>
                    <button
                      onClick={() => copyToClipboard(username, `user-${emp.id}`)}
                      title="Copy username"
                      aria-label="Copy username"
                      className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      {copied === `user-${emp.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-700 dark:text-slate-300">
                  {emp.credentials_sent_at ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Sent {new Date(emp.credentials_sent_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-slate-500">Not sent</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700 dark:text-slate-300">{emp.module || emp.company_code || emp.role || 'N/A'}</td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => void resendCredentials(emp)}
                      disabled={resetting === emp.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#ff6a00]/40"
                    >
                      <Mail size={14} className={resetting === emp.id ? 'animate-spin' : ''} />
                      Resend
                    </button>
                    <button
                      onClick={() => void resetPassword(emp)}
                      disabled={resetting === emp.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#ff6a00] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#ff7a1a] disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={resetting === emp.id ? 'animate-spin' : ''} />
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderTenantList(
  rows: any[],
  resetTenantLogin: (tenant: any, resend?: boolean) => Promise<void>,
  resetting: string | null,
) {
  return rows.length === 0 ? (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 py-12 text-center text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">No tenants found</div>
  ) : (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <table className="w-full">
        <thead><tr className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5"><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Tenant No</th><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Name</th><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Email</th><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Username</th><th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Actions</th></tr></thead>
        <tbody>{rows.map((tenant) => { const username = tenant.login_username || tenant.email?.split('@')[0] || 'N/A'; return <tr key={tenant.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"><td className="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">{tenant.tenant_no || 'N/A'}</td><td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{tenant.full_name}</td><td className="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">{tenant.email || 'N/A'}</td><td className="py-3 px-4 text-sm font-mono text-gray-900 dark:text-slate-100">{username}</td><td className="py-3 px-4 text-right"><button className="inline-flex items-center gap-1 rounded-lg bg-[#ff6a00] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ff7a1a]" onClick={() => void resetTenantLogin(tenant, Boolean(tenant.login_sent_at))}><RefreshCw size={14} />{tenant.login_sent_at ? 'Resend' : 'Send'}</button></td></tr>; })}</tbody>
      </table>
    </div>
  );
}

function renderLandlordList(
  rows: any[],
  copied: string | null,
  copyToClipboard: (text: string, id: string) => void,
) {
  return rows.length === 0 ? (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 py-12 text-center text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">No landlords found</div>
  ) : (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <table className="w-full">
        <thead><tr className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5"><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Name</th><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Email</th><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Username</th><th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Property</th><th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Actions</th></tr></thead>
        <tbody>{rows.map((landlord) => { const username = landlord.login_username || landlord.email?.split('@')[0] || 'N/A'; return <tr key={landlord.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"><td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{landlord.full_name}</td><td className="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">{landlord.email || 'N/A'}</td><td className="py-3 px-4 text-sm font-mono text-gray-900 dark:text-slate-100">{username}</td><td className="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">{landlord.property?.name || 'N/A'}</td><td className="py-3 px-4 text-right"><span className="text-xs text-gray-500 dark:text-slate-400">Use landlord portal page</span></td></tr>; })}</tbody>
      </table>
    </div>
  );
}

function renderCaretakerList(
  rows: any[],
  resetCaretakerLogin: (caretaker: any) => Promise<void>,
  resendCredentials: (caretaker: any) => Promise<void>,
  resetting: string | null,
) {
  return rows.length === 0 ? (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 py-12 text-center text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">No caretakers found</div>
  ) : (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
            <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Name</th>
            <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Email</th>
            <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Username</th>
            <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Property</th>
            <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((caretaker) => {
            const username = caretaker.login_username || caretaker.email?.split('@')[0] || 'N/A';
            return (
              <tr key={caretaker.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5">
                <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{caretaker.full_name}</td>
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">{caretaker.email || 'N/A'}</td>
                <td className="py-3 px-4 text-sm font-mono text-gray-900 dark:text-slate-100">{username}</td>
                <td className="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">{caretaker.property?.name || 'N/A'}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#ff6a00]/40 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/5 dark:text-slate-200" onClick={() => void resendCredentials(caretaker)}>
                      <Mail size={14} />
                      Resend
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-lg bg-[#ff6a00] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ff7a1a]" onClick={() => void resetCaretakerLogin(caretaker)}>
                      <RefreshCw size={14} />
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default EmployeeCredentials;
