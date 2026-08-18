// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, Calendar, Clock, Download, Edit2,
  FileText, XCircle, AlertTriangle, CheckCircle, Loader2, Printer,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface Lease {
  id: string;
  lease_number: string;
  tenant_id: string;
  unit_id: string;
  property_id: string;
  rent_amount: number;
  deposit_amount: number;
  water_deposit_amount?: number | null;
  electricity_deposit_amount?: number | null;
  deposit_paid_to?: string | null;
  start_date: string;
  end_date?: string | null;
  payment_day: number;
  duration_months?: number;
  status: 'active' | 'expired' | 'terminated' | 'pending';
  lease_doc_url?: string | null;
  created_at: string;
  tenant?: { id: string; full_name: string | null; national_id?: string | null; phone?: string | null; profile?: { full_name?: string | null; email?: string | null } | null } | null;
  unit?: { id: string; unit_number: string; property?: { id?: string; name: string; address?: string | null } | null } | null;
  property?: { id?: string; name: string; address?: string | null } | null;
  landlord?: { id: string; full_name: string } | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':     return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800/30';
    case 'expired':    return 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/40 border-gray-200 dark:border-white/10';
    case 'terminated': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/30';
    case 'pending':    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/30';
    default:           return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const getTenantName = (lease: Lease) =>
  lease.tenant ? getTenantDisplayName(lease.tenant as any) : 'Unknown Tenant';

const getPropertyName = (lease: Lease) => {
  const prop = lease.unit?.property ?? lease.property;
  if (Array.isArray(prop)) return prop[0]?.name ?? 'Unknown Property';
  return prop?.name ?? 'Unknown Property';
};

const getPropertyAddress = (lease: Lease) => {
  const prop = lease.unit?.property ?? lease.property;
  if (Array.isArray(prop)) return prop[0]?.address ?? '';
  return (prop as any)?.address ?? '';
};

const getUnitNumber = (lease: Lease) => lease.unit?.unit_number ?? '—';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDay = (n: number) => {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
};

// --- Generate the full agreement HTML ----------------------------------------
function buildAgreementHTML(lease: Lease): string {
  const tenantName   = getTenantName(lease).toUpperCase();
  const tenantId     = lease.tenant?.national_id ?? '';
  const landlordName = lease.landlord?.full_name
    ? lease.landlord.full_name.toUpperCase()
    : '................................................................';
  const propertyRef = getPropertyName(lease);
  const address     = getPropertyAddress(lease) || 'ISIOLO, KENYA';
  const unitNo      = getUnitNumber(lease);
  const startDate   = fmt(lease.start_date);
  const endDate     = lease.end_date ? fmt(lease.end_date) : 'Open-ended';
  const rent        = Number(lease.rent_amount || 0).toLocaleString();
  const deposit     = Number(lease.deposit_amount || 0).toLocaleString();
  const totalDeposit = (
    Number(lease.deposit_amount || 0) +
    Number(lease.water_deposit_amount || 0) +
    Number(lease.electricity_deposit_amount || 0)
  ).toLocaleString();
  const payDay      = fmtDay(lease.payment_day || 1);
  const depositPaidTo = lease.deposit_paid_to || 'landlord';
  const agreementDate = fmt(lease.start_date);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Tenancy Agreement – ${tenantName}</title>
<style>
  @page { margin: 2.5cm 2cm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; font-size: 13pt; color: #000; line-height: 1.7; margin: 0; padding: 0; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px 50px; }
  h1 { text-align: center; font-size: 16pt; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 4px; }
  h2 { text-align: center; font-size: 13pt; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 24px; }
  .intro { margin-bottom: 20px; }
  .party-line { margin: 12px 0; }
  .party-label { font-weight: bold; }
  .section-title { font-weight: bold; margin: 20px 0 6px; }
  ol { margin: 0; padding-left: 24px; }
  ol li { margin-bottom: 12px; }
  .sub-ol { list-style-type: lower-alpha; margin-top: 8px; }
  .sub-ol li { margin-bottom: 8px; }
  .bold { font-weight: bold; }
  .signature-block { margin-top: 60px; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-col { width: 45%; }
  .sig-line { border-bottom: 1px solid #000; height: 32px; margin-bottom: 6px; }
  .sig-label { font-size: 11pt; }
  .date-line { margin-top: 8px; font-size: 11pt; }
  .footer { margin-top: 40px; font-size: 10pt; text-align: center; color: #555; border-top: 1px solid #ccc; padding-top: 10px; }
  @media print {
    body { font-size: 12pt; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">

  <h1>Republic of Kenya</h1>
  <h2>Tenancy Agreement</h2>

  <div class="intro">
    <p>This tenancy agreement is made on this day <span class="bold">1 of ${agreementDate}</span> between <span class="bold">Hakika Real Estate Limited</span> of P.O Box 597-60300, Isiolo Telephone 0711082124 (hereinafter referred to as the "Managing Agents" which expression shall where the context so admits include its personal representatives, assigns and administrators) on behalf of</p>

    <div class="party-line">
      <span class="party-label">Name: ${landlordName}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;of P. O BOX
    </div>
    <p>Landlord: hereinafter referred to as the "Landlord" (which expression shall where the context so admits include its personal representatives, assign and administrators) on one part and</p>

    <div class="party-line">
      <span class="party-label">Name: &nbsp;&nbsp;${tenantName}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;id number: &nbsp;&nbsp;<span class="bold">${tenantId || '................................'}</span>
    </div>
    <p>Tenant: hereinafter referred to as the "Tenant" (which expression shall where the context so admits include its personal representatives, assign and administrators) on the other Part.</p>
  </div>

  <p class="section-title">Tenant hereby agrees with the Landlord and Landlord Agent as follows:</p>

  <ol>
    <li>The Landlord has delegated powers and authority to Hakika Real Estate Limited to let and the Tenant shall take all that part of the Landlords property known as <span class="bold">${propertyRef}</span> unit number <span class="bold">${unitNo}</span> situated at <span class="bold">${address}</span>, Kenya.</li>

    <li>To pay a Gate Key Deposit equivalent to one month's rent to Hakika Real Estate<br/>
      <span class="bold">Equity Bank Account No: 0410279348437 Paybill No 247247</span><br/>
      on or before commencement of tenancy. The Gate Key Deposit will under no circumstances be utilized as rent for any particular months. The Gate Key Deposit will be refunded without interest to the Tenant at the termination of the agreement. Deposit recipient: <span class="bold">${depositPaidTo.toUpperCase()}</span>.</li>

    <li>To pay rent of Kenya Shillings <span class="bold">${rent}</span> per month payable monthly without any deductions whatsoever. The rent shall be paid on the <span class="bold">${payDay}</span> Day of each month to the Landlords bank account. Upon payment the Tenant shall be required to immediately submit the original banking slip to Hakika Real Estate Office or send via <em>WhatsApp the receipt</em> to <em>0737739547</em>. The Tenant who opts to pay rent through M-Pesa shall be required to send the <em>M-Pesa reference</em> text to <em>0737739547</em>. Rent paid past midnight of the 5th day of every month shall attract a late rent fee charge of 10% rent to be paid as additional rent.</li>

    <li>To pay all electricity bill account number………………and water charges account number…………… in respect of demised premises during the tenancy period and present evidence of paid bills on a monthly basis. Any withstanding bills may be reserved in the same manner as the rent.</li>

    <li>It is assumed that the Tenant has inspected the demised premises and accepted to take the property as is prior to or during the signing of this contract.</li>

    <li>To pay Kenya Shillings ………………………………… as tenancy fees being the cost of preparation of this tenancy agreement.</li>

    <li>To keep the interior of all the buildings forming part of the premises including all the doors, windows, keys, all water taps, baths, showers, light fittings and all other Landlords fixtures and fittings well and sufficiently clean and in good state of repair and condition, and to make good any damage to the premises that may be caused by that tenant, his family, employee or guest and to yield up to the premises in like repair and condition at expiration or sooner determination of the said term including replacing all lost, broken or damaged items with items of similar kind and quality.</li>

    <li>To permit the landlord or his agent during the said term at all reasonable times with or without a workman to enter upon and view the conditions of the premises. And in any case any defect or want of repair to be found which the Tenant is liable to make good under this agreement the Landlord may serve notice in writing thereof upon the Tenant or leave such notice upon the premises or send such notice by registered post requiring the Tenant to make good such defect. And should the Tenant fail to make good the said defects or repairs specified in the said notice, then the Landlord shall be entitled to enter upon your premises with workmen or agents and affect the said repairs and the costs thereof shall be a debt due to the Landlord by the Tenant and be forthwith recoverable by actions.</li>

    <li>To use said premises as a private dwelling house only and not to carry on any form of business nor use the same as a boarding house nor any other purpose without written consent of the Landlord.</li>

    <li>Not to transfer, Lease, Sublet, Charge or part with the possession of the premises or any part thereof with first obtaining the prior written consent of the Landlord.</li>

    <li>Not to make any alterations in or additional to the premises (Including boundary walls and fences) or erect any kind of fixtures therein without the prior written consent of the Landlord And subject to the Landlords requirements. Any such alterations, additional or erections shall be removed, restored or repaired by the Tenant and the Tenants sole cost at the expiration or sooner determination of the said term the Tenant making good all the damages occasioned by such removal, restoration or repair.</li>

    <li>Not to drive any Nails, screws, bolts or wedges in floors, walls, ceiling of any building forming part of the premises without first obtaining prior consent in writing of the Landlord. Not to bring in pets or any animal in the Let premises without the prior written consent of the Landlord.</li>
  </ol>

  <p class="section-title">The Landlord hereby consents with the Tenant as follows:</p>

  <ol start="13">
    <li>
      <ol class="sub-ol">
        <li>To do all structured repairs to the walls, floors, roof, ceiling of the said premises except where such repairs is due to any default or neglect of the Tenant.</li>
        <li>To deliver said premises to the Tenant in a good and tenant-able state of repair with all internal walls painted.</li>
        <li>To permit the tenant paying rent hereby reserved and performing and observing the covenants agreements conditions, stipulations and provisions herein contained or implied and on its part to be performed and observed peacefully and quietly to possess and enjoy the premises during the term without any interruption form the Landlord or his agents.</li>
      </ol>
    </li>

    <li>Provided always and its hereby agreed and declared that:
      <ol class="sub-ol">
        <li>If the rent reserved shall not have been paid by Fourteen (14) days from the date it is due the Landlord may re-enter into and upon the premises or any part of thereof in the name of the whole and to resume possession of the premises and to repossess and enjoy as In the Landlords former state anything herein contained to the contrary in anywise notwithstanding without prejudice to any right of action or remedy of the Landlord in respect of any antecedent breach of any covenants, agreements, conditions, restrictions, stipulations or provisions contained or implied and on the part of the Tenant to be performed and observed Provided That the Landlord shall give the Tenant at least Fourteen (14) days' notice to make good any breach before exercising his right of re-entry under this clause.</li>
        <li>On termination of tenancy or issuing notice to vacate, the Tenant will redecorate the premises internally in a good and workmanlike manner at his expense and to the satisfaction of the Landlord with two (2) coats of good quality paint and varnish in the said term.</li>
        <li>Either the Tenant or the Landlord may terminate this agreement by giving the other not less than one (1) month prior notice in writing to this effect or incise of the Tenant choosing to terminate the agreement by paying to the Landlord one (1) month rent in lieu notice and upon termination of the agreement any advance rent paid by the Tenant to the Landlord shall be reimbursed upon the Landlord being satisfied that the premises have been yielded in accordance with the terms of this agreement. The notice must expire at the end of a calendar month.</li>
      </ol>
    </li>
  </ol>

  <p style="margin-top:24px;">This agreement shall be governed by and construed in accordance with the Laws of Kenya.</p>
  <p>And the Tenant hereby accepts this tenancy subject to the above conditions.</p>
  <p>In Witness Whereof the Landlord and the Tenant have executed this agreement the day, month and year first herein before written.</p>

  <p><span class="bold">Signed, Sealed and Delivered by:</span></p>

  <div class="signature-block">
    <div class="sig-row">
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label"><strong>Landlord or Landlord Authorized Agent</strong></div>
        <div class="date-line">Date: ……………………………</div>
      </div>
      <div class="sig-col" style="text-align:right;">
        <div style="border: 1px solid #999; padding: 8px; font-size: 10pt; text-align: left; min-height: 60px;">
          <strong>HAKIKA REAL ESTATE</strong><br/>
          Email: info@hakikarealestate.co.ke<br/>
          Tel: 0711082124<br/>
          P.O. Box 597-60300, ISIOLO
        </div>
      </div>
    </div>

    <div class="sig-row">
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label"><strong>${tenantName}</strong></div>
        <div class="sig-label">Tenant</div>
        <div class="date-line">Date: ……………………………</div>
      </div>
      <div class="sig-col">
        <div class="sig-line"></div>
        <div class="sig-label">Witness</div>
        <div class="date-line">Date: ……………………………</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Lease No: ${lease.lease_number} &nbsp;|&nbsp; Generated by Hakika app &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-KE')}
  </div>
</div>
</body>
</html>`;
}

export default function LeaseDetailPage() {
  const { leaseId } = useParams<{ leaseId: string }>();
  const navigate = useNavigate();

  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!leaseId) return;
      setLoading(true);
      try {
        const { data: leaseData, error } = await supabase
          .from('re_leases')
          .select('*')
          .eq('id', leaseId)
          .maybeSingle();

        if (error) throw error;
        if (!leaseData) { setLease(null); return; }

        const [tenantRes, unitRes, propertyRes, landlordRes] = await Promise.all([
          leaseData.tenant_id
            ? supabase.from('re_tenants').select('id, full_name, national_id, phone').eq('id', leaseData.tenant_id).maybeSingle()
            : Promise.resolve({ data: null }),
          leaseData.unit_id
            ? supabase.from('re_units').select('id, unit_number, property:re_properties(id, name, address)').eq('id', leaseData.unit_id).maybeSingle()
            : Promise.resolve({ data: null }),
          leaseData.property_id
            ? supabase.from('re_properties').select('id, name, address').eq('id', leaseData.property_id).maybeSingle()
            : Promise.resolve({ data: null }),
          // Fetch the landlord linked to this property from re_personnel
          leaseData.property_id
            ? supabase.from('re_personnel').select('id, full_name').eq('role', 'landlord').eq('property_id', leaseData.property_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        setLease({
          ...leaseData,
          tenant: tenantRes.data ?? null,
          unit: unitRes.data ?? null,
          property: propertyRes.data ?? null,
          landlord: landlordRes.data ?? null,
        } as Lease);
      } catch (err: any) {
        setToast({ message: err?.message || 'Failed to load lease', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [leaseId]);

  const handleTerminate = async () => {
    if (!lease) return;
    if (!window.confirm('Are you sure you want to terminate this lease? This will release the unit.')) return;
    setTerminating(true);
    try {
      const { error: leaseErr } = await supabase.from('re_leases').update({ status: 'terminated' }).eq('id', lease.id);
      if (leaseErr) throw leaseErr;
      if (lease.unit_id) await supabase.from('re_units').update({ status: 'vacant' }).eq('id', lease.unit_id);
      setLease((prev) => prev ? { ...prev, status: 'terminated' } : prev);
      setToast({ message: 'Lease terminated and unit released.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to terminate lease', type: 'error' });
    } finally {
      setTerminating(false);
    }
  };

  // Open the full agreement in a new window and trigger print/save-as-PDF
  const handlePrintAgreement = () => {
    if (!lease) return;
    if (lease.lease_doc_url) { window.open(lease.lease_doc_url, '_blank'); return; }

    // Build HTML with an onload auto-print so the browser renders fully before printing
    let html = buildAgreementHTML(lease);
    // Inject auto-print script just before </body>
    html = html.replace(
      '</body>',
      '<script>window.onload = function() { window.focus(); window.print(); };<\/script></body>'
    );

    const win = window.open('', '_blank');
    if (!win) {
      setToast({ message: 'Pop-up blocked. Please allow pop-ups for this site.', type: 'error' });
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-dark-bg">
      <CustomLoader label="Loading lease..." />
    </div>
  );

  if (!lease) return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-dark-bg p-6">
      <div className="text-center max-w-sm">
        <AlertTriangle size={40} className="mx-auto mb-4 text-amber-500" />
        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Lease not found</h2>
        <p className="text-sm text-gray-500 dark:text-white/40 mb-6">This lease may have been deleted or the link is invalid.</p>
        <button onClick={() => navigate('/app/real-estate/leases')} className="px-6 py-2.5 rounded-xl bg-brand-purple text-white font-bold text-sm hover:opacity-90 transition-all">
          Back to Leases
        </button>
      </div>
    </div>
  );

  const tenantName  = getTenantName(lease);
  const propertyName = getPropertyName(lease);
  const unitNumber  = getUnitNumber(lease);
  const isOrphan    = !lease.tenant || !lease.unit;
  const depositPaidTo = lease.deposit_paid_to || 'landlord';
  const totalDeposit = (
    Number(lease.deposit_amount || 0) +
    Number(lease.water_deposit_amount || 0) +
    Number(lease.electricity_deposit_amount || 0)
  ).toLocaleString();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="mx-auto max-w-3xl p-4 md:p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/real-estate/leases')} className="p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all" title="Back to leases">
            <ArrowLeft size={18} className="text-gray-500 dark:text-white/50" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <FileText size={22} className="text-brand-purple shrink-0" /> Lease Details
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${getStatusColor(lease.status)}`}>{lease.status}</span>
            </div>
            <p className="text-[11px] font-mono text-brand-purple font-bold uppercase mt-1 tracking-widest">#{lease.lease_number}</p>
          </div>
        </div>

        {/* Orphan warning */}
        {isOrphan && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
            <p className="font-bold mb-1 flex items-center gap-2"><AlertTriangle size={16} /> Relationship mismatch</p>
            <p className="text-xs">Tenant, unit, or property link is missing.</p>
            <p className="mt-2 font-mono text-xs break-all opacity-70">Tenant ID: {lease.tenant_id} | Unit ID: {lease.unit_id} | Property ID: {lease.property_id}</p>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">

          {/* Tenant + Lease # */}
          <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tenant</p>
              <p className="text-xl font-black text-gray-900 dark:text-white">{tenantName}</p>
              {lease.tenant?.national_id && <p className="text-xs text-gray-400 mt-0.5">ID: {lease.tenant.national_id}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Lease #</p>
              <p className="font-mono text-brand-purple font-bold uppercase">{lease.lease_number}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100 dark:bg-white/5">
            {[
              { label: 'Monthly Rent',  value: `Ksh ${Number(lease.rent_amount || 0).toLocaleString()}` },
              { label: 'Deposit',       value: `Ksh ${Number(lease.deposit_amount || 0).toLocaleString()}` },
              { label: 'Water Deposit', value: `Ksh ${Number(lease.water_deposit_amount || 0).toLocaleString()}` },
              { label: 'Electricity Deposit', value: `Ksh ${Number(lease.electricity_deposit_amount || 0).toLocaleString()}` },
              { label: 'Deposit To',    value: depositPaidTo },
              { label: 'Term',          value: lease.duration_months ? `${lease.duration_months} months` : '—' },
              { label: 'Payment Day',   value: lease.payment_day ? `Day ${lease.payment_day}` : '—' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-dark-surface p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-base font-black text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Building2 size={16} className="text-brand-purple shrink-0" />
              <span><span className="font-bold text-gray-900 dark:text-white">{propertyName}</span> — Unit {unitNumber}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Calendar size={16} className="text-brand-purple shrink-0" />
              <span>{new Date(lease.start_date).toLocaleDateString()} — {lease.end_date ? new Date(lease.end_date).toLocaleDateString() : 'Open-ended'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Clock size={16} className="text-brand-purple shrink-0" />
              <span>Rent due on day {lease.payment_day} of every month</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FileText size={16} className="text-brand-purple shrink-0" />
              <span>Created {new Date(lease.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-0 flex flex-col gap-3">
            <button
              onClick={() => navigate(`/app/real-estate/leases?edit=${lease.id}`)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            >
              <Edit2 size={16} /> Edit Lease Assignment
            </button>

            <button
              onClick={handlePrintAgreement}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-purple text-white rounded-xl font-bold hover:bg-brand-pink transition-all shadow-lg shadow-brand-purple/20"
            >
              <Printer size={16} />
              {lease.lease_doc_url ? 'View Signed Lease' : 'Print / Download Agreement'}
            </button>

            {lease.status !== 'terminated' && (
              <button
                onClick={handleTerminate}
                disabled={terminating}
                className="w-full py-3 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all border border-transparent hover:border-red-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {terminating ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                {terminating ? 'Terminating...' : 'Terminate Lease'}
              </button>
            )}
            {lease.status === 'terminated' && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle size={16} /> This lease has been terminated
              </div>
            )}
          </div>
        </div>

        {/* Agreement preview card */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-purple/10 flex items-center justify-center text-brand-purple">
                <FileText size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black">Tenancy Agreement</h3>
                <p className="text-[9px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest">Republic of Kenya — Full Agreement</p>
              </div>
            </div>
            <button
              onClick={handlePrintAgreement}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-purple text-white text-xs font-black uppercase tracking-widest hover:bg-brand-pink transition-all"
            >
              <Printer size={13} /> Print / Save PDF
            </button>
          </div>
          <div className="p-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-bold text-center text-gray-900 dark:text-white text-base">Republic of Kenya — TENANCY AGREEMENT</p>
            <p>This agreement is between <strong>Hakika Real Estate Limited</strong> (Managing Agents) on behalf of the Landlord, and <strong>{tenantName}</strong> (Tenant) for the premises at <strong>{propertyName}</strong>, Unit <strong>{unitNumber}</strong>.</p>
            <p>Monthly rent: <strong>Ksh {Number(lease.rent_amount || 0).toLocaleString()}</strong> &nbsp;·&nbsp; Gate Key Deposit: <strong>Ksh {Number(lease.deposit_amount || 0).toLocaleString()}</strong> &nbsp;·&nbsp; Water deposit: <strong>Ksh {Number(lease.water_deposit_amount || 0).toLocaleString()}</strong> &nbsp;·&nbsp; Electricity deposit: <strong>Ksh {Number(lease.electricity_deposit_amount || 0).toLocaleString()}</strong> &nbsp;·&nbsp; Total deposits: <strong>Ksh {totalDeposit}</strong> &nbsp;·&nbsp; Deposit recipient: <strong>{depositPaidTo.toUpperCase()}</strong> &nbsp;·&nbsp; Payment due: <strong>Day {lease.payment_day}</strong> of each month.</p>
            <p className="text-[11px] text-gray-400 dark:text-white/30 italic">Click "Print / Save PDF" to open the full 4-page agreement with all 14 clauses, signature blocks, and Hakika letterhead — ready to print or save as PDF.</p>
          </div>
        </div>

      </div>

      {toast && <CustomToast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} />}
    </div>
  );
}
