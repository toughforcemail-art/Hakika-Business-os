// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AlertTriangle, ArrowLeft, CreditCard, DollarSign, PieChart, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateRoleReport } from '../../utils/reportGenerator';
import { useAccess } from '../../context/AccessContext';
import { supabase } from '../../utils/supabase';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface DashboardStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalExpenses: number;
  monthlyExpenses: number;
  netProfit: number;
  monthlyProfit: number;
  pendingPayments: number;
  overdueInvoices: number;
}

interface FinanceInvoiceSummary {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  status: string;
  transaction_class: string;
  notes: string | null;
  created_at: string;
}

interface FinanceReceiptSummary {
  id: string;
  receipt_number: string | null;
  receipt_date: string;
  amount: number;
  description: string | null;
  source_module: string;
  created_at: string;
}

interface FinancePaymentSummary {
  id: string;
  payment_number: string | null;
  payment_date: string;
  amount: number;
  description: string | null;
  cost_center: string;
  status: string | null;
  created_at: string;
}

interface RecentTransaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  status: string;
}

interface RecentChange {
  id: string;
  description: string;
  resourceType: string | null;
  actionType: string;
  createdAt: string;
}

interface ChartPoint {
  month: string;
  revenue: number;
  expenses: number;
}

const emptyStats: DashboardStats = {
  totalRevenue: 0,
  monthlyRevenue: 0,
  totalExpenses: 0,
  monthlyExpenses: 0,
  netProfit: 0,
  monthlyProfit: 0,
  pendingPayments: 0,
  overdueInvoices: 0,
};

