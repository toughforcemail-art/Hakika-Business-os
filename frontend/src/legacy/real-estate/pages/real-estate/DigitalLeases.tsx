// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Plus, Search, Filter, Calendar, Building2, User, Home, 
  MoreVertical, CheckCircle, Clock, XCircle, Download, ImageIcon, ExternalLink
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { activityLogger } from '../../utils/activityLogger';
import { NotificationService } from '../../services/NotificationService';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface Property {
  id?: string;
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  property?: Property | Property[] | null;
  rent_amount: number;
  property_id?: string | null;
  status?: string | null;
  water_utility_account?: string | null;
  electricity_utility_account?: string | null;
}

interface Tenant {
  id: string;
  full_name: string | null;
  profile?: { full_name?: string | null; email?: string | null } | null;
  id_document_url?: string | null;
}

interface Lease {
  id: string;
  lease_number: string;
  tenant_id: string;
  unit_id: string;
  property_id: string;
  lease_type?: 'residential' | 'commercial';
  rent_amount: number;
  deposit_amount: number;
  start_date: string;
  end_date?: string | null;
  payment_day: number;

  status: 'active' | 'expired' | 'terminated' | 'pending';
  tenant: Tenant;
  unit: Unit;
  property: Property;
  lease_doc_url?: string;
  duration_months?: number;
  created_at: string;
}

