// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Wallet, Download, Eye, ChevronRight, TrendingUp, ShieldCheck } from 'lucide-react';
import { payslipService, type PayslipRecord } from '../../services/payslipService';
import CustomToast, { ToastType } from '../../components/CustomToast';
import CustomLoader from '../../components/CustomLoader';

const getMonthLabel = (name: string) => {
  const match = name.match(/(20\d{2}|19\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (match) return name;
  return name.replace(/[_-]+/g, ' ').trim();
};

const MyPayroll: React.FC = () => {
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const records = await payslipService.getMyPayslips();
        if (mounted) setPayslips(records);
      } catch (error: any) {
        if (mounted) {
          setToast({ message: error?.message || 'Unable to load payslips.', type: 'error' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const latest = payslips[0];
    const count = payslips.length;
    return {
      latestMonth: latest ? getMonthLabel(latest.name) : 'No payslips yet',
      latestAmount: latest ? 'KES ' + (latest.metadata?.size ? latest.metadata.size.toLocaleString() : '0') : 'KES 0',
      count,
    };
  }, [payslips]);

  const openPayslip = async (payslip: PayslipRecord) => {
    try {
      const url = await payslipService.getDownloadUrl(payslip.name);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      setToast({ message: error?.message || 'Unable to open payslip.', type: 'error' });
    }
  };

  const downloadPayslip = async (payslip: PayslipRecord) => {
    try {
      const url = await payslipService.getDownloadUrl(payslip.name);
      const link = document.createElement('a');
      link.href = url;
      link.download = payslip.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      setToast({ message: error?.message || 'Unable to download payslip.', type: 'error' });
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">My Financials</h1>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest italic">Personal Portal • Confidential</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={12} /> Verified E-Slip
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/70 dark:bg-black/20 backdrop-blur-xl border border-gray-200/50 dark:border-white/5 p-8 rounded-[32px] shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-purple/5 blur-3xl group-hover:bg-brand-purple/20 transition-all rounded-full" />
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Latest Payslip</h3>
          <p className="text-3xl font-black text-gray-900 dark:text-white mb-2">{stats.latestAmount}</p>
          <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold">
            <TrendingUp size={12} /> {stats.latestMonth}
          </div>
        </div>

        <div className="bg-white/70 dark:bg-black/20 backdrop-blur-xl border border-gray-200/50 dark:border-white/5 p-8 rounded-[32px] shadow-xl">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Payslip Count</h3>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.count}</p>
          <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-tight">Available for viewing and download</p>
        </div>

        <div className="bg-white/70 dark:bg-black/20 backdrop-blur-xl border border-gray-200/50 dark:border-white/5 p-8 rounded-[32px] shadow-xl group cursor-pointer hover:border-brand-purple transition-all">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Salary Advance</h3>
          <p className="text-3xl font-black text-gray-900 dark:text-white">Available</p>
          <div className="flex items-center gap-2 text-brand-purple text-[10px] font-black uppercase mt-2">
            Apply Now <ChevronRight size={12} />
          </div>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-black/20 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 rounded-[32px] shadow-2xl">
        <div className="p-8 border-b border-gray-100 dark:border-white/5">
          <h2 className="text-md font-black text-gray-900 dark:text-white tracking-tight uppercase tracking-widest">Recent Payslips</h2>
        </div>

        {loading ? (
          <div className="p-8">
            <CustomLoader label="Loading payslips..." />
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {payslips.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No payslips found for your account yet.
              </div>
            ) : (
              payslips.map((sep) => (
                <div key={sep.name} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-indigo-500/20">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-900 dark:text-white">{getMonthLabel(sep.name)}</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{sep.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md">Available</span>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-brand-purple transition-all"
                        title="View Payslip"
                        aria-label="View"
                        onClick={() => void openPayslip(sep)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-brand-purple transition-all"
                        title="Download Payslip"
                        aria-label="Download"
                        onClick={() => void downloadPayslip(sep)}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {toast && (
        <CustomToast
          isVisible={!!toast}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default MyPayroll;
