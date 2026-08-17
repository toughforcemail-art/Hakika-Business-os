// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, FileText, Landmark } from 'lucide-react';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';
import financeProviderSyncService, { FinanceProviderConnection } from '../../services/financeProviderSyncService';

interface SyncRun {
  id: string;
  connection_id: string;
  status: string;
  trigger_source: string;
  request_payload: any;
  result_summary: any;
  imported_count: number;
  upserted_count: number;
  skipped_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface ExternalTransaction {
  id: string;
  connection_id: string;
  sync_run_id: string | null;
  transaction_direction: 'credit' | 'debit';
  transaction_type: string | null;
  posted_at: string;
  value_date: string | null;
  amount: number;
  currency: string | null;
  balance_after: number | null;
  reference_number: string | null;
  account_reference: string | null;
  counterparty_name: string | null;
  narrative: string | null;
}

const panelCls =
  'rounded-[24px] border border-gray-200 bg-white/95 p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';
const inputCls =
  'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';

const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const toNumber = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const FinanceStatements: React.FC = () => {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [connections, setConnections] = useState<FinanceProviderConnection[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [transactions, setTransactions] = useState<ExternalTransaction[]>([]);

  const connectionMap = useMemo(() => new Map(connections.map((c) => [c.id, c])), [connections]);

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      if (!scope.organizationId) {
        setConnections([]);
        setSyncRuns([]);
        setTransactions([]);
        setSelectedRunId('');
        return;
      }

      const [connectionsData, runsResponse] = await Promise.all([
        financeProviderSyncService.listConnections(),
        supabase
          .from('finance_external_sync_runs')
          .select('id, connection_id, status, trigger_source, request_payload, result_summary, imported_count, upserted_count, skipped_count, error_message, started_at, completed_at')
          .eq('organization_id', scope.organizationId)
          .order('started_at', { ascending: false }),
      ]);

      if (runsResponse.error) throw runsResponse.error;

      const nextRuns = (runsResponse.data || []) as SyncRun[];
      setConnections(connectionsData);
      setSyncRuns(nextRuns);
      setSelectedRunId((current) => current || nextRuns[0]?.id || '');
    } catch (error: any) {
      console.error('Failed to load statements:', error);
      setToast({ message: error.message || 'Failed to load statements.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (runId: string) => {
    if (!runId) {
      setTransactions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('finance_external_transactions')
        .select(
          'id, connection_id, sync_run_id, transaction_direction, transaction_type, posted_at, value_date, amount, currency, balance_after, reference_number, account_reference, counterparty_name, narrative',
        )
        .eq('sync_run_id', runId)
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setTransactions((data || []) as ExternalTransaction[]);
    } catch (error: any) {
      console.error('Failed to load statement transactions:', error);
      setToast({ message: error.message || 'Failed to load statement transactions.', type: 'error' });
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  useEffect(() => {
    void loadTransactions(selectedRunId);
  }, [selectedRunId]);

  const filteredRuns = useMemo(() => {
    if (!selectedConnectionId) return syncRuns;
    return syncRuns.filter((run) => run.connection_id === selectedConnectionId);
  }, [selectedConnectionId, syncRuns]);

  const activeRun = useMemo(() => syncRuns.find((run) => run.id === selectedRunId) || null, [selectedRunId, syncRuns]);

  const totals = useMemo(() => {
    const totalCredits = transactions.filter((row) => row.transaction_direction === 'credit').reduce((sum, row) => sum + toNumber(row.amount), 0);
    const totalDebits = transactions.filter((row) => row.transaction_direction === 'debit').reduce((sum, row) => sum + toNumber(row.amount), 0);
    const latestBalance = transactions.find((row) => row.balance_after != null)?.balance_after ?? null;
    return { totalCredits, totalDebits, latestBalance };
  }, [transactions]);

  const statementFile =
    activeRun?.request_payload?.statementFile ||
    activeRun?.result_summary?.file ||
    null;

  if (loading) {
    return <CustomLoader text="Loading statements..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileText className="text-[#ff6a00]" aria-hidden="true" /> Statement Viewer
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Review imported statement runs and the transactions created from them.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelCls}>
          <p className={labelCls}>Total Deposits</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{formatMoney(totals.totalCredits)}</p>
        </div>
        <div className={panelCls}>
          <p className={labelCls}>Total Withdrawals</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{formatMoney(totals.totalDebits)}</p>
        </div>
        <div className={panelCls}>
          <p className={labelCls}>Latest Balance</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
            {totals.latestBalance != null ? formatMoney(totals.latestBalance) : 'KES 0.00'}
          </p>
        </div>
      </div>

      <div className={`${panelCls} space-y-4`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>Connection</label>
            <select
              value={selectedConnectionId}
              onChange={(event) => {
                const next = event.target.value;
                setSelectedConnectionId(next);
                const nextRun = syncRuns.find((run) => run.connection_id === next);
                setSelectedRunId(nextRun?.id || '');
              }}
              className={inputCls}
            >
              <option value="">All connections</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.connection_name} ({connection.provider.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Statement Run</label>
            <select
              value={selectedRunId}
              onChange={(event) => setSelectedRunId(event.target.value)}
              className={inputCls}
            >
              <option value="">Select statement run</option>
              {filteredRuns.map((run) => {
                const connection = connectionMap.get(run.connection_id);
                const label = `${connection?.connection_name || 'Unknown'} - ${formatDate(run.started_at)}`;
                return (
                  <option key={run.id} value={run.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {activeRun ? (
          <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {connectionMap.get(activeRun.connection_id)?.connection_name || 'Unknown Connection'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Status: {activeRun.status} | Trigger: {activeRun.trigger_source}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Started: {formatDate(activeRun.started_at)} | Completed: {formatDate(activeRun.completed_at)}
                </p>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Imported: {activeRun.imported_count} | Upserted: {activeRun.upserted_count} | Skipped: {activeRun.skipped_count}
              </div>
            </div>
            {statementFile ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <Landmark size={14} />
                <span>Statement file: {statementFile.name}</span>
                <span>Type: {statementFile.type}</span>
                <span>Size: {Math.round(toNumber(statementFile.size) / 1024)} KB</span>
              </div>
            ) : null}
            {activeRun.error_message ? (
              <p className="mt-3 text-xs text-rose-500">Error: {activeRun.error_message}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            Select a statement run to view imported rows.
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden rounded-[28px] border border-gray-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:border-white/5 dark:bg-white/5">
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Counterparty</th>
                <th className="px-6 py-4">Narrative</th>
                <th className="px-6 py-4">Direction</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Posted At</th>
                <th className="px-6 py-4">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {transactions.map((row) => (
                <tr key={row.id} className="text-gray-900 transition-colors hover:bg-slate-50/90 dark:text-white dark:hover:bg-[rgba(18,73,96,0.88)]">
                  <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">
                    {row.reference_number || row.account_reference || '-'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {row.counterparty_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {row.narrative || row.transaction_type || '-'}
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {row.transaction_direction}
                  </td>
                  <td className={`px-6 py-4 text-xs font-black ${row.transaction_direction === 'credit' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                    <span className="inline-flex items-center gap-1">
                      {row.transaction_direction === 'credit' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {row.transaction_direction === 'credit' ? '+' : '-'}
                      {formatMoney(toNumber(row.amount), row.currency || 'KES')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-gray-400 dark:text-slate-400">{formatDate(row.posted_at)}</td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 dark:text-white">
                    {row.balance_after != null ? formatMoney(toNumber(row.balance_after), row.currency || 'KES') : '-'}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-300">
                    No statement rows found for this run.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default FinanceStatements;
