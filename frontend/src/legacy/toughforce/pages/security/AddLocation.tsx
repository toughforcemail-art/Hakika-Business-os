// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import {
  Building2, 
  MapPin, 
  Target, 
  ArrowLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import CountyPicker from '../../components/security/CountyPicker';

const AddLocation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') as 'centre' | 'site' | 'post' || 'centre';
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [centres, setCentres] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [id, type]);

  const fetchInitialData = async () => {
    setInitialLoading(true);
    try {
      // Fetch parents for dropdowns
      const { data: cData } = await supabase.from('security_centres').select('id, name').order('name');
      if (cData) setCentres(cData);

      const { data: sData } = await supabase.from('security_sites').select('id, name').order('name');
      if (sData) setSites(sData);

      if (id) {
        let table = '';
        if (type === 'centre') table = 'security_centres';
        else if (type === 'site') table = 'security_sites';
        else if (type === 'post') table = 'security_posts';

        const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
        if (error) throw error;
        setFormData(data);
      } else {
        setFormData({});
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setToast({ message: 'Failed to load data', type: 'error' });
    }
    setInitialLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let table = '';
    if (type === 'centre') table = 'security_centres';
    else if (type === 'site') table = 'security_sites';
    else if (type === 'post') table = 'security_posts';

    try {
      if (type === 'centre' && !id) {
        // Check for existing branch name
        const { data: existing } = await supabase
          .from('security_centres')
          .select('id')
          .ilike('name', formData.name?.trim())
          .single();
        
        if (existing) {
          setToast({ message: `A branch with the name "${formData.name}" already exists!`, type: 'error' });
          setLoading(false);
          return;
        }
      }

      if (id) {
        const { error } = await supabase.from(table).update(formData).eq('id', id);
        if (error) throw error;
        setToast({ message: `${type === 'centre' ? 'Branch' : type === 'site' ? 'Site' : 'Post'} updated successfully!`, type: 'success' });
      } else {
        const insertPayload = {
          ...formData,
          status: formData.status || 'active',
        };
        const { error } = await supabase.from(table).insert([insertPayload]).select().single();
        if (error) throw error;

        setToast({ message: `${type === 'centre' ? 'Branch' : type === 'site' ? 'Site' : 'Post'} added successfully!`, type: 'success' });
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          id ? `${type === 'centre' ? 'Branch' : type === 'site' ? 'Site' : 'Post'} Updated` : `New ${type === 'centre' ? 'Branch' : type === 'site' ? 'Site' : 'Post'} Added`,
          `${formData.name} has been processed in Locations Management.`,
          'success'
        );
      }

      setTimeout(() => navigate('/app/security/sites'), 1500);
    } catch (error) {
      console.error("Save error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  const getSubmitLabel = () => {
    const label = type === 'centre' ? 'Branch' : type === 'site' ? 'Site' : 'Post';
    return id ? `Save ${label}` : `Create ${label}`;
  };

  if (initialLoading) {
    return (
      <div className="min-h-full w-full flex items-center justify-center bg-white dark:bg-dark-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type} 
        onClose={() => setToast(null)} 
      />
      
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/security/sites')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
            title="Go back to Sites & Branches"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 capitalize">
              {type === 'centre' ? <Building2 className="text-brand-purple" /> : type === 'site' ? <MapPin className="text-brand-purple" /> : <Target className="text-brand-purple" />}
              {id ? 'Edit' : 'Add'} {type === 'centre' ? 'Branch' : type}
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              {id ? 'Modify' : 'Create'} security operational {type === 'centre' ? 'Branch' : type === 'site' ? 'Site' : 'Post'}
            </p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-xl"
        >
          <form onSubmit={handleSave} className="space-y-6">
            {type === 'centre' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Branch Name</label>
                  <input 
                    required
                    title="Branch Name"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <CountyPicker
                    value={formData.county || ''}
                    onChange={(county) => setFormData({ ...formData, county })}
                    label="County"
                    title="Branch County"
                    placeholder="Select county"
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Location</label>
                    <input 
                      title="Location"
                      className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'site' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Parent Branch</label>
                  <select 
                    required
                    title="Select parent branch"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.centre_id || ''}
                    onChange={(e) => setFormData({...formData, centre_id: e.target.value})}
                  >
                     <option value="">Select Branch</option>
                     {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Site Name</label>
                  <input 
                    required
                    title="Site Name"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <CountyPicker
                    value={formData.county || ''}
                    onChange={(county) => setFormData({ ...formData, county })}
                    label="County"
                    title="Site County"
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Address</label>
                    <input 
                      title="Address"
                      className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'post' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Parent Site</label>
                  <select 
                    required
                    title="Select parent site"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.site_id || ''}
                    onChange={(e) => setFormData({...formData, site_id: e.target.value})}
                  >
                     <option value="">Select Site</option>
                     {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Post Name</label>
                  <input 
                    required
                    title="Post Name"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Guards Required</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    title="Guards Required"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none font-bold"
                    value={formData.required_guards || 1}
                    onChange={(e) => setFormData({...formData, required_guards: parseInt(e.target.value)})}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-8">
              <button 
                type="button" 
                onClick={() => navigate('/app/security/sites')} 
                className="px-8 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-8 py-3 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20 disabled:opacity-50"
              >
                {loading ? 'Processing...' : getSubmitLabel()}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default AddLocation;
