// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { 
  Package, 
  ArrowLeft,
  Wand2,
  CheckCircle2,
  Plus,
  Upload
} from 'lucide-react';
import { motion } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';
import AddableSelect from '../../components/AddableSelect';

function getAssetUploadToastMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();

  if (/invalid.*jwt|jwt.*invalid|authorization.*failed|unauthorized|session.*expired|expired.*session/.test(lower)) {
    return 'Asset image upload failed because your session expired or was rejected. Sign in again, then upload the image once more.';
  }

  if (/imagekit|upload|storage|bucket/.test(lower)) {
    return 'Asset image upload failed while sending the file to storage. Check your connection and try again.';
  }

  return sanitizeError(error);
}

const AddAsset: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  interface AssetFormData {
    name: string;
    type: string;
    serial_numbers: string;
    condition: string;
    color: string;
    image_url: string;
    catalog_id?: string;
  }

  const [formData, setFormData] = useState<AssetFormData>({
    name: '',
    type: 'Radio',
    serial_numbers: '', 
    condition: 'New',
    color: '',
    image_url: ''
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const location = useLocation();

  useEffect(() => {
    fetchCatalog();
    const state = location.state as { modelName?: string };
    if (state?.modelName) {
      setFormData((prev: AssetFormData) => ({ ...prev, name: state.modelName! }));
    }
    if (!isEditing && !formData.serial_numbers) {
      generateSerialNumber();
    }
  }, [location.state, isEditing]);

  useEffect(() => {
    const loadAsset = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('security_assets')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Asset not found.');

        setFormData({
          name: data.name || '',
          type: data.type || 'Radio',
          serial_numbers: data.serial_number || '',
          condition: data.condition || 'New',
          color: data.color || '',
          image_url: data.image_url || '',
          catalog_id: data.catalog_id || '',
        });
      } catch (error) {
        setToast({ message: getAssetUploadToastMessage(error), type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    void loadAsset();
  }, [id]);

  const fetchCatalog = async () => {
    try {
      const { data: cData } = await supabase.from('security_asset_catalog').select('*').order('model_name');
      if (cData) setCatalog(cData);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const generateSerialNumber = () => {
    const prefix = formData.type.substring(0, 3).toUpperCase();
    const random = Math.random().toString(10).substring(2, 6);
    const randomAlpha = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sn = `SN-${prefix}-${random}-${randomAlpha}`;
    setFormData({ ...formData, serial_numbers: formData.serial_numbers ? `${formData.serial_numbers}\n${sn}` : sn });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      setToast({ message: 'Uploading asset image...', type: 'success' });
      const url = await UnifiedStorageService.upload(file, {
        folder: '/security_assets',
        bucket: 'asset-documents'
      });
      setFormData((prev: AssetFormData) => ({ ...prev, image_url: url }));
      setToast({ message: 'Image uploaded successfully!', type: 'success' });
    } catch (error) {
      setToast({ message: getAssetUploadToastMessage(error), type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditing && !id) {
        throw new Error('Missing asset identifier.');
      }

      let catalogId = formData.catalog_id;
      if (!catalogId) {
        const match = catalog.find(m => m.model_name.toLowerCase() === formData.name.toLowerCase());
        if (match) {
          catalogId = match.id;
        } else {
          const { data: newModel, error: catError } = await supabase
            .from('security_asset_catalog')
            .insert([{ model_name: formData.name, type: formData.type, default_condition: formData.condition }])
            .select()
            .single();
          if (catError) throw catError;
          catalogId = newModel.id;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (isEditing) {
        const serialNumber = formData.serial_numbers.trim();
        if (!serialNumber) throw new Error('Serial number is required.');

        const { error } = await supabase
          .from('security_assets')
          .update({
            name: formData.name,
            type: formData.type,
            serial_number: serialNumber,
            condition: formData.condition,
            color: formData.color,
            catalog_id: catalogId,
            image_url: formData.image_url,
          })
          .eq('id', id);
        if (error) throw error;

        if (user) {
          NotificationService.sendNotification(user.id, 'Asset Inventory Updated', `${formData.name} was updated successfully.`, 'success');
        }

        setToast({ message: 'Asset updated successfully', type: 'success' });
        setTimeout(() => navigate('/app/security/assets'), 1200);
      } else {
        const snList = formData.serial_numbers.split('\n').map((s: string) => s.trim()).filter((s: string) => s !== '');
        if (snList.length === 0) throw new Error("At least one serial number is required.");

        const assetsToInsert = snList.map((sn: string) => ({
          name: formData.name,
          type: formData.type,
          serial_number: sn,
          condition: formData.condition,
          color: formData.color,
          catalog_id: catalogId,
          image_url: formData.image_url,
          status: 'available'
        }));

        const { error } = await supabase.from('security_assets').insert(assetsToInsert);
        if (error) throw error;
        
        if (user) {
          NotificationService.sendNotification(user.id, 'Asset Inventory Updated', `${snList.length} unit(s) of ${formData.name} registered.`, 'success');
        }

        setToast({ message: `${snList.length} unit(s) registered successfully`, type: 'success' });
        setTimeout(() => navigate('/app/security/assets'), 1500);
      }
    } catch (error) {
      setToast({ message: isEditing ? `Update failed: ${sanitizeError(error)}` : sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !id) return;

    const confirmed = window.confirm(
      `Delete ${formData.name || 'this asset'}? This will permanently remove the record from inventory.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from('security_assets').delete().eq('id', id);
      if (error) throw error;

      setToast({ message: 'Asset deleted successfully', type: 'success' });
      setTimeout(() => navigate('/app/security/assets'), 1200);
    } catch (error) {
      setToast({ message: `Delete failed: ${sanitizeError(error)}`, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast
        isVisible={!!toast}
        message={toast?.message || ''}
        type={toast?.type}
        title={toast?.type === 'error' ? (isEditing ? 'Update Failed' : 'Upload Failed') : undefined}
        onClose={() => setToast(null)}
      />
      
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/security/assets')} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors" title="Go back to Assets list">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="text-brand-purple" /> {isEditing ? 'Edit Asset' : 'Register New Asset'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              {isEditing ? 'Update the asset details or remove the record from inventory.' : 'Add hardware or gear to security inventory'}
            </p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Equipment Model / Name</label>
                <div className="flex items-center gap-2">
                  {formData.catalog_id ? (
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                      <CheckCircle2 size={10}/> Catalog Match
                    </span>
                  ) : formData.name.length > 3 ? (
                    <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                      <Plus size={10}/> New Model
                    </span>
                  ) : null}
                </div>
              </div>
              <input required list="catalog-suggestions" placeholder="e.g. Motorola CP200..." className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" value={formData.name} onChange={(e) => {
                const name = e.target.value;
                const model = catalog.find(m => m.model_name === name);
                if (model) {
                  setFormData({ ...formData, name: model.model_name, catalog_id: model.id, type: model.type, condition: model.default_condition });
                } else {
                  setFormData({ ...formData, name: name, catalog_id: '' });
                }
              }} />
              <datalist id="catalog-suggestions">{catalog.map(m => <option key={m.id} value={m.model_name}>{m.type}</option>)}</datalist>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <AddableSelect label="Equipment Type" tableName="sec_asset_types" value={formData.type} onChange={(val) => setFormData({...formData, type: val})} required />
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Color / Finish</label>
                  <input className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} placeholder="e.g. Black, Metallic..." />
               </div>
               <AddableSelect label="Condition" tableName="sec_asset_conditions" value={formData.condition} onChange={(val) => setFormData({...formData, condition: val})} required />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">
                {isEditing ? 'Serial Number' : 'Serial Numbers (One per Line)'}
              </label>
              <div className="flex gap-2">
                {isEditing ? (
                  <input
                    required
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.serial_numbers}
                    onChange={(e) => setFormData({ ...formData, serial_numbers: e.target.value })}
                    placeholder="SN-10293"
                  />
                ) : (
                  <textarea required rows={4} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-brand-purple outline-none" value={formData.serial_numbers} onChange={(e) => setFormData({...formData, serial_numbers: e.target.value})} placeholder="SN-10293&#10;SN-10294" />
                )}
                {!isEditing && (
                  <button type="button" onClick={generateSerialNumber} className="px-4 bg-brand-purple/10 text-brand-purple rounded-xl hover:bg-brand-purple hover:text-white transition-all" title="Auto-generate Serial Number"><Wand2 size={18} /></button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Product Image (Optional)</label>
              <div className="flex flex-col gap-4">
                {formData.image_url && (
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 group">
                    <img src={formData.image_url} alt="Asset" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                  </div>
                )}
                <div className="relative">
                  <input type="file" id="asset-image" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                  <label htmlFor="asset-image" className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl cursor-pointer hover:border-brand-purple transition-all ${formData.image_url ? 'hidden' : 'flex'}`}>
                    <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center text-brand-purple"><Upload size={24}/></div>
                    <div className="text-center">
                      <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{uploading ? 'Uploading...' : 'Upload Asset Photo'}</span>
                      <p className="text-[10px] text-gray-400 uppercase mt-1">PNG, JPG or WEBP</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || loading || uploading}
                  className="px-8 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Asset'}
                </button>
              )}
              <button type="button" onClick={() => navigate('/app/security/assets')} className="px-8 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
              <button type="submit" disabled={loading || uploading || deleting} className="px-8 py-3 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20 disabled:opacity-50">{loading ? (isEditing ? 'Saving...' : 'Registering...') : (isEditing ? 'Save Changes' : 'Register Asset')}</button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default AddAsset;
