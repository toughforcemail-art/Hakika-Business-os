// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Building2, MapPin, LayoutGrid, Plus, Search, 
  ArrowLeft, DollarSign, TrendingUp, AlertCircle,
  ChevronRight, Calendar, Receipt, X, ChevronLeft
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../context/AccessContext';
import { calculatePlannedUnitTotals, getUnitTypeLabel, normalizePlannedUnitMix, PlannedUnitMixEntry } from '../../utils/realEstate';

interface Property {
  id: string;
  name: string;
  address: string;
  property_type: string;
  photos?: string[];
  photo_url?: string;
  county?: string;
  total_bedrooms?: number;
  components?: string[];
  planned_unit_mix?: PlannedUnitMixEntry[] | null;
}

interface PropertyStats {
  total_units: number;
  vacant_units: number;
  occupied_units: number;
  month_due: number;
  month_paid: number;
  total_due: number;
  total_paid: number;
}

interface Unit {
  id: string;
  unit_number: string;
  type: string;
  rent_amount: number;
  status: string;
  bedrooms?: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date: string;
  tenant_id: string;
}

export default function PropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAccess();
  const [property, setProperty] = useState<Property | null>(null);
  const [stats, setStats] = useState<PropertyStats | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'units' | 'financials'>('units');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [unitSearch, setUnitSearch] = useState('');

  const fetchPropertyData = async () => {
    setLoading(true);
    try {
      let propertyQuery = supabase
        .from('re_properties')
        .select('*')
        .eq('id', id);
      let statsQuery = supabase
        .from('re_property_stats')
        .select('*')
        .eq('property_id', id);
      let unitsQuery = supabase
        .from('re_units')
        .select('*')
        .eq('property_id', id)
        .order('unit_number');

      const { data: propData, error: propError } = await propertyQuery.single();
      
      if (propError) throw propError;
      setProperty({ ...propData, planned_unit_mix: normalizePlannedUnitMix(propData.planned_unit_mix) });

      const { data: statsData, error: statsError } = await statsQuery.single();
      
      if (!statsError) {
        setStats(statsData);
      }

      const { data: unitData, error: unitError } = await unitsQuery;
      
      if (unitError) throw unitError;
      setUnits(unitData || []);

      const unitIds = unitData.map((u: any) => u.id);
      if (unitIds.length > 0) {
        const { data: invData, error: invError } = await supabase
          .from('re_invoices')
          .select('*')
          .in('unit_id', unitIds)
          .order('invoice_date', { ascending: false })
          .limit(5);
        
        if (!invError) {
          setRecentInvoices(invData || []);
        }
      }

    } catch (error: any) {
      console.error('Error fetching property data:', error);
      setToast({ message: error.message || 'Failed to load property details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchPropertyData();
    }
  }, [id, profile?.company_id]);

  if (loading) return <div className="p-12 flex justify-center"><CustomLoader size={40} label="Loading property details..." /></div>;
  if (!property) return <div className="p-12 text-center text-gray-500">Property not found.</div>;

  const collectionRate = stats?.month_due ? Math.round((stats.month_paid / stats.month_due) * 100) : 0;
  const occupancyRate = stats?.total_units ? Math.round((stats.occupied_units / stats.total_units) * 100) : 0;
  const allPhotos = property?.photos || (property?.photo_url ? [property.photo_url] : []);
  const plannedMix = normalizePlannedUnitMix(property?.planned_unit_mix);
  const plannedMixTotals = calculatePlannedUnitTotals(plannedMix);
  const filteredUnits = units.filter((unit) =>
    unit.unit_number.toLowerCase().includes(unitSearch.toLowerCase()) ||
    unit.type.toLowerCase().includes(unitSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            to="/app/real-estate/properties"
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-card rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div 
            className="w-16 h-16 md:w-20 md:h-20 bg-brand-purple/10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-purple transition-all"
            onClick={() => allPhotos.length > 0 && setSelectedImage(allPhotos[0])}
          >
            {property?.photo_url ? (
              <img src={property.photo_url} alt={property.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-6 h-6 md:w-8 md:h-8 text-brand-purple shrink-0" />
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              {property?.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 text-sm md:text-base mt-2 font-medium">
              <MapPin className="w-4 h-4 text-brand-purple" />
              {property.county || 'Nairobi'}, Kenya
            </p>
            {(plannedMix.length > 0 || (property.components || []).length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {plannedMix.slice(0, 3).map((entry) => (
                  <span key={entry.id} className="rounded-full bg-brand-purple/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-purple">
                    {entry.count} {getUnitTypeLabel(entry.type)}
                  </span>
                ))}
                {(property.components || []).slice(0, 2).map((component) => (
                  <span key={component} className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:bg-white/5 dark:text-gray-300">
                    {component}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to={`/app/real-estate/houses?property_id=${id}&action=add`}
            className="px-6 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all flex items-center gap-2 shadow-lg shadow-brand-purple/20 font-bold text-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Unit
          </Link>
        </div>
      </div>

      {/* Image Gallery Quick View */}
      {allPhotos.length > 1 && (
        <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
          {allPhotos.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentImageIndex(idx);
                setSelectedImage(photo);
              }}
              className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden shrink-0 border-2 border-transparent hover:border-brand-purple transition-all shadow-sm"
            >
              <img src={photo} alt={`Property ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm group hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shrink-0">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">Occupancy</p>
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">{occupancyRate}%</h3>
            </div>
          </div>
          <div className="mt-6 w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
          <p className="text-xs font-bold text-gray-400 mt-3 uppercase tracking-wider">{stats?.occupied_units} of {stats?.total_units} units</p>
        </div>

        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm group hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest">Collection</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{collectionRate}%</h3>
            </div>
          </div>
          <div className="mt-6 w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${collectionRate}%` }}
            />
          </div>
          <p className="text-xs font-bold text-gray-400 mt-3 uppercase tracking-wider">Ksh {stats?.month_paid?.toLocaleString()} of {stats?.month_due?.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm group hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-purple/10 rounded-2xl text-brand-purple group-hover:scale-110 transition-transform shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest">Revenue</p>
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Ksh {stats?.total_paid?.toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase text-brand-purple tracking-widest">
            <TrendingUp className="w-3 h-3" />
            <span>Lifetime collection</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm group hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest">Arrears</p>
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Ksh {(stats?.total_due! - stats?.total_paid!).toLocaleString()}</h3>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase text-rose-500 tracking-widest">
            <TrendingUp className="w-3 h-3 rotate-180" />
            <span>Outstanding balance</span>
          </div>
        </div>
        </div>

      {plannedMixTotals.totalUnits > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-dark-surface">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Planned Inventory</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{plannedMixTotals.totalUnits}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Recorded at property setup stage.</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-dark-surface">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Planned Bedrooms</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{plannedMixTotals.totalBedrooms}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Used to guide unit inspections and room readiness.</p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-dark-surface">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Actual Units Recorded</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{units.length}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add more units from here as the inventory grows.</p>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="bg-white dark:bg-dark-surface rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-white/10 bg-brand-purple/5 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('units')}
            className={`px-4 md:px-8 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'units' ? 'text-brand-purple bg-white dark:bg-dark-surface border-b-2 border-brand-purple' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}`}
          >
            Inventory
          </button>
          <button 
            onClick={() => setActiveTab('financials')}
            className={`px-4 md:px-8 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'financials' ? 'text-brand-purple bg-white dark:bg-dark-surface border-b-2 border-brand-purple' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}`}
          >
            Financials
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'units' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Property Units ({units.length})</h3>
                <div className="relative group w-full md:w-72">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-purple transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Search units..."
                    value={unitSearch}
                    onChange={(event) => setUnitSearch(event.target.value)}
                    className="pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition-all w-full font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUnits.map((unit) => (
                  <div key={unit.id} className="p-6 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/10 hover:border-brand-purple/30 hover:shadow-lg transition-all group/unit">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center font-black text-brand-purple text-lg">
                          {unit.unit_number}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {unit.type} {unit.bedrooms && unit.bedrooms > 0 ? `• ${unit.bedrooms} BR` : ''}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Rent: Ksh {unit.rent_amount.toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`px-2 md:px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        unit.status === 'occupied' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-brand-purple/10 text-brand-purple'
                      }`}>
                        {unit.status}
                      </span>
                    </div>
                    <Link 
                      to={`/app/real-estate/houses?edit=${unit.id}`}
                      className="w-full py-3 flex items-center justify-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-400 hover:text-brand-purple bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 hover:border-brand-purple/20 transition-all"
                    >
                      View Details
                      <ChevronRight className="w-3 h-3 group-hover/unit:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'financials' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">Recent Billing</h3>
                <Link to="/app/real-estate/invoice/list" className="text-[10px] font-black uppercase tracking-widest text-brand-purple hover:text-brand-pink transition-colors">View All Invoices</Link>
              </div>
              
              <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10 text-gray-400 font-black text-xs uppercase tracking-widest">
                      <th className="py-4 px-6 text-brand-purple">Invoice #</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Due</th>
                      <th className="py-4 px-6 text-emerald-500">Balance</th>
                      <th className="py-4 px-6">Date</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-transparent">
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id} className="group hover:bg-brand-purple/5 transition-all">
                        <td className="py-5 px-6 font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                          <div className="flex items-center gap-3">
                            <Receipt className="w-4 h-4 text-brand-purple/40" />
                            {inv.invoice_number}
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-5 px-6 font-bold text-gray-900 dark:text-white tracking-tight">Ksh {inv.amount_due.toLocaleString()}</td>
                        <td className="py-5 px-6 text-emerald-500 font-black tracking-tight italic">Ksh {(inv.amount_due - inv.amount_paid).toLocaleString()}</td>
                        <td className="py-5 px-6 text-xs font-medium text-gray-400">{new Date(inv.due_date).toLocaleDateString()}</td>
                        <td className="py-5 px-6 text-right">
                          <Link to="/app/real-estate/invoice/list" title="View Invoice details" className="p-2 bg-white dark:bg-white/5 rounded-lg border border-transparent group-hover:border-brand-purple/30 group-hover:text-brand-purple transition-all text-gray-400 inline-flex items-center">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
               {recentInvoices.length === 0 && (
                 <div className="flex flex-col items-center justify-center p-12 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                   <Calendar className="w-12 h-12 text-gray-300 mb-3" />
                   <p className="text-gray-500 text-sm">No billing records found for this property.</p>
                   <Link to="/app/real-estate/invoice/auto-billing" className="mt-4 px-4 py-2 bg-white dark:bg-dark-bg border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600">
                     Generate Monthly Bills
                   </Link>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <CustomToast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <button 
            onClick={() => setSelectedImage(null)}
            title="Close image gallery"
            className="absolute top-6 right-6 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all z-[110]"
          >
            <X size={24} />
          </button>

          {allPhotos.length > 1 && (
            <>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const prevIdx = (currentImageIndex - 1 + allPhotos.length) % allPhotos.length;
                  setCurrentImageIndex(prevIdx);
                  setSelectedImage(allPhotos[prevIdx]);
                }}
                title="Previous image"
                className="absolute left-4 md:left-8 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all z-[110]"
              >
                <ChevronLeft size={32} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const nextIdx = (currentImageIndex + 1) % allPhotos.length;
                  setCurrentImageIndex(nextIdx);
                  setSelectedImage(allPhotos[nextIdx]);
                }}
                title="Next image"
                className="absolute right-4 md:left-auto md:right-8 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all z-[110]"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12" onClick={() => setSelectedImage(null)}>
            <img 
              src={selectedImage} 
              alt="Full view" 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />
            {allPhotos.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 text-white rounded-full text-sm font-medium">
                {currentImageIndex + 1} / {allPhotos.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
