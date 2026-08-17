// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, Phone, Save, ShieldCheck, Sparkles, User, Sun, Moon, X, Zap, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { supabase } from '../../utils/supabase';

type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

type Tenant = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  emergency_contacts: EmergencyContact[] | null;
  login_username: string | null;
  login_sent_at: string | null;
  current_unit_id: string | null;
  id_document_url?: string | null;
  profile_image_url?: string | null;
  unit?: {
    unit_number: string | null;
    property?: {
      name: string | null;
    } | null;
  } | null;
  latest_lease?: {
    deposit_amount?: number | null;
    water_deposit_amount?: number | null;
    electricity_deposit_amount?: number | null;
  } | null;
};

const emptyContact: EmergencyContact = { name: '', relationship: '', phone: '' };

export default function TenantPortalProfilePage() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([{ ...emptyContact }]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  useEffect(() => {
    const load = async () => {
      if (!profile?.email) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('re_tenants')
          .select('id, full_name, phone, email, emergency_contacts, login_username, login_sent_at, current_unit_id, id_document_url, profile_image_url, unit:re_units!current_unit_id(unit_number, property:re_properties(name))')
          .or(`email.eq.${profile.email},login_username.eq.${profile.email.split('@')[0]}`)
          .maybeSingle();

        if (error) throw error;

        const nextTenant = data as Tenant | null;
        const leaseRes = await supabase
          .from('re_leases')
          .select('deposit_amount, water_deposit_amount, electricity_deposit_amount, created_at')
          .eq('tenant_id', nextTenant?.id || '')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const latestLease = leaseRes.data || null;
        setTenant(nextTenant ? { ...nextTenant, latest_lease: latestLease || undefined } : null);
        setFullName(nextTenant?.full_name || '');
        setEmail(
          nextTenant?.email && !nextTenant.email.endsWith('@tenant.local')
            ? nextTenant.email
            : '',
        );
        setPhone(nextTenant?.phone || '');
        setContacts(
          nextTenant?.emergency_contacts && nextTenant.emergency_contacts.length > 0
            ? nextTenant.emergency_contacts
            : [{ ...emptyContact }],
        );
      } catch (error: any) {
        console.error('Failed to load tenant profile', error);
        setToast({ message: error?.message || 'Failed to load profile', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [profile?.email]);

  const hasChanges = useMemo(() => {
    if (!tenant) return false;
    const normalizedContacts = JSON.stringify((contacts || []).map((contact) => ({
      name: contact.name.trim(),
      relationship: contact.relationship.trim(),
      phone: contact.phone.trim(),
    })));
    return (
      fullName.trim() !== (tenant.full_name || '').trim()
      || email.trim() !== ((tenant.email && !tenant.email.endsWith('@tenant.local')) ? tenant.email : '').trim()
      || phone.trim() !== (tenant.phone || '').trim()
      || normalizedContacts !== JSON.stringify((tenant.emergency_contacts || []).map((contact) => ({
        name: (contact?.name || '').trim(),
        relationship: (contact?.relationship || '').trim(),
        phone: (contact?.phone || '').trim(),
      })))
    );
  }, [contacts, email, fullName, phone, tenant]);

  const updateContact = (index: number, field: keyof EmergencyContact, value: string) => {
    setContacts((prev) => prev.map((contact, contactIndex) => (contactIndex === index ? { ...contact, [field]: value } : contact)));
  };

  const addContact = () => setContacts((prev) => [...prev, { ...emptyContact }]);

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, contactIndex) => contactIndex !== index).length > 0
      ? prev.filter((_, contactIndex) => contactIndex !== index)
      : [{ ...emptyContact }]);
  };

  const saveProfile = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const sanitizedContacts = contacts
        .map((contact) => ({
          name: contact.name.trim(),
          relationship: contact.relationship.trim(),
          phone: contact.phone.trim(),
        }))
        .filter((contact) => contact.name || contact.relationship || contact.phone);

      const { error } = await supabase
        .from('re_tenants')
        .update({
          full_name: fullName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          emergency_contacts: sanitizedContacts,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      setToast({ message: 'Profile updated successfully.', type: 'success' });
      setTenant((prev) => prev ? { ...prev, full_name: fullName.trim() || null, email: email.trim() || null, phone: phone.trim() || null, emergency_contacts: sanitizedContacts } : prev);
    } catch (error: any) {
      console.error('Failed to save tenant profile', error);
      setToast({ message: error?.message || 'Failed to save profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0b2a3c] transition-colors duration-300">
        <CustomLoader label="Loading Profile..." />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0b2a3c] p-6">
        <div className="max-w-md w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-8 text-center shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#c89f5e]">Verification Error</p>
          <h1 className="mt-3 text-2xl font-black text-gray-900 dark:text-white">Profile not found</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/40">We could not match your account to a tenant profile.</p>
          <button
            onClick={() => navigate('/app/tenant/dashboard')}
            className="mt-6 w-full rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3.5 text-sm font-black transition-all shadow-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b2a3c] text-gray-900 dark:text-white selection:bg-[#c89f5e]/30 font-inter transition-colors duration-300">
      <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-gray-200 dark:border-white/5 pb-8">
          <div className="space-y-2">
            <button
              onClick={() => navigate('/app/tenant/dashboard')}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-[#c89f5e] transition-colors mb-2"
            >
              <ArrowLeft size={14} />
              Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-[#c89f5e]/20 blur-xl rounded-full" />
                {tenant.profile_image_url ? (
                  <img
                    src={tenant.profile_image_url}
                    alt={tenant.full_name || 'Tenant'}
                    className="relative h-28 w-28 rounded-full border-4 border-white object-cover shadow-xl"
                  />
                ) : (
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-[#c89f5e] to-[#a07840] text-white shadow-xl text-3xl font-black">
                    {(tenant.full_name || 'T').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-black tracking-tight">
                Account <span className="text-[#c89f5e]">Profile</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app/tenant/payments')}
              className="p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all shadow-sm group"
              title="Payment History"
            >
              <Activity size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all shadow-sm"
            >
              {isDark ? <Sun size={18} className="text-[#c89f5e]" /> : <Moon size={18} className="text-gray-500" />}
            </button>
            <button
              onClick={saveProfile}
              disabled={!hasChanges || saving}
              className="px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-xs shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Zap size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#c89f5e]/10 flex items-center justify-center text-[#c89f5e]">
                  <Sparkles size={18} />
                </div>
                <h3 className="text-lg font-black tracking-tight">Personal Information</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name" icon={<User size={14} />} value={fullName} onChange={setFullName} placeholder="Full Name" />
                <Field label="Email Address" icon={<Mail size={14} />} value={email} onChange={setEmail} placeholder="Add your real email address" type="email" />
                <Field label="Phone Number" icon={<Phone size={14} />} value={phone} onChange={setPhone} placeholder="Phone" />
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-100 dark:border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">ID Document</p>
                  <p className="mt-1 font-black text-sm text-gray-700 dark:text-white/80">
                    {tenant.id_document_url ? 'Attached' : 'Not attached'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-100 dark:border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Account Username</p>
                  <p className="mt-1 font-black text-sm text-gray-700 dark:text-white/80">{tenant.login_username || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <ShieldCheck size={18} />
                  </div>
                  <h3 className="text-lg font-black tracking-tight">Emergency Contacts</h3>
                </div>
                <button
                  onClick={addContact}
                  className="px-4 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  Add New
                </button>
              </div>

              <div className="space-y-4">
                {contacts.map((contact, index) => (
                  <div key={index} className="p-4 rounded-2xl bg-gray-50/50 dark:bg-white/2 border border-gray-100 dark:border-white/5 relative group">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Name" icon={<User size={12} />} value={contact.name} onChange={(v) => updateContact(index, 'name', v)} placeholder="Name" />
                      <Field label="Relationship" icon={<ShieldCheck size={12} />} value={contact.relationship} onChange={(v) => updateContact(index, 'relationship', v)} placeholder="Relation" />
                      <Field label="Phone" icon={<Phone size={12} />} value={contact.phone} onChange={(v) => updateContact(index, 'phone', v)} placeholder="Phone" />
                    </div>
                    {contacts.length > 1 && (
                      <button
                        onClick={() => removeContact(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c89f5e] mb-4">Unit Assignment</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-white/40">Unit Number</span>
                  <span className="text-sm font-black">{tenant.unit?.unit_number || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-white/40">Property</span>
                  <span className="text-sm font-black truncate max-w-[150px]">{tenant.unit?.property?.name || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Security Deposit</p>
                    <p className="mt-1 text-sm font-black">{tenant.latest_lease?.deposit_amount ? `Ksh ${Number(tenant.latest_lease.deposit_amount).toLocaleString()}` : 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Water / Electricity Deposit</p>
                    <p className="mt-1 text-sm font-black">
                      {(Number(tenant.latest_lease?.water_deposit_amount || 0) + Number(tenant.latest_lease?.electricity_deposit_amount || 0)) > 0
                        ? `Ksh ${(Number(tenant.latest_lease?.water_deposit_amount || 0) + Number(tenant.latest_lease?.electricity_deposit_amount || 0)).toLocaleString()}`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#c89f5e]/5 rounded-full blur-2xl" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={16} />
                  </div>
                  <h3 className="text-base font-black tracking-tight">Account Status</h3>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-white/40 leading-relaxed font-medium">
                  Your profile is verified. Credentials last sent on:
                </p>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-100 dark:border-white/5">
                  <p className="text-[10px] font-black text-gray-500 dark:text-white/60">
                    {tenant.login_sent_at ? new Date(tenant.login_sent_at).toLocaleString() : 'Not sent'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <CustomToast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-white/30">
        {icon}
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-2.5 text-sm outline-none transition-all focus:border-[#c89f5e]/40 dark:focus:bg-white/10"
      />
    </label>
  );
}
