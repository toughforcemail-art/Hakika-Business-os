// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckSquare, Search, Filter, RefreshCw, CheckCircle2, AlertCircle,
  ArrowRight, Download, History, Upload, X, Check, ArrowUpRight, ChevronRight, Calculator
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { motion, AnimatePresence } from 'framer-motion';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface StatementEntry {
  id: string;
  date: string;
  reference: string;
  amount: number;
  description: string;
  status: 'pending' | 'matched' | 'discrepancy' | 'completed';
  match_id?: string;
  confidence?: 'exact' | 'high' | 'low';
  match_reasons?: string[];
}

export default function SmartReconciliation() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'exact' | 'high' | 'review' | 'completed'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, tenantRes, unitRes] = await Promise.all([
        supabase.from('re_invoices').select('*').is('deleted_at', null).in('status', ['unpaid', 'partial']),
        supabase.from('re_tenants').select('id, full_name, profile:profiles(full_name, email)'),
        supabase.from('re_units').select('id, unit_number')
      ]);

      setInvoices(invRes.data || []);
      setTenants(tenantRes.data || []);
      setUnits(unitRes.data || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setToast({ message: 'Failed to fetch background data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const entries: StatementEntry[] = lines.slice(1).filter(line => line.trim()).map((line, idx) => {
        const [date, reference, description, amountStr] = line.split(',').map(s => s.trim());
        return {
          id: `csv-${idx}-${Date.now()}`,
          date: date || new Date().toISOString().split('T')[0],
          reference: reference || `REF-${Math.random().toString(36).toUpperCase().slice(2, 8)}`,
          description: description || 'N/A',
          amount: parseFloat(amountStr) || 0,
          status: 'pending'
        };
      });
      setStatementEntries(entries);
      setToast({ message: `Successfully loaded ${entries.length} entries`, type: 'success' });
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const matches = useMemo(() => {
    return statementEntries.map(entry => {
      if (entry.status === 'completed') return { ...entry, match_reasons: ['Payment already reconciled from this statement.'] };

      // Scoring Engine
      const scoredInvoices = invoices.map(inv => {
        let score = 0;
        const reasons: string[] = [];
        const tenant = tenants.find(t => t.id === inv.tenant_id);
        const unit = units.find(u => u.id === inv.unit_id);
        
        const balance = Number(inv.amount_due) - Number(inv.amount_paid);
        
        // Exact Amount Match
        if (balance === entry.amount) {
          score += 60;
          reasons.push('Outstanding balance exactly matches the banked amount.');
        }
        
        // Name Match in Description
        const tenantName = tenant ? getTenantDisplayName(tenant as any) : '';
        if (tenantName && entry.description.toLowerCase().includes(tenantName.toLowerCase())) {
          score += 30;
          reasons.push(`Tenant name "${tenantName}" appears in the statement narrative.`);
        }
        
        // Unit Match in Description
        if (unit?.unit_number && entry.description.toLowerCase().includes(unit.unit_number.toLowerCase())) {
          score += 20;
          reasons.push(`Unit ${unit.unit_number} is referenced in the statement description.`);
        }

        // Reference Match (if invoice has a unique ref)
        if (inv.invoice_number && entry.description.includes(inv.invoice_number)) {
          score += 50;
          reasons.push(`Invoice reference ${inv.invoice_number} appears in the statement narrative.`);
        }

        return { ...inv, score, reasons };
      }).sort((a, b) => b.score - a.score);

      const bestMatch = scoredInvoices[0];
      
      if (bestMatch && bestMatch.score >= 80) {
        return { ...entry, match_id: bestMatch.id, confidence: 'exact' as const, status: 'matched' as const, match_reasons: bestMatch.reasons };
      } else if (bestMatch && bestMatch.score >= 50) {
        return { ...entry, match_id: bestMatch.id, confidence: 'high' as const, status: 'matched' as const, match_reasons: bestMatch.reasons };
      } else if (bestMatch && bestMatch.score >= 30) {
        return { ...entry, match_id: bestMatch.id, confidence: 'low' as const, status: 'pending' as const, match_reasons: bestMatch.reasons };
      }

      return { ...entry, status: 'pending' as const, match_reasons: ['No reliable amount, tenant, unit, or reference signal was found.'] };
    });
  }, [statementEntries, invoices, tenants, units]);

  const visibleMatches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return matches.filter(entry => {
      const matchedInvoice = invoices.find(i => i.id === entry.match_id);
      const tenant = tenants.find(t => t.id === matchedInvoice?.tenant_id);
      const unit = units.find(u => u.id === matchedInvoice?.unit_id);

      const matchesSearch = normalizedSearch
        ? [
            entry.description,
            entry.reference,
            tenant ? getTenantDisplayName(tenant as any) : null,
            unit?.unit_number,
            matchedInvoice?.invoice_number,
          ]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(normalizedSearch))
        : true;

      const matchesConfidence =
        confidenceFilter === 'all'
          ? true
          : confidenceFilter === 'review'
            ? entry.status !== 'completed' && (entry.confidence === 'low' || !entry.match_id)
            : confidenceFilter === 'completed'
              ? entry.status === 'completed'
              : entry.confidence === confidenceFilter && entry.status !== 'completed';

      return matchesSearch && matchesConfidence;
    });
  }, [matches, searchTerm, confidenceFilter, invoices, tenants, units]);

  const queueSummary = useMemo(() => ({
    totalVolume: statementEntries.reduce((sum, entry) => sum + entry.amount, 0),
    exactMatches: matches.filter(entry => entry.confidence === 'exact' && entry.status !== 'completed').length,
    probableMatches: matches.filter(entry => entry.confidence === 'high' && entry.status !== 'completed').length,
    reviewQueue: matches.filter(entry => entry.status !== 'completed' && (entry.confidence === 'low' || !entry.match_id)).length,
    completed: matches.filter(entry => entry.status === 'completed').length,
  }), [matches, statementEntries]);

  const reconcileEntry = async (entryId: string, invoiceId: string, amount: number, shouldRefresh = true) => {
    const selectedInvoice = invoices.find(i => i.id === invoiceId);
    if (!selectedInvoice) throw new Error('Invoice not found');

    const { error: payError } = await supabase.from('re_payments').insert([{
      company_id: profile?.company_id,
      tenant_id: selectedInvoice.tenant_id,
      unit_id: selectedInvoice.unit_id,
      amount: amount,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      status: 'confirmed',
      notes: `Reconciled from bank statement. Ref: ${statementEntries.find(e => e.id === entryId)?.reference}`
    }]);

    if (payError) throw payError;

    const newPaid = Number(selectedInvoice.amount_paid) + amount;
    const status = newPaid >= Number(selectedInvoice.amount_due) ? 'paid' : 'partial';
    
    await supabase.from('re_invoices').update({
      amount_paid: newPaid,
      status: status
    }).eq('id', invoiceId);

    setStatementEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: 'completed' } : e));
    if (shouldRefresh) {
      await fetchData();
    }
  };

  const handleApprove = async (entryId: string, invoiceId: string, amount: number) => {
    setIsProcessing(true);
    try {
      await reconcileEntry(entryId, invoiceId, amount);
      setToast({ message: 'Payment reconciled successfully', type: 'success' });
    } catch (error: any) {
      console.error(error);
      setToast({ message: error.message || 'Reconciliation failed', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchApprove = async () => {
    const batch = matches.filter(entry => entry.confidence === 'exact' && entry.status === 'matched' && entry.match_id);
    if (batch.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;

    try {
      for (const entry of batch) {
        await reconcileEntry(entry.id, entry.match_id!, entry.amount, false);
        successCount += 1;
      }

      await fetchData();
      setToast({ message: `${successCount} perfect matches reconciled successfully`, type: 'success' });
    } catch (error: any) {
      console.error(error);
      setToast({ message: error.message || 'Batch reconciliation failed', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Date,Reference,Description,Amount\n2026-03-01,REF-KCB-001,RENT UNIT 102 - JOHN DOE,45000\n2026-03-02,REF-EQ-002,RENT B4 - JANE SMITH,32500";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bank_statement_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader label="Analyzing financial ledger..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-4 md:p-8 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-3 bg-brand-purple/10 rounded-2xl text-brand-purple">
                  <CheckSquare size={32} />
               </div>
               <div>
                  <h1 className="text-4xl font-black tracking-tight">Financial Scribe</h1>
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                    Reconciling world-class real estate transactions.
                  </p>
               </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={downloadTemplate}
               title="Download a CSV template for bank statement uploads"
               className="px-5 py-2.5 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
             >
                <Download size={16} />
                Template
             </button>
             <button 
               onClick={fetchData}
               title="Refresh invoice and background data"
               className="p-3 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all shadow-xl shadow-brand-purple/20"
             >
                <RefreshCw size={24} className={isProcessing ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>

        {statementEntries.length === 0 ? (
          /* Upload State */
          <>
            <label htmlFor="bank-statement-upload" className="sr-only">Upload Bank Statement CSV</label>
            <input 
              id="bank-statement-upload"
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv" 
              title="Upload bank statement CSV file"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
            />
            <div 
              className={`
                relative group cursor-pointer border-2 border-dashed rounded-[3rem] p-20 text-center transition-all duration-500
                ${dragActive ? 'border-brand-purple bg-brand-purple/5' : 'border-gray-200 dark:border-white/10 hover:border-brand-purple/50 bg-white dark:bg-dark-surface'}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload Bank Statement. Click or drag and drop a CSV file."
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            >
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-brand-purple/10 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform">
                  <Upload className="text-brand-purple" size={40} />
                </div>
                <h2 className="text-3xl font-black mb-4 tracking-tight">Upload Bank Statement</h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-10 leading-relaxed">
                  Drop your CSV bank statement here or click to browse.<br/>
                  We'll automatically match entries to your outstanding invoices.
                </p>
                <div className="flex justify-center gap-6">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-400">
                    <Calculator size={14} /> Heuristic Matching
                  </div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-400">
                    <CheckCircle2 size={14} /> Bulk Approval
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Reconciliation View */
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'Statement Volume', value: `Ksh ${queueSummary.totalVolume.toLocaleString()}`, tone: 'text-brand-purple bg-brand-purple/10' },
                { label: 'Perfect Matches', value: queueSummary.exactMatches, tone: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
                { label: 'Probable Matches', value: queueSummary.probableMatches, tone: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
                { label: 'Needs Review', value: queueSummary.reviewQueue, tone: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
              ].map(card => (
                <div key={card.label} className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
                  <div className={`mb-3 inline-flex rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${card.tone}`}>
                    {card.label}
                  </div>
                  <p className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search statement, tenant, unit, or invoice"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                    title="Search reconciliation entries"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={confidenceFilter}
                    onChange={(event) => setConfidenceFilter(event.target.value as 'all' | 'exact' | 'high' | 'review' | 'completed')}
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                    title="Filter reconciliation queue"
                  >
                    <option value="all">All entries</option>
                    <option value="exact">Perfect matches</option>
                    <option value="high">Probable matches</option>
                    <option value="review">Needs review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Entries List */}
            <div className="lg:col-span-3 space-y-6">
              <AnimatePresence mode="popLayout">
                {visibleMatches.filter(m => m.status !== 'completed').map((entry, idx) => {
                  const matchedInvoice = invoices.find(i => i.id === entry.match_id);
                  const tenant = tenants.find(t => t.id === matchedInvoice?.tenant_id);
                  const unit = units.find(u => u.id === matchedInvoice?.unit_id);

                  return (
                    <motion.div 
                      layout
                      key={entry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group bg-white dark:bg-dark-surface rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden hover:shadow-2xl hover:shadow-brand-purple/5 transition-all duration-500"
                    >
                      <div className="flex flex-col md:flex-row">
                        {/* Statement Side */}
                        <div className="p-8 md:w-[45%] bg-gray-50/50 dark:bg-black/20 border-r border-gray-100 dark:border-white/5">
                          <div className="flex justify-between items-start mb-6">
                            <span className="px-3 py-1 bg-gray-200 dark:bg-white/10 rounded-full text-[10px] font-black uppercase text-gray-500 tracking-widest">Bank Entry</span>
                            <span className="text-xs font-bold text-gray-400">{entry.date}</span>
                          </div>
                          <h4 className="text-xl font-black mb-4 leading-tight group-hover:text-brand-purple transition-colors">{entry.description}</h4>
                          <div className="flex items-baseline gap-2">
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Amount</span>
                             <span className="text-2xl font-black tracking-tighter">Ksh {entry.amount.toLocaleString()}</span>
                          </div>
                          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 font-mono">
                             <History size={12} /> {entry.reference}
                          </div>
                        </div>

                        {/* Match Side */}
                        <div className="p-8 flex-1 flex flex-col justify-between">
                          {entry.match_id ? (
                            <div className="h-full flex flex-col justify-between space-y-6">
                               <div className="flex items-center justify-between">
                                  <div className={`
                                    flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white
                                    ${entry.confidence === 'exact' ? 'bg-emerald-500' : 'bg-amber-500'}
                                  `}>
                                     {entry.confidence === 'exact' ? <Check size={12} /> : <AlertCircle size={12} />}
                                     {entry.confidence === 'exact' ? 'Precision Match' : 'Probable Match'}
                                  </div>
                                  <div className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1">
                                     Suggested Link <ArrowRight size={10} />
                                  </div>
                               </div>

                               <div className="flex items-center gap-4 p-5 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5">
                                  <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 text-brand-purple flex items-center justify-center text-lg font-black shrink-0">
                                     {unit?.unit_number || '?'}
                                  </div>
                                  <div className="min-w-0">
                                     <p className="font-black text-lg truncate">{tenant ? getTenantDisplayName(tenant as any) : 'Unknown Tenant'}</p>
                                     <p className="text-xs text-brand-purple font-bold uppercase tracking-wider opacity-60">INV#{matchedInvoice?.invoice_number?.slice(-6)}</p>
                                  </div>
                                  <div className="ml-auto text-right">
                                     <p className="text-[10px] font-black text-gray-400 uppercase">Balance</p>
                                     <p className="text-xl font-black text-rose-500 tracking-tighter">Ksh {(Number(matchedInvoice?.amount_due || 0) - Number(matchedInvoice?.amount_paid || 0)).toLocaleString()}</p>
                                  </div>
                               </div>

                               <div className="rounded-3xl border border-dashed border-gray-200 p-4 dark:border-white/10">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-3">Why this matched</p>
                                  <div className="space-y-2">
                                     {(entry.match_reasons || []).slice(0, 3).map((reason: string) => (
                                        <div key={reason} className="text-sm text-gray-600 dark:text-gray-300">
                                           {reason}
                                        </div>
                                     ))}
                                  </div>
                               </div>

                               <button 
                                 onClick={() => handleApprove(entry.id, entry.match_id!, entry.amount)}
                                 title="Confirm and record this payment match"
                                 className="group/btn relative w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                               >
                                  Confirm & Scribe Payment
                                  <ArrowUpRight size={18} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                               </button>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                               <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center">
                                  <X size={32} />
                               </div>
                               <div>
                                  <p className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-1">Unmatched Transaction</p>
                                  <p className="text-xs font-medium text-gray-500 max-w-[200px]">No high-confidence invoices found for this amount or description.</p>
                               </div>
                               <button
                                  title="Manually connect this transaction to an invoice"
                                  onClick={() => setToast({ message: 'Manual linking workspace is next in the review queue.', type: 'info' })}
                                  className="px-6 py-2 bg-gray-100 dark:bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-brand-purple hover:text-white transition-all"
                               >
                                  Manual Connect
                               </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {visibleMatches.filter(m => m.status !== 'completed').length === 0 && (
                <div className="rounded-[2.5rem] border border-dashed border-gray-300 bg-white/70 p-10 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-dark-surface/60 dark:text-gray-400">
                  No reconciliation entries match the current search and queue filter.
                </div>
              )}

              {visibleMatches.filter(m => m.status === 'completed').length > 0 && (
                <div className="pt-10">
                   <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      Recently Scribed ({visibleMatches.filter(m => m.status === 'completed').length})
                   </h3>
                   <div className="space-y-3 opacity-60">
                      {visibleMatches.filter(m => m.status === 'completed').map(entry => (
                        <div key={entry.id} className="bg-white/50 dark:bg-dark-surface/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <CheckCircle2 className="text-emerald-500" size={20} />
                              <div>
                                 <p className="text-sm font-black">{entry.description}</p>
                                 <p className="text-[10px] text-gray-400 font-mono">{entry.reference}</p>
                              </div>
                           </div>
                           <p className="font-black">Ksh {entry.amount.toLocaleString()}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-8 h-fit lg:sticky lg:top-8">
               {/* Summary Card */}
               <div className="bg-white dark:bg-dark-surface p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
                  <div className="relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-10">Statement Summary</h3>
                    
                    <div className="space-y-8">
                        <div className="flex justify-between items-end">
                          <div>
                             <p className="text-[10px] font-black text-gray-400 uppercase">Total Volume</p>
                             <p className="text-3xl font-black tracking-tighter">Ksh {queueSummary.totalVolume.toLocaleString()}</p>
                          </div>
                          <button 
                            onClick={() => setStatementEntries([])}
                            title="Clear all statement entries"
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                             <X size={20} />
                          </button>
                       </div>

                       <div className="space-y-4">
                          <div className="flex justify-between text-xs font-black uppercase">
                             <span className="text-gray-400">Perfect Matches</span>
                             <span className="text-emerald-500">{queueSummary.exactMatches}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-emerald-500 transition-all duration-1000 dynamic-width-bar" 
                               style={{ '--bar-width': `${(queueSummary.exactMatches / (statementEntries.length || 1)) * 100}%` } as React.CSSProperties}
                             />
                          </div>
                       </div>

                       <div className="space-y-4">
                          <div className="flex justify-between text-xs font-black uppercase">
                             <span className="text-gray-400">Probable</span>
                             <span className="text-amber-500">{queueSummary.probableMatches}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-amber-500 transition-all duration-1000 dynamic-width-bar" 
                               style={{ '--bar-width': `${(queueSummary.probableMatches / (statementEntries.length || 1)) * 100}%` } as React.CSSProperties}
                             />
                          </div>
                       </div>

                       <div className="space-y-4">
                          <div className="flex justify-between text-xs font-black uppercase">
                             <span className="text-gray-400">Review Queue</span>
                             <span className="text-rose-500">{queueSummary.reviewQueue}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                             <div
                               className="h-full bg-rose-500 transition-all duration-1000 dynamic-width-bar"
                               style={{ '--bar-width': `${(queueSummary.reviewQueue / (statementEntries.length || 1)) * 100}%` } as React.CSSProperties}
                             />
                          </div>
                       </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 rounded-full blur-3xl group-hover:bg-brand-purple/10 transition-all" />
               </div>

               {/* Action Card */}
               <div className="bg-brand-purple p-10 rounded-[3rem] text-white shadow-2xl shadow-brand-purple/20 relative overflow-hidden group">
                  <div className="relative z-10">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-purple-light mb-6">Master Action</h3>
                     <p className="text-2xl font-black mb-10 leading-snug">Scribe All Perfect Matches</p>
                     
                     <button 
                       onClick={handleBatchApprove}
                       disabled={isProcessing || queueSummary.exactMatches === 0}
                       title="Execute reconciliation for all perfect matches in bulk"
                       className="w-full py-5 bg-white text-brand-purple rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-brand-pink hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-brand-purple transition-all flex items-center justify-center gap-2 group/bulk"
                     >
                        {isProcessing ? 'Reconciling...' : 'Execute Batch'}
                        <ChevronRight size={16} className="group-hover/bulk:translate-x-1 transition-transform" />
                     </button>

                     <p className="mt-5 text-xs text-brand-purple-light/80 leading-relaxed">
                        Perfect matches can be posted in bulk, while probable and review items stay visible for human confirmation.
                     </p>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
               </div>
            </div>
          </div>
          </div>
        )}
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
