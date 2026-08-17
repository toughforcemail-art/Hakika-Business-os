// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Loader,
  CheckCircle,
  Search,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { tenantAssetService } from '../../services/tenantAssetService';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../context/AccessContext';

interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  condition: string;
  color: string;
  image_url: string;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
}

interface Unit {
  id: string;
  unit_number: string;
  floor_number: number;
}

interface Property {
  id: string;
  name: string;
}

const AssignAssetToTenantPage: React.FC = () => {
  const navigate = useNavigate();
  const { propertyId } = useParams<{ propertyId: string }>();
  const { profile } = useAccess();

  // Form state
  const [step, setStep] = useState<'asset' | 'tenant' | 'unit' | 'confirm'>(
    'asset'
  );
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [notes, setNotes] = useState('');

  // Data
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [property, setProperty] = useState<Property | null>(null);

  // Search
  const [assetSearch, setAssetSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(
    null
  );

  useEffect(() => {
    if (propertyId) {
      void loadData();
    }
  }, [propertyId]);

  const loadData = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      // Load property
      const { data: propData, error: propError } = await supabase
        .from('re_properties')
        .select('id, name')
        .eq('id', propertyId)
        .single();

      if (propError) throw propError;
      setProperty(propData);

      // Load available assets
      const availableAssets = await tenantAssetService.getAvailableAssets();
      setAssets(availableAssets);

      // Load units for this property
      const { data: unitsData, error: unitsError } = await supabase
        .from('re_units')
        .select('id, unit_number, floor_number')
        .eq('property_id', propertyId);

      if (unitsError) throw unitsError;
      setUnits(unitsData || []);

      // Load tenants with their current units
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('re_tenants')
        .select(
          `
          id,
          is_active,
          current_unit_id,
          profiles:id ( id, full_name, email )
        `
        )
        .eq('is_active', true);

      if (tenantsError) throw tenantsError;

      const activeTenants = tenantsData
        ?.filter(t => t.current_unit_id && t.profiles)
        .map(t => ({
          id: t.profiles.id,
          full_name: t.profiles.full_name,
          email: t.profiles.email,
        })) || [];

      setTenants(activeTenants);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setToast({
        message: error.message || 'Failed to load data',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setStep('tenant');
    window.scrollTo(0, 0);
  };

  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setStep('unit');
    window.scrollTo(0, 0);
  };

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setStep('confirm');
    window.scrollTo(0, 0);
  };

  const handleAssign = async () => {
    if (!selectedAsset || !selectedTenant || !selectedUnit || !propertyId) {
      return;
    }

    setSubmitting(true);
    try {
      await tenantAssetService.assignAssetToTenant(
        selectedAsset.id,
        selectedTenant.id,
        selectedUnit.id,
        propertyId,
        profile?.id || '',
        notes
      );

      setToast({
        message: 'Asset assigned successfully!',
        type: 'success',
      });

      setTimeout(() => {
        navigate(`/app/real-estate/tenant-assets/${propertyId}`);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to assign asset:', error);
      setToast({
        message: error.message || 'Failed to assign asset',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader className="mb-3 animate-spin text-[#ff6a00]" size={32} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const filteredAssets = assets.filter(
    a =>
      a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
      a.serial_number?.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const filteredTenants = tenants.filter(
    t =>
      t.full_name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-dark-bg dark:to-dark-surface text-black dark:text-white">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/app/real-estate/tenant-assets/${propertyId}`)}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition hover:text-[#ff6a00] dark:border-white/10 dark:bg-dark-surface dark:text-gray-300"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">Assign Asset to Tenant</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {property?.name || 'Property'} • Step {step === 'asset' ? 1 : step === 'tenant' ? 2 : step === 'unit' ? 3 : 4}{' '}
              of 4
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {(['asset', 'tenant', 'unit', 'confirm'] as const).map((s, idx) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition ${
                s === step || ['asset', 'tenant', 'unit', 'confirm'].indexOf(s) < ['asset', 'tenant', 'unit', 'confirm'].indexOf(step)
                  ? 'bg-[#ff6a00]'
                  : 'bg-gray-200 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Select Asset */}
        {step === 'asset' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h2 className="mb-4 text-xl font-semibold">Select Asset</h2>

            <div className="mb-4 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search assets..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {filteredAssets.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No available assets found
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => handleSelectAsset(asset)}
                    className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-[#ff6a00] hover:bg-orange-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-[#ff6a00]/10"
                  >
                    {asset.image_url && (
                      <img
                        src={asset.image_url}
                        alt={asset.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold">{asset.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {asset.type} • {asset.condition}
                      </p>
                      {asset.serial_number && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          SN: {asset.serial_number}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Tenant */}
        {step === 'tenant' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h2 className="mb-4 text-xl font-semibold">Select Tenant</h2>

            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex gap-2 dark:bg-blue-500/10 dark:border-blue-500/30">
              <CheckCircle size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Asset: <strong>{selectedAsset?.name}</strong>
              </p>
            </div>

            <div className="mb-4 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Search tenants..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {filteredTenants.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No active tenants found
                </div>
              ) : (
                filteredTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleSelectTenant(tenant)}
                    className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-[#ff6a00] hover:bg-orange-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-[#ff6a00]/10"
                  >
                    <div className="h-12 w-12 rounded-full bg-[#ff6a00]/20 flex items-center justify-center text-[#ff6a00] flex-shrink-0">
                      {tenant.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{tenant.full_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {tenant.email}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setStep('asset')}
              className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 3: Select Unit */}
        {step === 'unit' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h2 className="mb-4 text-xl font-semibold">Select Unit</h2>

            <div className="mb-4 space-y-2 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30">
              <div className="flex gap-2">
                <CheckCircle size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Asset: <strong>{selectedAsset?.name}</strong>
                </p>
              </div>
              <div className="flex gap-2 ml-6">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Tenant: <strong>{selectedTenant?.full_name}</strong>
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {units.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No units found in this property
                </div>
              ) : (
                units.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => handleSelectUnit(unit)}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 transition hover:border-[#ff6a00] hover:bg-orange-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-[#ff6a00]/10"
                  >
                    <div>
                      <p className="font-semibold">Unit {unit.unit_number}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Floor {unit.floor_number}
                      </p>
                    </div>
                    <div className="text-[#ff6a00]">→</div>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setStep('tenant')}
              className="mt-4 w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 4: Confirm Assignment */}
        {step === 'confirm' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h2 className="mb-6 text-xl font-semibold">Confirm Assignment</h2>

            <div className="grid gap-4 mb-6 p-4 bg-gray-50 rounded-lg dark:bg-white/5">
              <div className="border-b border-gray-200 pb-4 dark:border-white/10">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Asset</p>
                <p className="font-semibold text-lg">{selectedAsset?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {selectedAsset?.serial_number && `SN: ${selectedAsset.serial_number}`}
                </p>
              </div>

              <div className="border-b border-gray-200 pb-4 dark:border-white/10">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tenant</p>
                <p className="font-semibold text-lg">{selectedTenant?.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {selectedTenant?.email}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unit</p>
                <p className="font-semibold text-lg">
                  Unit {selectedUnit?.unit_number} - Floor {selectedUnit?.floor_number}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this assignment..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('unit')}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={handleAssign}
                disabled={submitting}
                className="flex-1 rounded-lg bg-[#ff6a00] px-4 py-2 text-white transition hover:bg-[#ff6a00]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <Loader size={16} className="animate-spin" />}
                Assign Asset
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <CustomToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default AssignAssetToTenantPage;
