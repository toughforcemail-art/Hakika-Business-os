// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { Package, ArrowLeft, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { motion } from 'framer-motion';

interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  condition: string;
  color?: string;
  status: string;
  image_url?: string;
  created_at?: string;
}

const AssetTracking: React.FC = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hr_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      setToast({ message: `Failed to load assets: ${sanitizeError(error)}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'assigned':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'maintenance':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'disposed':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'New':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'Good':
        return 'text-blue-600 dark:text-blue-400';
      case 'Fair':
        return 'text-amber-600 dark:text-amber-400';
      case 'Poor':
        return 'text-rose-600 dark:text-rose-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast
        isVisible={!!toast}
        message={toast?.message || ''}
        type={toast?.type}
        onClose={() => setToast(null)}
      />

      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/app/hr')} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
              title="Go back"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Package className="text-brand-purple" /> Asset Tracking
              </h1>
              <p className="text-sm text-gray-500 dark:text-dark-text mt-1">
                Track all assets in your inventory
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, serial number, or type..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-brand-purple outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <select
              className="px-4 py-2 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-brand-purple outline-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
        </div>

        {/* Assets Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {assets.length === 0 ? 'No assets found. Add one to get started.' : 'No assets match your search.'}
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl overflow-hidden shadow-lg"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Asset Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Serial Number</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Condition</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Color</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-dark-bg/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {asset.image_url && (
                            <img 
                              src={asset.image_url} 
                              alt={asset.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          )}
                          <span className="font-semibold">{asset.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{asset.type}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{asset.serial_number}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-semibold ${getConditionColor(asset.condition)}`}>
                          {asset.condition}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{asset.color || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/app/hr/add-asset`, { state: { id: asset.id } })}
                          className="text-brand-purple hover:underline text-sm font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Summary Stats */}
        {!loading && assets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-6"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Assets</p>
              <p className="text-3xl font-bold text-brand-purple">{assets.length}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-6"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Available</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {assets.filter(a => a.status === 'available').length}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-6"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Assigned</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {assets.filter(a => a.status === 'assigned').length}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-6"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">In Maintenance</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {assets.filter(a => a.status === 'maintenance').length}
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetTracking;