export default function DigitalLeases() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [uploading, setUploading] = useState(false);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      setToast({ message: 'Uploading to secure storage...', type: 'info' as any });
      const url = await UnifiedStorageService.upload(file, {
        folder: '/leases',
        bucket: 'leases'
      });
      
      setFormData(prev => ({ ...prev, lease_doc_url: url }));
      setToast({ message: 'File uploaded successfully!', type: 'success' });
    } catch (error: any) {
      console.error('Upload Error:', error);
      setToast({ message: error.message || 'Upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const [showModal, setShowModal] = useState(false);
  const [showLeasePreview, setShowLeasePreview] = useState(false);
  const [generatedLeaseHtml, setGeneratedLeaseHtml] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    lease_type: 'residential' as 'residential' | 'commercial',
    tenant_id: '',
    property_id: '',
    unit_id: '',
    start_date: '',
    end_date: '',
    rent_amount: 0,
    deposit_amount: 0,
    payment_day: 1,
    duration_months: 12,
    lease_doc_url: ''
  });

  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [isEditingLease, setIsEditingLease] = useState(false);
  const [repairLeaseNumber, setRepairLeaseNumber] = useState('');
  const [repairResult, setRepairResult] = useState<Lease | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);

  const fetchLeaseData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('re_leases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leases list:', error.message);
      }
      setLeases(data || []);
    } catch (error: any) {
      console.error('Error fetching leases:', error);
    } finally {
      setLoading(false);
    }
  };

  // State for mapping names from IDs
  const [allUnits, setAllUnits] = useState<any[]>([]);

  const fetchDropdownData = async () => {
    try {
      const [tenantsRes, propertiesRes, unitsRes] = await Promise.all([
        supabase.from('re_tenants').select('id, full_name, id_document_url, profile:profiles(full_name, email)').eq('is_active', true).order('full_name'),
        supabase.from('re_properties').select('id, name').order('name'),
        supabase.from('re_units').select('id, unit_number, property_id, status, water_utility_account, electricity_utility_account')
      ]);

      if (tenantsRes.error) console.error('Error fetching tenants for dropdown:', tenantsRes.error.message);
      if (propertiesRes.error) console.error('Error fetching properties for dropdown:', propertiesRes.error.message);
      if (unitsRes.error) console.error('Error fetching all units for mapping:', unitsRes.error.message);

      setTenants(tenantsRes.data || []);
      setProperties(propertiesRes.data || []);
      setAllUnits(unitsRes.data || []);
    } catch (error) {
       console.error('Error in fetchDropdownData:', error);
    }
  };

  const getTenantName = (lease: Lease) => {
    const tenant = (lease as any)?.tenant || tenants.find(t => t.id === lease.tenant_id);
    return tenant ? getTenantDisplayName(tenant) : `Tenant ${lease.tenant_id?.slice(0, 8) || 'Unknown'}`;
  };
  const getPropertyName = (lease: Lease) => {
    return properties.find(p => p.id === lease.property_id)?.name || 'Unknown Property';
  };
  const getUnitNumber = (lease: Lease) => {
    return allUnits.find(u => u.id === lease.unit_id)?.unit_number || 'N/A';
  };

  const resolveLeaseContext = (lease: Lease) => ({
    tenantName: getTenantName(lease),
    propertyName: getPropertyName(lease),
    unitNumber: getUnitNumber(lease),
  });

  const getLeaseDebugInfo = (lease: Lease) => {
    const tenant = tenants.find(t => t.id === lease.tenant_id);
    const unit = allUnits.find(u => u.id === lease.unit_id);
    const property = properties.find(p => p.id === lease.property_id);
    return {
      tenantId: lease.tenant_id || 'N/A',
      unitId: lease.unit_id || 'N/A',
      propertyId: lease.property_id || 'N/A',
      tenantKnown: Boolean(tenant),
      unitKnown: Boolean(unit),
      propertyKnown: Boolean(property),
    };
  };

  const lookupLeaseByNumber = () => {
    const normalized = repairLeaseNumber.trim().toUpperCase();
    if (!normalized) {
      setRepairResult(null);
      setToast({ message: 'Enter a lease number first', type: 'warning' });
      return;
    }

    const found = leases.find((lease) => (lease.lease_number || '').toUpperCase() === normalized) || null;
    setRepairResult(found);
    if (!found) {
      setToast({ message: `No lease found for ${normalized}`, type: 'warning' });
    }
  };

  const inferLeaseLinks = (lease: Lease) => {
    const unit = allUnits.find((u) => u.id === lease.unit_id) || null;
    const tenant = tenants.find((t) => t.id === lease.tenant_id) || null;
    const property = properties.find((p) => p.id === lease.property_id) || null;

    const tenantCurrentUnit = tenant ? allUnits.find((u) => u.id === (tenant as any).current_unit_id) : null;
    const unitProperty = unit?.property_id ? properties.find((p) => p.id === unit.property_id) : null;

    const resolvedUnit = unit || tenantCurrentUnit || null;
    const resolvedProperty = property || unitProperty || (resolvedUnit?.property_id ? properties.find((p) => p.id === resolvedUnit.property_id) : null) || null;
    const resolvedTenant = tenant || (resolvedUnit ? tenants.find((t) => (t as any).current_unit_id === resolvedUnit.id) : null) || null;

    return {
      unit: resolvedUnit,
      property: resolvedProperty,
      tenant: resolvedTenant,
      unique: Boolean(resolvedUnit && resolvedProperty && resolvedTenant),
    };
  };

  const scoreLeaseCandidate = (lease: Lease, candidate: Lease) => {
    let score = 0;
    if (lease.tenant_id && candidate.tenant_id && lease.tenant_id === candidate.tenant_id) score += 5;
    if (lease.unit_id && candidate.unit_id && lease.unit_id === candidate.unit_id) score += 5;
    if (lease.property_id && candidate.property_id && lease.property_id === candidate.property_id) score += 3;
    if (lease.rent_amount && candidate.rent_amount && Number(lease.rent_amount) === Number(candidate.rent_amount)) score += 3;
    if (lease.start_date && candidate.start_date && lease.start_date === candidate.start_date) score += 2;
    if (lease.end_date && candidate.end_date && lease.end_date === candidate.end_date) score += 2;
    if (lease.status && candidate.status && lease.status === candidate.status) score += 1;
    return score;
  };

  const scoreUnitCandidate = (lease: Lease, unit: any) => {
    let score = 0;
    if (lease.unit_id && unit?.id === lease.unit_id) score += 5;
    if (lease.property_id && unit?.property_id === lease.property_id) score += 3;
    if (lease.rent_amount && unit?.rent_amount && Number(lease.rent_amount) === Number(unit.rent_amount)) score += 3;

    const linkedTenant = tenants.find((t: any) => (t as any).current_unit_id === unit?.id);
    if (linkedTenant && lease.tenant_id && linkedTenant.id === lease.tenant_id) score += 5;
    if (linkedTenant) score += 2;
    return score;
  };

  const getLeaseCandidates = (lease: Lease) => {
    const leaseMatches = leases
      .filter((candidate) => candidate.id !== lease.id)
      .map((candidate) => ({
        type: 'lease' as const,
        score: scoreLeaseCandidate(lease, candidate),
        lease: candidate,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const unitMatches = allUnits
      .map((unit) => ({
        type: 'unit' as const,
        score: scoreUnitCandidate(lease, unit),
        unit,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { leaseMatches, unitMatches };
  };

  const applyLeaseRepair = async () => {
    if (!repairResult) return;
    setRepairBusy(true);
    try {
      const inferred = inferLeaseLinks(repairResult);
      if (!inferred.unique) {
        setToast({ message: 'Could not infer a unique tenant/unit/property match. Review the candidates first.', type: 'warning' });
        return;
      }

      const { error } = await supabase
        .from('re_leases')
        .update({
          tenant_id: inferred.tenant!.id,
          unit_id: inferred.unit!.id,
          property_id: inferred.property!.id,
          status: repairResult.status || 'active',
        })
        .eq('id', repairResult.id);

      if (error) throw error;

      setToast({ message: `Lease ${repairResult.lease_number} repaired successfully`, type: 'success' });
      fetchLeaseData();
    } catch (error: any) {
      console.error('Lease repair failed:', error);
      setToast({ message: error.message || 'Failed to repair lease', type: 'error' });
    } finally {
      setRepairBusy(false);
    }
  };

  const openLeaseEditor = async (lease: Lease) => {
    setRepairResult(lease);
    setSelectedLease(lease);
    setIsEditingLease(true);
    setFormData({
      lease_type: lease.lease_type || 'residential',
      tenant_id: lease.tenant_id || '',
      property_id: lease.property_id || '',
      unit_id: lease.unit_id || '',
      start_date: lease.start_date || '',
      end_date: lease.end_date || '',
      rent_amount: Number(lease.rent_amount || 0),
      deposit_amount: Number(lease.deposit_amount || 0),
      payment_day: Number(lease.payment_day || 1),
      duration_months: Number(lease.duration_months || 12),
      lease_doc_url: lease.lease_doc_url || ''
    });

    if (lease.property_id) {
      await fetchUnits(lease.property_id);
    } else {
      setAvailableUnits([]);
    }

    setShowModal(true);
  };

  const fetchUnits = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('re_units')
        .select('id, unit_number, rent_amount, property:re_properties(name)')
        .eq('property_id', propertyId)
        // Removed status: vacant to be more inclusive if data state is inconsistent
        .order('unit_number');
      
      if (error) throw error;
      setAvailableUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchLeaseData();
      fetchDropdownData();
    }
  }, [profile]);

  useEffect(() => {
    if (formData.property_id) {
      fetchUnits(formData.property_id);
    } else {
      setAvailableUnits([]);
    }
  }, [formData.property_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenant_id || !formData.unit_id || !formData.start_date) {
      setToast({ message: 'Please fill in all required fields (Tenant, Unit, Start Date)', type: 'warning' });
      return;
    }


    setIsSubmitting(true);
    try {
      const payload: any = {
        lease_type: formData.lease_type,
        tenant_id: formData.tenant_id,
        unit_id: formData.unit_id,
        property_id: formData.property_id,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        rent_amount: formData.rent_amount,

        deposit_amount: formData.deposit_amount,
        payment_day: formData.payment_day,
        duration_months: formData.duration_months,
        lease_doc_url: formData.lease_doc_url,
        status: 'active'
      };

      // Explicitly include company_id for multi-tenancy
      if (profile?.company_id) {
        payload.company_id = profile.company_id;
      }

      const leaseRequest = isEditingLease && selectedLease?.id
        ? supabase.from('re_leases').update(payload).eq('id', selectedLease.id)
        : supabase.from('re_leases').insert([payload]);

      const { error: leaseError } = await leaseRequest;

      if (leaseError) throw leaseError;

      await supabase
        .from('re_units')
        .update({ status: 'occupied' })
        .eq('id', formData.unit_id);

      await activityLogger.log({
        resourceId: formData.unit_id,
        resourceType: 'lease',
        actionType: isEditingLease ? 'update' : 'create',
        actionCategory: 'real_estate',
        description: isEditingLease
          ? `Digital lease updated for tenant ${formData.tenant_id}`
          : `New digital lease created for tenant ${formData.tenant_id}`,
        metadata: { ...formData }
      });

      setToast({ message: isEditingLease ? 'Lease updated successfully!' : 'Lease created successfully! Generating document...', type: 'success' });
      fetchLeaseData();
      
      // Generate the auto-filled lease text
      const tenantName = getTenantName({
        id: formData.tenant_id,
        lease_number: '',
        tenant_id: formData.tenant_id,
        unit_id: formData.unit_id,
        property_id: formData.property_id,
        rent_amount: formData.rent_amount,
        deposit_amount: formData.deposit_amount,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        payment_day: formData.payment_day,
        status: 'active',
        tenant: tenants.find(t => t.id === formData.tenant_id)!,
        unit: allUnits.find(u => u.id === formData.unit_id) as any,
        property: properties.find(p => p.id === formData.property_id)!,
        created_at: new Date().toISOString()
      } as Lease);
      const propertyName = getPropertyName({
        id: formData.tenant_id,
        lease_number: '',
        tenant_id: formData.tenant_id,
        unit_id: formData.unit_id,
        property_id: formData.property_id,
        rent_amount: formData.rent_amount,
        deposit_amount: formData.deposit_amount,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        payment_day: formData.payment_day,
        status: 'active',
        tenant: tenants.find(t => t.id === formData.tenant_id)!,
        unit: allUnits.find(u => u.id === formData.unit_id) as any,
        property: properties.find(p => p.id === formData.property_id)!,
        created_at: new Date().toISOString()
      } as Lease);
      const unitNumber = getUnitNumber({
        id: formData.tenant_id,
        lease_number: '',
        tenant_id: formData.tenant_id,
        unit_id: formData.unit_id,
        property_id: formData.property_id,
        rent_amount: formData.rent_amount,
        deposit_amount: formData.deposit_amount,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        payment_day: formData.payment_day,
        status: 'active',
        tenant: tenants.find(t => t.id === formData.tenant_id)!,
        unit: allUnits.find(u => u.id === formData.unit_id) as any,
        property: properties.find(p => p.id === formData.property_id)!,
        created_at: new Date().toISOString()
      } as Lease);
      const startDate = new Date(formData.start_date).toLocaleDateString('en-KE');
      const endDate = formData.end_date ? new Date(formData.end_date).toLocaleDateString('en-KE') : 'Open-ended';
      const selectedUnit = allUnits.find((u) => u.id === formData.unit_id);
      const signerName = profile?.full_name || profile?.email || 'Authorized Agent';
      const signerEmail = profile?.email || '';
      const agreementDate = new Date().toLocaleDateString('en-KE');
      const documentDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).replace(',', '');
      const landlordName = properties.find((p) => p.id === formData.property_id)?.name || '................................................................';
      const landlordUnit = selectedUnit?.unit_number || '................';
      const tenantId = (tenants.find((t) => t.id === formData.tenant_id) as any)?.id_number || '................................................................';
      const leaseHTML = `
        <div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.6; font-size: 14px;">
          <h1 style="text-align: center; text-transform: uppercase; font-size: 22px; margin-bottom: 1rem;">REPUBLIC OF KENYA</h1>
          <h2 style="text-align: center; text-transform: uppercase; font-size: 20px; margin-bottom: 1.5rem;">TENANCY AGREEMENT</h2>
          <p>This tenancy agreement is made on this day ${agreementDate} between Hakika Real Estate Limited of P.O Box 597-60300, Isiolo Telephone 0711082124 (hereinafter referred to as the "Managing Agents" which expression shall where the context so admits include its personal representatives, assigns and administrators) on behalf of</p>
          <p>Name: <span style="display:inline-block; min-width: 360px; border-bottom: 1px dotted #000;">${landlordName}</span> of P. O BOX</p>
          <p>Landlord: hereinafter referred to as the "Landlord" (which expression shall where the context so admits include its personal representatives, assign and administrators) on one part and</p>
          <p>Name: <span style="display:inline-block; min-width: 360px; border-bottom: 1px dotted #000;">${getTenantName({
            id: formData.tenant_id,
            lease_number: '',
            tenant_id: formData.tenant_id,
            unit_id: formData.unit_id,
            property_id: formData.property_id,
            rent_amount: formData.rent_amount,
            deposit_amount: formData.deposit_amount,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            payment_day: formData.payment_day,
            status: 'active',
            tenant: tenants.find((t) => t.id === formData.tenant_id)!,
            unit: selectedUnit as any,
            property: properties.find((p) => p.id === formData.property_id)!,
            created_at: new Date().toISOString(),
          } as Lease)}</span> id number: <span style="display:inline-block; min-width: 160px; border-bottom: 1px dotted #000;">${tenantId}</span></p>
          <p>Tenant: hereinafter referred to as the "Tenant" (which expression shall where the context so admits include its personal representatives, assign and administrators) on the other Part.</p>
          <p>Tenant hereby agrees with the Landlord and Landlord Agent as follows:</p>
          <p>1. The Landlord has delegated powers and authority to Hakika Real Estate Limited to let and the Tenant shall take all that part of the Landlords property known as <strong>${properties.find((p) => p.id === formData.property_id)?.name || '................................................................'}</strong> unit number <strong>${landlordUnit}</strong> situated at <strong>${selectedUnit?.floor_number || 'ISIOLO'}</strong>, Kenya.</p>
          <p>2. To pay a Gate Key Deposit equivalent to one month's rent to Hakika Real Estate Equity Bank Account No: 0410279348437 Paybill No 247247 on or before commencement of tenancy. The Gate Key Deposit will under no circumstances be utilized as rent for any particular months. The Gate Key Deposit will be refunded without interest to the Tenant at the termination of the agreement.</p>
          <p>3. To pay rent of Kenya Shillings <strong>${Number(formData.rent_amount || 0).toLocaleString()}</strong> per month payable monthly without any deductions whatsoever. The rent shall be paid on the 1st Day of each month to the Landlords bank account. Upon payment the Tenant shall be required to immediately submit the original banking slip to Hakika Real Estate Office or send via WhatsApp the receipt to 0737739547. The Tenant who opts to pay rent through M-Pesa shall be required to send the M-Pesa reference text to 0737739547. Rent paid past midnight of the 5th day of every month shall attract a late rent fee charge of 10% rent to be paid as additional rent.</p>
          <p>4. To pay all electricity bill account number………………and water charges account number…………… in respect of demised premises during the tenancy period and present evidence of paid bills on a monthly basis. Any withstanding bills may be reserved in the same manner as the rent.</p>
          <p>5. It is assumed that the Tenant has inspected the demised premises and accepted to take the property as is prior to or during the signing of this contract.</p>
          <p>6. To pay Kenya Shillings ………………………………… as tenancy fees being the cost of preparation of this tenancy agreement.</p>
          <p>7. To keep the interior of all the buildings forming part of the premises including all the doors, windows, keys, all water taps, baths, showers, light fittings and all other Landlords fixtures and fittings well and sufficiently clean and in good state of repair and condition, and to make good any damage to the premises that may be caused by that tenant, his family, employee or guest and to yield up to the premises in like repair and condition at expiration or sooner determination of the said term including replacing all lost, broken or damaged items with items of similar kind and quality.</p>
          <p>8. To permit the landlord or his agent during the said term at all reasonable times with or without a workman to enter upon and view the conditions of the premises. And in any case any defect or want of repair to be found which the Tenant is liable to make good under this agreement the Landlord may serve notice in writing thereof upon the Tenant or leave such notice upon the premises or send such notice by registered post requiring the Tenant to make good such defect. And should the Tenant fail to make good the said defects or repairs specified in the said notice, then the Landlord shall be entitled to enter upon your premises with workmen or agents and affect the said repairs and the costs thereof shall be a debt due to the Landlord by the Tenant and be forthwith recoverable by actions.</p>
          <p>9. To use said premises as a private dwelling house only and not to carry on any form of business nor use the same as a boarding house nor any other purpose without written consent of the Landlord.</p>
          <p>10. Not to transfer, Lease, Sublet, Charge or part with the possession of the premises or any part thereof with first obtaining the prior written consent of the Landlord.</p>
          <p>11. Not to make any alterations in or additional to the premises (Including boundary walls and fences) or erect any kind of fixtures therein without the prior written consent of the Landlord And subject to the Landlords requirements. Any such alterations, additional or erections shall be removed, restored or repaired by the Tenant and the Tenants sole cost at the expiration or sooner determination of the said term the Tenant making good all the damages occasioned by such removal, restoration or repair.</p>
          <p>12. Not to drive any Nails, screws, bolts or wedges in floors, walls, ceiling of any building forming part of the premises without first obtaining prior consent in writing of the Landlord. Not to bring in pets or any animal in the Let premises without the prior written consent of the Landlord.</p>
          <p>The Landlord hereby consents with the Tenant as follows:</p>
          <p>13. a. To do all structured repairs to the walls, floors, roof, ceiling of the said premises except where such repairs is due to any default or neglect of the Tenant.</p>
          <p>b. To deliver said premises to the Tenant in a good and tenant-able state of repair with all internal walls painted.</p>
          <p>c. To permit the tenant paying rent hereby reserved and performing and observing the covenants agreements conditions, stipulations and provisions herein contained or implied and on its part to be performed and observed peacefully and quietly to possess and enjoy the premises during the term without any interruption form the Landlord or his agents.</p>
          <p>14. Provided always and its hereby agreed and declared that:</p>
          <p>a. If the rent reserved shall not have been paid by Fourteen (14) days from the date it is due the Landlord may re-enter into and upon the premises or any part of thereof in the name of the whole and to resume possession of the premises and to repossess and enjoy as In the Landlords former state anything herein contained to the contrary in anywise notwithstanding without prejudice to any right of action or remedy of the Landlord in respect of any antecedent breach of any covenants, agreements, conditions, restrictions, stipulations or provisions contained or implied and on the part of the Tenant to be performed and observed Provided That the Landlord shall give the Tenant at least Fourteen (14) days' notice to make good any breach before exercising his right of re-entry under this clause.</p>
          <p>b. On termination of tenancy or issuing notice to vacate, the Tenant will redecorate the premises internally in a good and workmanlike manner at his expense and to the satisfaction of the Landlord with two (2) coats of good quality paint and varnish in the said term.</p>
          <p>c. Either the Tenant or the Landlord may terminate this agreement by giving the other not less than one (1) month prior notice in writing to this effect or incise of the Tenant choosing to terminate the agreement by paying to the Landlord one (1) month rent in lieu notice and upon termination of the agreement any advance rent paid by the Tenant to the Landlord shall be reimbursed upon the Landlord being satisfied that the premises have been yielded in accordance with the terms of this agreement. The notice must expire at the end of a calendar month.</p>
          <p>This agreement shall be governed by and construed in accordance with the Laws of Kenya.</p>
          <p>And the Tenant hereby accepts this tenancy subject to the above conditions.</p>
          <p style="margin-top: 2rem;">In Witness Whereof the Landlord and the Tenant have executed this agreement the day, month and year first herein before written.</p>
          <p><strong>Signed, Sealed and Delivered by:</strong></p>
          <div style="margin-top: 1rem; display: flex; justify-content: space-between; gap: 2rem;">
            <div style="width: 45%;">
              <div style="border-bottom: 1px solid #000; height: 30px;"></div>
              <p style="font-weight: bold; margin-top: 5px;">${signerName}</p>
              <p style="font-weight: bold; margin-top: 5px;">Landlord or Landlord Authorized Agent</p>
              ${signerEmail ? `<p style="margin-top: 4px;">Email: ${signerEmail}</p>` : ''}
              <p style="margin-top: 4px;">Date: ..................................</p>
            </div>
            <div style="width: 45%; border: 1px solid #999; padding: 10px;">
              <p style="font-weight: bold; margin: 0 0 4px;">HAKIKA REAL ESTATE</p>
              <p style="margin: 0;">Email: info@hakikarealestate.co.ke</p>
              <p style="margin: 0;">Tel: 0711082124</p>
              <p style="margin: 0;">P.O. Box 597-60300, ISIOLO</p>
            </div>
          </div>
          <div style="margin-top: 2rem; display: flex; justify-content: space-between; gap: 2rem;">
            <div style="width: 45%;">
              <div style="border-bottom: 1px solid #000; height: 30px;"></div>
              <p style="font-weight: bold; margin-top: 5px;">${getTenantName({
                id: formData.tenant_id,
                lease_number: '',
                tenant_id: formData.tenant_id,
                unit_id: formData.unit_id,
                property_id: formData.property_id,
                rent_amount: formData.rent_amount,
                deposit_amount: formData.deposit_amount,
                start_date: formData.start_date,
                end_date: formData.end_date || null,
                payment_day: formData.payment_day,
                status: 'active',
                tenant: tenants.find((t) => t.id === formData.tenant_id)!,
                unit: selectedUnit as any,
                property: properties.find((p) => p.id === formData.property_id)!,
                created_at: new Date().toISOString(),
              } as Lease)}</p>
              <p>Tenant</p>
              <p>Date: ..................................</p>
            </div>
            <div style="width: 45%;">
              <div style="border-bottom: 1px solid #000; height: 30px;"></div>
              <p style="font-weight: bold; margin-top: 5px;">Witness</p>
              <p>Date: ..................................</p>
            </div>
          </div>
          <div style="margin-top: 1.5rem; font-size: 12px; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">
            Lease No: ${lease.lease_number} | Generated by Hakika app | ${documentDate}
          </div>
        </div>
      `;
      setGeneratedLeaseHtml(leaseHTML);
      setShowModal(false);
      setIsEditingLease(false);
      setSelectedLease(null);
      setShowLeasePreview(true);

    } catch (error: any) {
      setToast({ message: error.message || 'Failed to create lease', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTerminateLease = async (id: string, unitId: string) => {
    if (!window.confirm('Are you sure you want to terminate this lease? This will release the unit.')) return;
    
    try {
      const { error } = await supabase
        .from('re_leases')
        .update({ status: 'terminated' })
        .eq('id', id);

      if (error) throw error;

      await supabase
        .from('re_units')
        .update({ status: 'vacant' })
        .eq('id', unitId);

      setToast({ message: 'Lease terminated successfully', type: 'success' });
      fetchLeaseData();
    } catch (err: any) {
      setToast({ message: 'Failed to terminate lease', type: 'error' });
    }
  };

  const handleDownloadLease = (lease: Lease) => {
    const tenantRecord = tenants.find((item) => item.id === lease.tenant_id) || lease.tenant || null;
    if (!tenantRecord?.id_document_url) {
      setToast({ message: 'Please attach the tenant ID document first before downloading the lease.', type: 'warning' });
      return;
    }
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) {
      setToast({ message: 'Popup blocked. Please allow popups to download the lease.', type: 'error' });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${lease.lease_number} - Lease Agreement</title>
          <style>
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${buildLeaseHtml(lease)}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
    setToast({ message: `Lease ${lease.lease_number} prepared with your details`, type: 'success' });
  };

  const filteredLeases = leases.filter(lease => {
    const { tenantName, propertyName, unitNumber } = resolveLeaseContext(lease);

    const matchesSearch = 
      (lease.lease_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unitNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProperty = !propertyFilter || lease.property_id === propertyFilter;
    const matchesUnit = !unitFilter || lease.unit_id === unitFilter;
    const matchesStatus = statusFilter === 'all' || lease.status === statusFilter;
    
    return matchesSearch && matchesProperty && matchesUnit && matchesStatus;
  });

  const filteredUnits = allUnits.filter((unit) => !propertyFilter || unit.property_id === propertyFilter);
  const leaseFormUnits = availableUnits.filter((unit) => !formData.property_id || unit.property_id === formData.property_id);

  const orphanLeases = leases.filter((lease) => {
    const debug = getLeaseDebugInfo(lease);
    return !debug.tenantKnown || !debug.unitKnown || !debug.propertyKnown;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800/30';
      case 'expired': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800/30';
      case 'terminated': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/30';
      case 'pending': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800/30';
    }
  };

  const buildLeaseHtml = (lease: Lease) => {
    const tenantName = getTenantName(lease);
    const propertyName = getPropertyName(lease);
    const unitNumber = getUnitNumber(lease);
    const selectedUnit = allUnits.find((u) => u.id === lease.unit_id);
    const signerName = profile?.full_name || profile?.email || 'Authorized Agent';
    const signerEmail = profile?.email || '';
    const isCommercial = lease.lease_type === 'commercial';
    const agreementTitle = isCommercial ? 'Commercial Lease Agreement' : 'Tenancy Agreement';
    const introLine = isCommercial
      ? 'This Commercial Lease Agreement ("Agreement") is made and entered into on this day by and between'
      : 'This Tenancy Agreement ("Agreement") is made and entered into on this day by and between';
    const useClause = isCommercial
      ? 'To use said premises strictly for the approved commercial or business purpose and not to use the same as a residence without written consent of the Landlord.'
      : 'To use said premises as a private dwelling house only and not to carry on any form of business nor use the same as a boarding house nor any other purpose without written consent of the Landlord.';

    return `
      <div style="font-family: serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.6;">
        <h1 style="text-align: center; text-transform: uppercase; font-size: 24px; margin-bottom: 2rem; border-bottom: 1px solid #000; padding-bottom: 1rem;">${agreementTitle}</h1>
        <p style="text-align: right;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-KE')}</p>
        <h2 style="font-size: 18px; margin-top: 2rem;">1. The Parties</h2>
        <p>${introLine} <strong>Hakika Real Estate</strong> ("Landlord/Property Manager") and <strong>${tenantName}</strong> ("Tenant").</p>
        <h2 style="font-size: 18px; margin-top: 2rem;">2. Property & Unit</h2>
        <p>The Landlord agrees to lease to the Tenant the premises located at <strong>${propertyName}</strong>, specifically designated as <strong>Unit ${unitNumber}</strong> (the "Premises").</p>
        <h2 style="font-size: 18px; margin-top: 2rem;">3. Lease Term</h2>
        <p>This lease shall commence on <strong>${new Date(lease.start_date).toLocaleDateString('en-KE')}</strong> and expire on <strong>${lease.end_date ? new Date(lease.end_date).toLocaleDateString('en-KE') : 'Open-ended'}</strong>, representing a standard tenancy period of ${lease.duration_months || 12} months.</p>
        <h2 style="font-size: 18px; margin-top: 2rem;">4. Utility Accounts</h2>
        <p><strong>Water Utility Account:</strong> ${selectedUnit?.water_utility_account || ''}</p>
        <p><strong>Electricity Utility Account:</strong> ${selectedUnit?.electricity_utility_account || ''}</p>
        <h2 style="font-size: 18px; margin-top: 2rem;">5. Rent & Security Deposit</h2>
        <p><strong>Rent:</strong> The agreed monthly rent is <strong>Ksh ${Number(lease.rent_amount || 0).toLocaleString()}</strong>, payable on or before the <strong>${lease.payment_day}</strong> of every month.</p>
        <p><strong>Gate Key Deposit:</strong> A refundable gate key deposit of <strong>Ksh ${Number(lease.deposit_amount || 0).toLocaleString()}</strong> has been agreed upon, which shall be held by the Landlord for the duration of the tenancy against damages or arrears.</p>
        <p><strong>ID Document:</strong> Verified against the tenant's attached identity document before download.</p>
        <h2 style="font-size: 18px; margin-top: 2rem;">6. Execution</h2>
        <p>By signing below, the Tenant acknowledges that they have read, understood, and agreed to all terms and conditions stipulated in the broader Hakika Tenancy Terms (attached separately).</p>
        <h2 style="font-size: 18px; margin-top: 2rem;">7. Use of Premises</h2>
        <p>${useClause}</p>
        <div style="margin-top: 4rem; display: flex; justify-content: space-between; gap: 2rem;">
          <div style="width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 30px;"></div>
            <p style="font-weight: bold; margin-top: 5px;">${signerName}</p>
            <p style="margin-top: 4px;">Landlord or Landlord Authorized Agent</p>
            ${signerEmail ? `<p style="margin-top: 4px;">Email: ${signerEmail}</p>` : ''}
            <p style="margin-top: 4px;">Date: ..................................</p>
          </div>
          <div style="width: 45%;">
            <div style="border-bottom: 1px solid #000; height: 30px;"></div>
            <p style="font-weight: bold; margin-top: 5px;">${tenantName}</p>
            <p style="margin-top: 4px;">Tenant</p>
            <p style="margin-top: 4px;">Date: ..................................</p>
          </div>
        </div>
      </div>
    `;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <FileText className="mr-3 text-brand-purple" size={32} />
              Digital Leases
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Generate and manage digital lease agreements for your properties.
            </p>
          </div>
          <button 
            onClick={() => {
              setIsEditingLease(false);
              setSelectedLease(null);
              setFormData({
                tenant_id: '',
                property_id: '',
                unit_id: '',
                start_date: '',
                end_date: '',
                rent_amount: 0,
                deposit_amount: 0,
                payment_day: 1,
                duration_months: 12,
                lease_doc_url: ''
              });
              setShowModal(true);
            }}
            title="Create a new digital lease agreement"
            className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm w-fit"
          >
            <Plus size={18} className="mr-2" /> New Lease
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Active', value: leases.filter(l => l.status === 'active').length, icon: CheckCircle, color: 'text-green-500' },
            { 
              label: 'Expiring Soon', 
              value: leases.filter(l => {
                if (!l.end_date) return false;
                const end = new Date(l.end_date);
                const thirtyDays = new Date();
                thirtyDays.setDate(thirtyDays.getDate() + 30);
                return l.status === 'active' && end <= thirtyDays;
              }).length, 
              icon: Clock, 
              color: 'text-orange-500' 
            },
            { label: 'Pending Signature', value: leases.filter(l => l.status === 'pending').length, icon: FileText, color: 'text-blue-500' },
            { label: 'Terminated', value: leases.filter(l => l.status === 'terminated').length, icon: XCircle, color: 'text-red-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</span>
                <stat.icon size={18} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters/Search Bar */}
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface mb-6 flex flex-col gap-4">
          <div className="relative flex-1">
            <label htmlFor="search-leases" className="sr-only">Search leases by number, tenant or property</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              id="search-leases"
              type="text"
              placeholder="Search by lease #, tenant or property..."
              title="Search leases by number, tenant name, or property name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={propertyFilter}
              onChange={(e) => {
                setPropertyFilter(e.target.value);
                setUnitFilter('');
              }}
              className="bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
            >
              <option value="">All Properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.name}</option>
              ))}
            </select>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
            >
              <option value="">All Units</option>
              {filteredUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_number}
                  {unit.property_id ? ` • ${properties.find((p) => p.id === unit.property_id)?.name || 'Unknown'}` : ''}
                  {unit.status ? ` • ${unit.status === 'vacant' ? 'Vacant' : unit.status === 'occupied' ? 'Occupied' : unit.status}` : ''}
                </option>
              ))}
            </select>
            <label htmlFor="status-filter" className="sr-only">Filter by lease status</label>
            <select 
              id="status-filter"
              title="Filter leases by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="terminated">Terminated</option>
            </select>
            <button title="Download current lease list" className="p-2 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-400">
              <Download size={20} />
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label htmlFor="repair-lease-number" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                Find lease by lease number
              </label>
              <input
                id="repair-lease-number"
                type="text"
                value={repairLeaseNumber}
                onChange={(e) => setRepairLeaseNumber(e.target.value)}
                placeholder="e.g. LSE-F49406"
                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={lookupLeaseByNumber}
              className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors"
            >
              Find Lease
            </button>
          </div>
          {repairResult && (
            <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {repairResult.lease_number}
                  </p>
                  <p className="text-xs text-gray-500">
                    Tenant link: {getLeaseDebugInfo(repairResult).tenantKnown ? 'ok' : 'missing'} | Unit link: {getLeaseDebugInfo(repairResult).unitKnown ? 'ok' : 'missing'} | Property link: {getLeaseDebugInfo(repairResult).propertyKnown ? 'ok' : 'missing'}
                  </p>
                </div>
                <button
                  onClick={applyLeaseRepair}
                  disabled={repairBusy}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {repairBusy ? 'Repairing...' : 'Apply Inferred Repair'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                <div className="p-3 rounded-lg bg-white dark:bg-black/20 border border-gray-100 dark:border-white/10">
                  <p className="text-xs uppercase text-gray-400 mb-1">Tenant</p>
                  <p className="font-medium text-gray-900 dark:text-white">{resolveLeaseContext(repairResult).tenantName}</p>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-black/20 border border-gray-100 dark:border-white/10">
                  <p className="text-xs uppercase text-gray-400 mb-1">Property</p>
                  <p className="font-medium text-gray-900 dark:text-white">{resolveLeaseContext(repairResult).propertyName}</p>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-black/20 border border-gray-100 dark:border-white/10">
                  <p className="text-xs uppercase text-gray-400 mb-1">Unit</p>
                  <p className="font-medium text-gray-900 dark:text-white">{resolveLeaseContext(repairResult).unitNumber}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20">
                  <p className="text-xs uppercase text-gray-400 mb-3">Likely Lease Matches</p>
                  <div className="space-y-2">
                    {getLeaseCandidates(repairResult).leaseMatches.length > 0 ? (
                      getLeaseCandidates(repairResult).leaseMatches.map((item) => (
                        <button
                          key={item.lease.id}
                          onClick={() => setRepairResult(item.lease)}
                          className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-white">{item.lease.lease_number}</span>
                            <span className="text-xs text-gray-500">score {item.score}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Rent: Ksh {item.lease.rent_amount.toLocaleString()} | {item.lease.start_date} to {item.lease.end_date || 'open'}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No close lease matches found.</p>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20">
                  <p className="text-xs uppercase text-gray-400 mb-3">Likely Unit Matches</p>
                  <div className="space-y-2">
                    {getLeaseCandidates(repairResult).unitMatches.length > 0 ? (
                      getLeaseCandidates(repairResult).unitMatches.map((item) => {
                        const unitPropertyName = Array.isArray(item.unit.property)
                          ? item.unit.property[0]?.name
                          : item.unit.property?.name;
                        return (
                          <button
                            key={item.unit.id}
                            onClick={() => {
                              setRepairResult((prev) => prev ? { ...prev, unit_id: item.unit.id, property_id: item.unit.property_id || prev.property_id } : prev);
                              setToast({ message: `Selected unit ${item.unit.unit_number} as a candidate`, type: 'info' });
                            }}
                            className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900 dark:text-white">Unit {item.unit.unit_number}</span>
                              <span className="text-xs text-gray-500">score {item.score}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Property: {unitPropertyName || 'Unknown'} | Rent: Ksh {Number(item.unit.rent_amount || 0).toLocaleString()}
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500">No close unit matches found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {orphanLeases.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Lease link issues detected</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Some leases are missing tenant, unit, or property links. They are still shown below, but need repair.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-full">
                {orphanLeases.length} flagged
              </span>
            </div>
          </div>
        )}

        {/* Leases Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <CustomLoader size={32} label="Fetching leases..." />
            </div>
          ) : filteredLeases.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="mx-auto mb-4 text-gray-300" size={48} />
              <p>No leases found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500">Lease #</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Tenant</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Property / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Duration</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Monthly Rent</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filteredLeases.map((lease) => (
                    <tr key={lease.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white uppercase">
                        {lease.lease_number}
                        <div className="mt-1">
                          <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-purple">
                            {lease.lease_type || 'residential'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple font-bold text-xs">
                            {resolveLeaseContext(lease).tenantName.charAt(0)}
                          </div>
                          <span className="text-gray-900 dark:text-white">{resolveLeaseContext(lease).tenantName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-gray-900 dark:text-white font-medium">
                            {resolveLeaseContext(lease).propertyName}
                          </span>
                          <span className="text-xs text-gray-500">Unit: {resolveLeaseContext(lease).unitNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs text-gray-600 dark:text-gray-400">
                          <span>{new Date(lease.start_date).toLocaleDateString()} to</span>
                          <span>{lease.end_date ? new Date(lease.end_date).toLocaleDateString() : 'Open-ended'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                        Ksh {lease.rent_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(lease.status)}`}>
                          {lease.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDownloadLease(lease)}
                          title={`Download lease ${lease.lease_number}`}
                          className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-brand-purple dark:hover:text-white"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            navigate(`/app/real-estate/leases/${lease.id}`);
                          }}
                          title={`View details for lease ${lease.lease_number}`}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-brand-purple dark:hover:text-white"
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Lease Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Plus className="mr-2 text-brand-purple" size={24} />
                {isEditingLease ? 'Edit Digital Lease' : 'Create Digital Lease'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                title="Close modal"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="lease-type" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <FileText size={16} className="mr-2 text-brand-purple" /> Lease Type *
                  </label>
                  <select
                    id="lease-type"
                    value={formData.lease_type}
                    onChange={(e) => setFormData({ ...formData, lease_type: e.target.value as 'residential' | 'commercial' })}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Residential stays as the default tenant lease flow.
                  </p>
                </div>
                {/* Tenant Selection */}
                <div>
                  <label htmlFor="lease-tenant" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <User size={16} className="mr-2 text-brand-purple" /> Select Tenant *
                  </label>
                  <select 
                    id="lease-tenant"
                    title="Select the tenant for this lease"
                    required
                    value={formData.tenant_id}
                    onChange={(e) => setFormData({...formData, tenant_id: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  >
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{getTenantDisplayName(t)}</option>)}
                  </select>
                </div>

                {/* Property Selection */}
                <div>
                  <label htmlFor="lease-property" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <Building2 size={16} className="mr-2 text-brand-purple" /> Property *
                  </label>
                  <select 
                    id="lease-property"
                    title="Select the property for this lease"
                    required
                    value={formData.property_id}
                    onChange={(e) => setFormData({...formData, property_id: e.target.value, unit_id: ''})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {/* Unit Selection */}
                <div>
                    <label htmlFor="lease-unit" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <Home size={16} className="mr-2 text-brand-purple" /> Unit *
                  </label>
                  <select 
                    id="lease-unit"
                    title="Select the unit for this lease"
                    required
                    disabled={!formData.property_id}
                    value={formData.unit_id}
                    onChange={(e) => {
                      const unitId = e.target.value;
                      const unit = availableUnits.find(u => u.id === unitId);
                      setFormData({
                        ...formData, 
                        unit_id: unitId,
                        rent_amount: unit?.rent_amount || 0
                      });
                    }}
                    className="w-full disabled:opacity-50 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  >
                    <option value="">-- Choose Unit --</option>
                    {leaseFormUnits.map(u => <option key={u.id} value={u.id}>{u.unit_number} (Ksh {u.rent_amount})</option>)}
                  </select>
                </div>

                {/* Rent Amount */}
                <div>
                  <label htmlFor="lease-rent" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Monthly Rent (Ksh) *</label>
                  <input 
                    id="lease-rent"
                    type="number" 
                    required
                    value={formData.rent_amount}
                    onChange={(e) => setFormData({...formData, rent_amount: Number(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  />
                </div>

                {/* Deposit Amount */}
                <div>
                  <label htmlFor="lease-deposit" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gate Key Deposit</label>
                  <input 
                    id="lease-deposit"
                    type="number"
                    value={formData.deposit_amount}
                    onChange={(e) => setFormData({...formData, deposit_amount: Number(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  />
                </div>

                {/* Payment Day */}
                <div>
                  <label htmlFor="lease-due-day" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Rent Due Day (1-31)</label>
                  <input 
                    id="lease-due-day"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payment_day}
                    onChange={(e) => setFormData({...formData, payment_day: Number(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label htmlFor="lease-duration" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Duration (Months) *</label>
                  <input 
                    id="lease-duration"
                    type="number"
                    min="1"
                    required
                    value={formData.duration_months}
                    onChange={(e) => setFormData({...formData, duration_months: Number(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  />
                </div>

                {/* Document URL */}
                <div className="md:col-span-2">
                  <label htmlFor="lease-doc-upload" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <ImageIcon size={18} className="text-brand-purple" />
                    Lease Document (PDF to Supabase, Image to ImageKit)
                  </label>
                  <div className="space-y-3">
                    <div className="relative group">
                      <input 
                        id="lease-doc-upload"
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <label 
                        htmlFor="lease-doc-upload"
                        className={`flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-dashed border-gray-300 dark:border-white/10 rounded-2xl cursor-pointer transition-all hover:border-brand-purple hover:bg-brand-purple/5 bg-gray-50 dark:bg-black/20 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <CustomLoader size={24} />
                            <span className="text-xs text-gray-500 font-medium">Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 py-4">
                            <div className="p-3 bg-brand-purple/10 text-brand-purple rounded-full">
                              <Plus size={24} />
                            </div>
                            <div className="text-center px-4">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">Click to upload document or image</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF, DOC (Supabase) or JPEG, PNG (ImageKit)</p>
                            </div>
                          </div>
                        )}
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        id="lease-doc-url"
                        type="text"
                        placeholder="Uploaded URL will appear here..."
                        value={formData.lease_doc_url}
                        readOnly
                        className="flex-1 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 text-sm italic"
                      />
                      {formData.lease_doc_url && (
                        <a 
                          href={formData.lease_doc_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2.5 bg-brand-purple/10 text-brand-purple rounded-xl hover:bg-brand-purple hover:text-white transition-all"
                          title="Preview Document"
                        >
                          <ExternalLink size={20} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>



                {/* Dates */}
                <div>
                  <label htmlFor="lease-start-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <Calendar size={16} className="mr-2 text-brand-purple" /> Start Date *
                  </label>
                  <input 
                    id="lease-start-date"
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  />
                </div>

                <div>
                    <label htmlFor="lease-end-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <Calendar size={16} className="mr-2 text-brand-purple" /> End Date
                  </label>
                  <input 
                    id="lease-end-date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    placeholder="Leave blank for open-ended"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white transition-all"
                  />

                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-white/10 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setIsEditingLease(false);
                  }}
                  className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  title={isEditingLease ? 'Save changes to the digital lease' : 'Generate the digital lease document'}
                  className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" /> {isEditingLease ? 'Saving...' : 'Creating...'}</> : (isEditingLease ? 'Save Lease' : 'Generate Lease')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
