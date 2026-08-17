// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Filter, History, Search, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../hooks/useAccess';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { resolveOrganizationScope } from '../../utils/organizationScope';

interface FinanceAlertRecord {
  id: string;
  organization_id: string;
  alert_type: string;
  alert_title: string;
  alert_description: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

interface FinanceInvoiceExposure {
  id: string;
  invoice_number: string | null;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  status: string;
}

const formatMoney = (value: number) =>
  `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeValue = (value?: string | null) => (value || '').trim().toLowerCase();

const isMissingRelationError = (error: any, relationName: string) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return message.includes(relationName.toLowerCase()) && message.includes('does not exist');
};

const isInvoiceOverdue = (invoice: FinanceInvoiceExposure) => {
  if (!invoice.due_date) return false;
  if (['paid', 'cancelled'].includes(normalizeValue(invoice.status))) return false;

  const dueDate = new Date(invoice.due_date);
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today && Number(invoice.total_amount || 0) > Number(invoice.amount_paid || 0);
};

const FinanceAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<FinanceAlertRecord[]>([]);
  const [invoices, setInvoices] = useState<FinanceInvoiceExposure[]>([]);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationNotice(scope.notice);
      setDataNotice(null);

      if (!scope.organizationId) {
        setAlerts([]);
        setInvoices([]);
        setOrganizationNotice('Your account is not linked to an organization yet, so finance alerts cannot be loaded.');
        return;
      }

      const [alertsResult, invoicesResult] = await Promise.all([
        supabase
          .from('finance_alerts')
          .select('id, organization_id, alert_type, alert_title, alert_description, due_date, priority, status, acknowledged_at, created_at')
          .eq('organization_id', scope.organizationId)
          .order('created_at', { ascending: false }),
        supabase
          .from('finance_invoices')
          .select('id, invoice_number, due_date, total_amount, amount_paid, status')
          .eq('organization_id', scope.organizationId),
      ]);

      if (alertsResult.error) {
        if (isMissingRelationError(alertsResult.error, 'finance_alerts')) {
          setAlerts([]);
          setDataNotice('Finance alerts table is not available in this environment yet, so only live overdue exposure is shown.');
        } else {
          throw alertsResult.error;
        }
      } else {
        setAlerts((alertsResult.data || []) as FinanceAlertRecord[]);
      }

      if (invoicesResult.error) throw invoicesResult.error;
      setInvoices((invoicesResult.data || []) as FinanceInvoiceExposure[]);
    } catch (error: any) {
      console.error('Failed to load finance alerts:', error);
      setToast({ message: error.message || 'Failed to load finance alerts.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      void loadAlerts();
    }
  }, [loadAlerts, profile]);

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => !['resolved', 'closed'].includes(normalizeValue(alert.status))),
    [alerts],
  );

  const criticalAlerts = useMemo(
    () => activeAlerts.filter((alert) => ['critical', 'high'].includes(normalizeValue(alert.priority))),
    [activeAlerts],
  );

  const overdueInvoices = useMemo(() => invoices.filter((invoice) => isInvoiceOverdue(invoice)), [invoices]);

  const atRiskAmount = useMemo(
    () => overdueInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0)), 0),
    [overdueInvoices],
  );

  const resolutionRate = useMemo(() => {
    if (alerts.length === 0) return 0;
    const resolvedCount = alerts.filter(
      (alert) => ['resolved', 'closed', 'acknowledged'].includes(normalizeValue(alert.status)) || Boolean(alert.acknowledged_at),
    ).length;
    return Math.round((resolvedCount / alerts.length) * 100);
  }, [alerts]);

  if (loading) {
    return <CustomLoader text="Loading finance audit trail..." />;
  }

  return (
    <div className="min-h-screen bg-[#061827] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[#071425] p-5 shadow-[0_30px_100px_-60px_rgba(0,0,0,0.7)] backdrop-blur-sm lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/app/finance/dashboard')}
              className="mt-1 rounded-2xl border border-white/10 bg-[#0b2234] p-3 transition hover:border-cyan-400/30 hover:bg-[#0d2a40]"
              title="Back to Finance Dashboard"
              aria-label="Back to Finance Dashboard"
            >
              <ArrowLeft size={20} className="text-slate-200" aria-hidden="true" />
            </button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20">
                  <Shield className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">Finance audit trail</p>
                  <h1 className="text-3xl font-black text-white sm:text-4xl">Audit Trail</h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm text-slate-300">
                Track sensitive financial actions, alert states, and overdue exposure in a dark operator-focused view.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-2.5 text-sm text-slate-300">
              Live audit stream
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-2.5 text-sm text-slate-300">
              {alerts.length} records
            </div>
          </div>
        </div>

        {organizationNotice ? (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {organizationNotice}
          </div>
        ) : null}
        {dataNotice ? (
          <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {dataNotice}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-amber-500/20 bg-gradient-to-br from-[#2a2018] to-[#0b1220] p-5 shadow-[0_24px_80px_-48px_rgba(217,154,64,0.35)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/15 p-3">
                <AlertTriangle className="h-6 w-6 text-amber-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{criticalAlerts.length}</p>
                <p className="text-sm text-slate-300">Critical alerts</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-500/20 bg-gradient-to-br from-[#2a2018] to-[#0b1220] p-5 shadow-[0_24px_80px_-48px_rgba(217,154,64,0.35)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/15 p-3">
                <TrendingDown className="h-6 w-6 text-amber-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{formatMoney(atRiskAmount)}</p>
                <p className="text-sm text-slate-300">{overdueInvoices.length} overdue invoices</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-500/20 bg-gradient-to-br from-[#2a2018] to-[#0b1220] p-5 shadow-[0_24px_80px_-48px_rgba(217,154,64,0.35)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/15 p-3">
                <TrendingUp className="h-6 w-6 text-amber-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{resolutionRate}%</p>
                <p className="text-sm text-slate-300">Resolution rate</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-white/10 bg-[#071425] p-5 backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <label htmlFor="audit-search" className="sr-only">
                Search audit logs
              </label>
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="audit-search"
                type="text"
                placeholder="Search audit logs..."
                title="Search audit logs"
                className="w-full rounded-[22px] border border-white/10 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] focus:border-orange-400/40 focus:ring-4 focus:ring-orange-500/10"
                readOnly
              />
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-[#0b2234] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-orange-400/30 hover:bg-[#0f2d42]"
              title="Filter Audit Logs"
              aria-label="Filter Audit Logs"
              type="button"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filters
            </button>
          </div>
        </div>

        {overdueInvoices.length > 0 ? (
          <div className="mb-6 rounded-[28px] border border-amber-500/25 bg-[#211916] p-5 shadow-[0_24px_80px_-48px_rgba(217,154,64,0.25)]">
            <h2 className="text-lg font-bold text-white">Overdue Exposure</h2>
            <p className="mt-1 text-sm text-slate-300">
              {overdueInvoices.length} invoice{overdueInvoices.length === 1 ? '' : 's'} are overdue with a combined outstanding balance of {formatMoney(atRiskAmount)}.
            </p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#071425] backdrop-blur-sm">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <History className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              Recent Alerts
            </h2>
          </div>
          <div className="divide-y divide-white/10">
            {alerts.map((alert) => {
              const priority = normalizeValue(alert.priority);
              return (
                <div key={alert.id} className="p-5 transition hover:bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-2xl p-2.5 ${
                          priority === 'critical' ? 'bg-red-500/15' : priority === 'high' ? 'bg-amber-500/15' : 'bg-cyan-500/15'
                        }`}
                      >
                        <AlertTriangle
                          className={`h-5 w-5 ${
                            priority === 'critical' ? 'text-red-300' : priority === 'high' ? 'text-amber-300' : 'text-cyan-300'
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">{alert.alert_title}</h3>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-300">
                            {alert.priority || 'normal'}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-300">
                            {alert.status || 'active'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-300">{alert.alert_description || 'No description provided.'}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Created {new Date(alert.created_at).toLocaleString()} {alert.due_date ? `• Due ${alert.due_date}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-3 py-2 text-right text-sm text-slate-300">
                      {alert.alert_type}
                    </div>
                  </div>
                </div>
              );
            })}
            {alerts.length === 0 ? (
              <div className="px-6 py-20 text-center text-sm text-slate-400">No finance alerts have been recorded yet.</div>
            ) : null}
          </div>
        </div>

        {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
      </div>
    </div>
  );
};

export default FinanceAlerts;
