// @ts-nocheck
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Filter,
  Package,
  User,
  Building2,
  Home,
  Calendar,
  RotateCcw,
  Loader,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { tenantAssetService, TenantAsset } from '../../services/tenantAssetService';
import CustomToast, { ToastType } from '../../components/CustomToast';
import CustomLoader from '../../components/CustomLoader';
import { useAccess } from '../../context/AccessContext';

interface GroupedAssets {
  unitId: string;
  unitNumber: string;
  floorNumber: number;
  assets: TenantAsset[];
}

const TenantAssetAssignmentPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [propertyName, setPropertyName] = useState('');
  const [assets, setAssets] = useState<TenantAsset[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState('good');

  useEffect(() => {
    if (propertyId) {
      void loadPropertyAssets();
    }
  }, [propertyId]);

  const loadPropertyAssets = async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const { data: property, error: propError } = await supabase
        .from('re_properties')
        .select('id, name, address')
        .eq('id', propertyId)
        .single();

      if (propError) throw propError;
      if (property) setPropertyName(property.name);

      const propertyAssets = await tenantAssetService.getPropertyAssets(propertyId);
      setAssets(propertyAssets);
    } catch (error: any) {
      console.error('Failed to load assets:', error);
      setToast({
        message: error.message || 'Failed to load property assets',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const groupedAssets = useMemo((): GroupedAssets[] => {
    const grouped = new Map<string, GroupedAssets>();

    assets.forEach((asset) => {
      const key = asset.unit_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          unitId: asset.unit_id,
          unitNumber: asset.unit_number,
          floorNumber: asset.floor_number,
          assets: [],
        });
      }
      grouped.get(key)!.assets.push(asset);
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })
    );
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return groupedAssets;

    const q = search.toLowerCase();
    return groupedAssets
      .map((group) => ({
        ...group,
        assets: group.assets.filter(
          (asset) =>
            asset.asset_name.toLowerCase().includes(q) ||
            asset.tenant_name.toLowerCase().includes(q) ||
            asset.serial_number?.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.assets.length > 0);
  }, [groupedAssets, search]);

  const handleReturnAsset = async (assignmentId: string) => {
    if (!profile?.id) return;

    setReturning(assignmentId);
    try {
      await tenantAssetService.returnAssetFromTenant(
        assignmentId,
        returnCondition,
        profile.id
      );

      setToast({ message: 'Asset returned successfully', type: 'success' });
      await loadPropertyAssets();
    } catch (error: any) {
      console.error('Failed to return asset:', error);
      setToast({
        message: error.message || 'Failed to return asset',
        type: 'error',
      });
    } finally {
      setReturning(null);
      setReturnCondition('good');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Remove this asset assignment?')) return;

    try {
      await tenantAssetService.deleteAssignment(assignmentId);
      setToast({ message: 'Assignment removed', type: 'success' });
      await loadPropertyAssets();
    } catch (error: any) {
      console.error('Failed to delete assignment:', error);
      setToast({
        message: error.message || 'Failed to delete assignment',
        type: 'error',
      });
    }
  };

  if (loading) {
    return <CustomLoader label="Loading property assets..." />;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-dark-bg dark:to-dark-surface text-black dark:text-white">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/app/real-estate/properties"
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition hover:text-[#ff6a00] dark:border-white/10 dark:bg-dark-surface dark:text-gray-300"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{propertyName || 'Property'} - Assets</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage and track assets assigned to tenants
              </p>
            </div>
          </div>
          <Link
            to={`/app/real-estate/tenant-asset-assign/${propertyId}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff6a00] px-4 py-2 text-white transition hover:bg-[#ff6a00]/90"
          >
            <Plus size={18} />
            Assign Asset
          </Link>
        </div>

        {/* Search Bar */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets, tenants, or serial numbers..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:border-[#ff6a00] focus:ring-1 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
        </div>

        {/* Assets List */}
        {filteredAssets.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-white/10 dark:bg-dark-surface">
            <Package size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 dark:text-gray-400">
              {search ? 'No assets found matching your search' : 'No assets assigned yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredAssets.map((group) => (
              <div
                key={group.unitId}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm dark:border-white/10 dark:bg-dark-surface"
              >
                {/* Unit Header */}
                <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-white/10 dark:bg-white/5">
                  <Home size={20} className="text-[#ff6a00]" />
                  <div>
                    <p className="font-semibold">Unit {group.unitNumber}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Floor {group.floorNumber} • {group.assets.length} asset
                      {group.assets.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Assets in Unit */}
                <div className="divide-y divide-gray-200 dark:divide-white/10">
                  {group.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-start justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                    >
                      {/* Asset Image & Info */}
                      <div className="flex gap-4 flex-1 min-w-0">
                        {asset.image_url && (
                          <img
                            src={asset.image_url}
                            alt={asset.asset_name}
                            className="h-16 w-16 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {asset.asset_name}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Tag size={14} />
                              {asset.asset_type}
                            </span>
                            {asset.serial_number && (
                              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                <Package size={14} />
                                SN: {asset.serial_number}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                              <User size={12} />
                              {asset.tenant_name}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                              <Calendar size={12} />
                              {new Date(asset.assigned_at).toLocaleDateString()}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                                asset.asset_condition === 'good'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                                  : asset.asset_condition === 'fair'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              }`}
                            >
                              {asset.asset_condition}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setReturning(asset.id)}
                          className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700 transition hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20"
                          title="Return asset"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(asset.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                          title="Remove assignment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Return Modal */}
                      {returning === asset.id && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                          <div className="rounded-lg bg-white p-6 w-96 dark:bg-dark-surface">
                            <h3 className="mb-4 text-lg font-semibold">Return Asset</h3>
                            <div className="space-y-4">
                              <div>
                                <label className="mb-2 block text-sm font-medium">
                                  Condition on Return
                                </label>
                                <select
                                  value={returnCondition}
                                  onChange={(e) => setReturnCondition(e.target.value)}
                                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-[#ff6a00] dark:border-white/10 dark:bg-white/5 dark:text-white"
                                >
                                  <option value="new">Brand New</option>
                                  <option value="good">Good</option>
                                  <option value="fair">Fair</option>
                                  <option value="damaged">Damaged</option>
                                  <option value="lost">Lost</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setReturning(null)}
                                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleReturnAsset(asset.id)}
                                  disabled={returning === asset.id}
                                  className="flex-1 rounded-lg bg-[#ff6a00] px-4 py-2 text-white transition hover:bg-[#ff6a00]/90 disabled:opacity-50"
                                >
                                  {returning === asset.id ? (
                                    <Loader size={16} className="animate-spin" />
                                  ) : (
                                    'Return'
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

export default TenantAssetAssignmentPage;