const formatMoney = (value: number) =>
  `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeValue = (value?: string | null) => (value || '').trim().toLowerCase();

const isMissingRelationError = (error: any, relationName: string) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return message.includes(relationName.toLowerCase()) && message.includes('does not exist');
};

const isPendingPaymentStatus = (status?: string | null) => ['pending', 'processing', 'draft'].includes(normalizeValue(status));

const isInvoiceOverdue = (invoice: FinanceInvoiceSummary) => {
  if (!invoice.due_date) return false;
  if (['paid', 'cancelled'].includes(normalizeValue(invoice.status))) return false;

  const dueDate = new Date(invoice.due_date);
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today && Number(invoice.total_amount || 0) > Number(invoice.amount_paid || 0);
};

const buildMonthBuckets = () => {
  const buckets: ChartPoint[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() - 5);

  for (let index = 0; index < 6; index += 1) {
    const date = new Date(cursor);
    date.setMonth(cursor.getMonth() + index);
    buckets.push({
      month: date.toLocaleString(undefined, { month: 'short' }),
      revenue: 0,
      expenses: 0,
    });
  }

  return buckets;
};

const FinanceDashboardAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [recentChanges, setRecentChanges] = useState<RecentChange[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>(buildMonthBuckets());
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(async () => {
    // 1. Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    try {
      const userRole = (profile?.role || '').toLowerCase();
      const isElevated = ['super admin', 'director', 'director / super admin', 'administrator', 'accountant'].includes(userRole);
      const scope = await resolveOrganizationScope(profile);
      
      if (controller.signal.aborted) return;

      setOrganizationNotice(scope.notice);
      setDataNotice(null);

      // Super Admins/Elevated users can see data even without a specific organization link
      if (!scope.organizationId && !isElevated) {
        setStats(emptyStats);
        setRecentTransactions([]);
        setChartData(buildMonthBuckets());
        setOrganizationNotice('Your account is not linked to an organization yet, so finance analytics cannot be loaded.');
        return;
      }

      // If elevated but no specific organization, we fetch EVERYTHING (no eq filter)
      const buildQueries = (organizationId: string | null) => {
        let invQ = supabase.from('finance_invoices').select('id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status, transaction_class, notes, created_at').abortSignal(controller.signal);
        let recQ = supabase.from('finance_receipts').select('id, receipt_number, receipt_date, amount, description, source_module, created_at').abortSignal(controller.signal);
        let payQ = supabase.from('finance_payments').select('id, payment_number, payment_date, amount, description, cost_center, status, created_at').abortSignal(controller.signal);

        if (organizationId) {
          invQ = invQ.eq('organization_id', organizationId);
          recQ = recQ.eq('organization_id', organizationId);
          payQ = payQ.eq('organization_id', organizationId);
        }

        return Promise.all([invQ, recQ, payQ]);
      };

      // Determine which organization ID to filter by. 
      // If Super Admin has no linked org, we pass null to buildQueries to fetch global data.
      const targetOrgId = isElevated ? (scope.organizationId || null) : scope.organizationId;
      const scopedQueries = await buildQueries(targetOrgId);

      if (controller.signal.aborted) return;

      let [invoicesResult, receiptsResult, paymentsResult] = scopedQueries;

      // Fallback: If scoped query returned nothing, try a global fetch if it's an elevated user
      if (isElevated && (!invoicesResult.data?.length || !receiptsResult.data?.length)) {
          if (!invoicesResult.data?.length) {
              const globalInvoices = await supabase.from('finance_invoices').select('id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status, transaction_class, notes, created_at').abortSignal(controller.signal).limit(100);
              if (globalInvoices.data?.length) invoicesResult = globalInvoices as any;
          }
          if (!receiptsResult.data?.length) {
              const globalReceipts = await supabase.from('finance_receipts').select('id, receipt_number, receipt_date, amount, description, source_module, created_at').abortSignal(controller.signal).limit(100);
              if (globalReceipts.data?.length) receiptsResult = globalReceipts as any;
          }
          if (!paymentsResult.data?.length) {
              const globalPayments = await supabase.from('finance_payments').select('id, payment_number, payment_date, amount, description, cost_center, status, created_at').abortSignal(controller.signal).limit(100);
              if (globalPayments.data?.length) paymentsResult = globalPayments as any;
          }
      }

      if (controller.signal.aborted) return;

      const { data: recentChangeData } = await supabase
        .from('activity_logs')
        .select('id, description, resource_type, action_type, created_at, module')
        .eq('module', 'finance')
        .order('created_at', { ascending: false })
        .limit(6)
        .abortSignal(controller.signal);

      if (invoicesResult.error) throw invoicesResult.error;
      if (receiptsResult.error) throw receiptsResult.error;

      let payments: FinancePaymentSummary[] = [];
      if (paymentsResult.error) {
        if (isMissingRelationError(paymentsResult.error, 'finance_payments')) {
          setDataNotice('Finance payments table is not available in this environment yet, so expense analytics are limited to zero until that migration is applied.');
        } else {
          throw paymentsResult.error;
        }
      } else {
        payments = (paymentsResult.data || []) as FinancePaymentSummary[];
      }

      const invoices = (invoicesResult.data || []) as FinanceInvoiceSummary[];
      const receipts = (receiptsResult.data || []) as FinanceReceiptSummary[];

      const currentMonth = new Date().toISOString().slice(0, 7);
      const totalRevenue = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
      const monthlyRevenue = receipts
        .filter((receipt) => receipt.receipt_date.startsWith(currentMonth))
        .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
      const totalExpenses = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const monthlyExpenses = payments
        .filter((payment) => payment.payment_date.startsWith(currentMonth))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const pendingPayments = payments
        .filter((payment) => isPendingPaymentStatus(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const overdueInvoices = invoices.filter((invoice) => isInvoiceOverdue(invoice)).length;

      if (controller.signal.aborted) return;

      setStats({
        totalRevenue,
        monthlyRevenue,
        totalExpenses,
        monthlyExpenses,
        netProfit: totalRevenue - totalExpenses,
        monthlyProfit: monthlyRevenue - monthlyExpenses,
        pendingPayments,
        overdueInvoices,
      });

      const nextRecentTransactions: RecentTransaction[] = [
        ...receipts.map((receipt) => ({
          id: `receipt-${receipt.id}`,
          type: 'income' as const,
          description: receipt.description || `Receipt ${receipt.receipt_number || 'posted'}`,
          amount: Number(receipt.amount || 0),
          date: receipt.receipt_date,
          status: 'completed',
        })),
        ...payments.map((payment) => ({
          id: `payment-${payment.id}`,
          type: 'expense' as const,
          description: payment.description || payment.cost_center || `Payment ${payment.payment_number || 'posted'}`,
          amount: -Math.abs(Number(payment.amount || 0)),
          date: payment.payment_date,
          status: normalizeValue(payment.status) || 'pending',
        })),
      ]
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
        .slice(0, 6);

      setRecentTransactions(nextRecentTransactions);
      setRecentChanges((recentChangeData || []).map((item: any) => ({
        id: item.id,
        description: item.description || item.action_type,
        resourceType: item.resource_type || null,
        actionType: item.action_type,
        createdAt: item.created_at,
      })));

      const bucketMap = new Map(
        buildMonthBuckets().map((bucket) => [bucket.month, { ...bucket }]),
      );

      receipts.forEach((receipt) => {
        const month = new Date(receipt.receipt_date).toLocaleString(undefined, { month: 'short' });
        const bucket = bucketMap.get(month);
        if (bucket) bucket.revenue += Number(receipt.amount || 0);
      });

      payments.forEach((payment) => {
        const month = new Date(payment.payment_date).toLocaleString(undefined, { month: 'short' });
        const bucket = bucketMap.get(month);
        if (bucket) bucket.expenses += Number(payment.amount || 0);
      });

      setChartData(Array.from(bucketMap.values()));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('FinanceDashboardAdmin: Fetch aborted.');
        return;
      }
      console.error('Failed to load finance dashboard:', error);
      const errorMsg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error);
      setToast({ message: errorMsg || 'Failed to load finance dashboard.', type: 'error' });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      void loadDashboard();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadDashboard, profile]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      await generateRoleReport(profile);
    } finally {
      setGenerating(false);
    }
  };

  const hasChartData = useMemo(
    () => chartData.some((entry) => entry.revenue > 0 || entry.expenses > 0),
    [chartData],
  );

  if (loading) {
    return <CustomLoader text="Loading finance dashboard..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-gray-50/50 p-6 dark:bg-dark-bg">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/app/finance/dashboard')}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-white/5"
          title="Back to Finance Dashboard"
          aria-label="Back to Finance Dashboard"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Overview of live finance activity across receipts, invoices, and payments.</p>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}
      {dataNotice ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
          {dataNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(stats.totalRevenue)}</p>
              <p className="mt-1 text-sm text-green-600 dark:text-green-400">This month: {formatMoney(stats.monthlyRevenue)}</p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/20">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(stats.totalExpenses)}</p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">This month: {formatMoney(stats.monthlyExpenses)}</p>
            </div>
            <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/20">
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Net Profit</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(stats.netProfit)}</p>
              <p className={`mt-1 text-sm ${stats.monthlyProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                This month: {formatMoney(stats.monthlyProfit)}
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/20">
              <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending Payments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(stats.pendingPayments)}</p>
              <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">{stats.overdueInvoices} overdue invoices</p>
            </div>
            <div className="rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900/20">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue vs Expenses</h2>
            <PieChart className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <div className="space-y-4">
            {chartData.map((data) => (
              <div key={data.month} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{data.month}</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-900 dark:text-white">{formatMoney(data.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <span className="text-sm text-gray-900 dark:text-white">{formatMoney(data.expenses)}</span>
                  </div>
                </div>
              </div>
            ))}
            {!hasChartData ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No finance activity has been posted in the last six months.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
            <button
              onClick={() => navigate('/app/finance/payments')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
              title="View all transactions"
              aria-label="View all transactions"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${transaction.type === 'income' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                    {transaction.type === 'income' ? (
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{transaction.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {transaction.amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(transaction.amount))}
                  </p>
                  <span className={`rounded-full px-2 py-1 text-xs ${transaction.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'}`}>
                    {transaction.status}
                  </span>
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No finance transactions have been posted yet.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Finance Changes</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Activity log</span>
        </div>
        <div className="space-y-3">
          {recentChanges.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent finance changes found.</p>
          ) : recentChanges.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-50 p-3 dark:border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.resourceType || 'finance'} • {item.actionType}</p>
              </div>
              <div className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-6 dark:border-white/[0.06] dark:bg-dark-surface">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <button
            onClick={() => navigate('/app/finance/payments')}
            title="View Payments"
            aria-label="View Payments"
            className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/5"
          >
            <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">View Payments</span>
          </button>
          <button
            onClick={() => navigate('/app/finance/invoices')}
            title="Open Customer Hub"
            aria-label="Open Customer Hub"
            className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/5"
          >
            <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Customer Hub</span>
          </button>
          <button
            onClick={() => navigate('/app/finance/audit')}
            title="View Alerts"
            aria-label="View Alerts"
            className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/5"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">View Alerts</span>
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            title="Generate Financial Report"
            aria-label="Generate Financial Report"
            className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.06] dark:hover:bg-white/5"
          >
            <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {generating ? 'Generating...' : 'Generate Report'}
            </span>
          </button>
        </div>
      </div>

      {toast ? (
        <CustomToast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
};

export default FinanceDashboardAdmin;
