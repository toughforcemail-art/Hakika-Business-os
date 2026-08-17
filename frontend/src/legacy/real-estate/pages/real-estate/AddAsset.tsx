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
  const [companies, setCompanies] = useState<any[]>([]);

  interface AssetFormData {
    name: string;
    type: string;
    serial_numbers: string;
    condition: string;
    color: string;
    image_url: string;
    catalog_id?: string;
    company_id?: string;
  }

  const [formData, setFormData] = useState<AssetFormData>({
    name: '',
    type: 'Equipment',
    serial_numbers: '', 
    condition: 'New',
    color: '',
    image_url: '',
    company_id: ''
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const location = useLocation();

  useEffect(() => {
    fetchCatalog();
    fetchCompanies();
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
          .from('re_assets')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Asset not found.');

        setFormData({
          name: data.name || '',
          type: data.type || 'Equipment',
          serial_numbers: data.serial_number || '',
          condition: data.condition || 'New',
          color: data.color || '',
          image_url: data.image_url || '',
          catalog_id: data.catalog_id || '',
          company_id: data.company_id || ''
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
      const { data: cData } = await supabase.from('re_asset_catalog').select('*').order('model_name');
      if (cData) setCatalog(cData);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data: cData } = await supabase.from('companies').select('*').order('name');
      if (cData) setCompanies(cData);
    } catch (error) {
      console.error("Fetch companies error:", error);
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
        folder: '/re_assets',
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
            .from('re_asset_catalog')
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
          .from('re_assets')
          .update({
            name: formData.name,
            type: formData.type,
            serial_number: serialNumber,
            condition: formData.condition,
            color: formData.color,
            catalog_id: catalogId,
            image_url: formData.image_url,
            company_id: formData.company_id || null
          })
          .eq('id', id);
        if (error) throw error;

        if (user) {
          NotificationService.sendNotification(user.id, 'Asset Inventory Updated', `${formData.name} was updated successfully.`, 'success');
        }

        setToast({ message: 'Asset updated successfully', type: 'success' });
        setTimeout(() => navigate('/app/real-estate/assets'), 1200);
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
          status: 'available',
          company_id: formData.company_id || null
        }));

        const { error } = await supabase.from('re_assets').insert(assetsToInsert);
        if (error) throw error;
        
        if (user) {
          NotificationService.sendNotification(user.id, 'Asset Inventory Updated', `${snList.length} unit(s) of ${formData.name} registered.`, 'success');
        }

        setToast({ message: `${snList.length} unit(s) registered successfully`, type: 'success' });
        setTimeout(() => navigate('/app/real-estate/assets'), 1500);
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
      const { error } = await supabase.from('re_assets').delete().eq('id', id);
      if (error) throw error;

      setToast({ message: 'Asset deleted successfully', type: 'success' });
      setTimeout(() => navigate('/app/real-estate/assets'), 1200);
    } catch (error) {
      setToast({ message: `Delete failed: ${sanitizeError(error)}`, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-gray-50 text-gray-900 dark:bg-[#061622] dark:text-white">
      <CustomToast
        isVisible={!!toast}
        message={toast?.message || ''}
        type={toast?.type}
        title={toast?.type === 'error' ? (isEditing ? 'Update Failed' : 'Upload Failed') : undefined}
        onClose={() => setToast(null)}
      />
      
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/real-estate/assets')} className="rounded-xl border border-gray-200 bg-white p-2 text-slate-700 transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:text-white" title="Go back to Assets list">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
              <Package className="text-[#ff6a00]" /> {isEditing ? 'Edit Asset' : 'Register New Asset'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isEditing ? 'Update the asset details or remove the record from inventory.' : 'Add equipment or gear to property inventory'}
            </p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-gray-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-[#0f1729]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Company</label>
              <select 
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[#ff6a00]/40 focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#0A1628] dark:text-white"
                value={formData.company_id || ''}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="">Select a company (optional)</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Equipment Model / Name</label>
                <div className="flex items-center gap-2">
                  {formData.catalog_id ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      <CheckCircle2 size={10}/> Catalog Match
                    </span>
                  ) : formData.name.length > 3 ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-500">
                      <Plus size={10}/> New Model
                    </span>
                  ) : null}
                </div>
              </div>
              <input required list="catalog-suggestions" placeholder="e.g. Laptop, Desk, Monitor..." className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[#ff6a00]/40 focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#0A1628] dark:text-white" value={formData.name} onChange={(e) => {
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
               <AddableSelect label="Equipment Type" tableName="re_asset_types" value={formData.type} onChange={(val) => setFormData({...formData, type: val})} required allowCustomOption={true} />
               <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Color / Finish</label>
                  <input className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[#ff6a00]/40 focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#0A1628] dark:text-white" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} placeholder="e.g. Black, Silver..." />
               </div>
               <AddableSelect label="Condition" tableName="re_asset_conditions" value={formData.condition} onChange={(val) => setFormData({...formData, condition: val})} required allowCustomOption={true} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {isEditing ? 'Serial Number' : 'Serial Numbers (One per Line)'}
              </label>
              <div className="flex gap-2">
                {isEditing ? (
                  <input
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-mono outline-none focus:border-[#ff6a00]/40 focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#0A1628] dark:text-white"
                    value={formData.serial_numbers}
                    onChange={(e) => setFormData({ ...formData, serial_numbers: e.target.value })}
                    placeholder="SN-10293"
                  />
                ) : (
                  <textarea required rows={4} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-mono outline-none focus:border-[#ff6a00]/40 focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#0A1628] dark:text-white" value={formData.serial_numbers} onChange={(e) => setFormData({...formData, serial_numbers: e.target.value})} placeholder="SN-10293&#10;SN-10294" />
                )}
                {!isEditing && (
                  <button type="button" onClick={generateSerialNumber} className="rounded-xl bg-[#ff6a00]/10 px-4 text-[#ff6a00] transition-all hover:bg-[#ff6a00] hover:text-white" title="Auto-generate Serial Number"><Wand2 size={18} /></button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Product Image (Optional)</label>
              <div className="flex flex-col gap-4">
                {formData.image_url && (
                  <div className="group relative w-full aspect-video overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10">
                    <img src={formData.image_url} alt="Asset" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="absolute right-2 top-2 rounded-xl bg-rose-500 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100">Remove</button>
                  </div>
                )}
                <div className="relative">
                  <input type="file" id="asset-image" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                  <label htmlFor="asset-image" className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-8 transition-all hover:border-[#ff6a00]/40 dark:border-white/10 ${formData.image_url ? 'hidden' : 'flex'}`}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff6a00]/10 text-[#ff6a00]"><Upload size={24}/></div>
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
                  className="rounded-xl px-8 py-3 text-sm font-bold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Asset'}
                </button>
              )}
              <button type="button" onClick={() => navigate('/app/real-estate/assets')} className="rounded-xl px-8 py-3 text-sm font-bold text-slate-500 transition-all hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/5">Cancel</button>
              <button type="submit" disabled={loading || uploading || deleting} className="rounded-xl bg-[#ff6a00] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#ff6a00]/20 transition hover:bg-[#ff7a1a] disabled:opacity-50">{loading ? (isEditing ? 'Saving...' : 'Registering...') : (isEditing ? 'Save Changes' : 'Register Asset')}</button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default AddAsset;
