// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, CreditCard, Send, FileText, User } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import { callDaraja } from '../../services/darajaService';

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true);
      const { data, error } = await supabase.from('re_invoices').select('*, tenant:re_tenants(*), unit:re_units(*, property:re_properties(name))').eq('public_invoice_token', token).single();
      if (error) {
        setToast({ message: 'Invoice not found or link expired.', type: 'error' });
        setLoading(false);
        return;
      }
      setInvoice(data);
      setTenant(data.tenant);
      setUnit(data.unit);
      setPhone(data.tenant?.phone || '');
      setLoading(false);
    };
    void load();
  }, [token]);

  const sendStk = async () => {
    if (!invoice) return;
    const msisdn = phone.trim() || tenant?.phone || '';
    if (!msisdn) {
      setToast({ message: 'Please enter a phone number for STK.', type: 'warning' });
      return;
    }
    setSending(true);
    try {
      const balance = Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));
      const response = await callDaraja({
        action: 'stk-push',
        amount: Math.round(balance),
        phoneNumber: msisdn,
        accountReference: invoice.invoice_number || 'HAKIKA',
        transactionDesc: `Hakika invoice ${invoice.invoice_number || ''}`,
        service_key: 'hakika',
      } as any);
      setToast({ message: response?.response?.CustomerMessage || 'STK push sent.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to send STK push.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><CustomLoader label="Loading invoice..." /></div>;
  if (!invoice) return <div className="min-h-screen flex items-center justify-center text-gray-500">Invoice not found.</div>;

  const balance = Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff_0%,_#f5f7fb_35%,_#e9eef7_100%)] p-6 md:p-10">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/60 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-purple">Tenant Invoice Portal</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-slate-500">View your bill and send an STK push if you want to pay right away.</p>
          </div>
          <div className="rounded-2xl bg-brand-purple/10 p-4 text-brand-purple">
            <FileText className="h-7 w-7" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenant</p>
            <p className="mt-2 font-black text-slate-900">{tenant ? getTenantDisplayName(tenant) : 'Unassigned'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit</p>
            <p className="mt-2 font-black text-slate-900">{unit?.unit_number || 'N/A'}</p>
            <p className="text-xs text-slate-500">{unit?.property?.name || ''}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance</p>
            <p className="mt-2 font-black text-slate-900">Ksh {balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Invoice details</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p><Calendar className="inline h-4 w-4 mr-2 text-brand-purple" />Invoice date: {invoice.invoice_date || 'N/A'}</p>
              <p><CreditCard className="inline h-4 w-4 mr-2 text-brand-purple" />Due date: {invoice.due_date || 'N/A'}</p>
              <p><User className="inline h-4 w-4 mr-2 text-brand-purple" />Status: {invoice.status || 'unpaid'}</p>
            </div>
          </div>

          <div className="rounded-3xl bg-brand-purple text-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">Pay now</p>
            <p className="mt-3 text-4xl font-black">Ksh {balance.toLocaleString()}</p>
            <p className="mt-2 text-sm text-white/80">Tap below to request an STK push to your phone.</p>
            <div className="mt-4 space-y-3">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/60 outline-none" placeholder="Phone number" />
              <button onClick={sendStk} disabled={sending} className="w-full rounded-2xl bg-white px-4 py-3 font-black text-brand-purple disabled:opacity-50">
                <Send className="inline h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send STK Push'}
              </button>
            </div>
          </div>
        </div>

        {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
