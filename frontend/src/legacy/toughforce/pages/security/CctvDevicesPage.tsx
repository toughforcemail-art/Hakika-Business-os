// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Camera, Copy, Database, Layers3, Pencil, Plus, Radio, RefreshCw, Search, Shield, Video, Wifi, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import type { SecurityCamera, SecurityNvrDevice, SecuritySite } from '../../types/security';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

const unwrapRelation = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
};

const normalizeNvr = (value: any): SecurityNvrDevice => ({
  ...value,
  security_sites: unwrapRelation(value?.security_sites),
});

const normalizeCamera = (value: any): SecurityCamera => ({
  ...value,
  security_sites: unwrapRelation(value?.security_sites),
  security_posts: unwrapRelation(value?.security_posts),
  security_nvr_devices: (() => {
    const nvr = unwrapRelation(value?.security_nvr_devices);
    return nvr ? normalizeNvr(nvr) : null;
  })(),
});

const formatValue = (value?: string | number | null) =>
  value === null || value === undefined || value === '' ? 'Not set' : String(value);

const getSnapshotPreview = (camera: SecurityCamera) =>
  camera.last_snapshot_url || camera.snapshot_path || '/cctv_main_gate.webp';

const getLiveTarget = (camera: SecurityCamera) =>
  camera.live_view_url || camera.security_nvr_devices?.web_url || camera.security_nvr_devices?.stream_base_url || null;

const statusConfig: Record<string, { dot: string; text: string; badge: string }> = {
  online:      { dot: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/20' },
  offline:     { dot: 'bg-rose-500',    text: 'text-rose-400',    badge: 'bg-rose-500/10 border-rose-500/20' },
  degraded:    { dot: 'bg-amber-500',   text: 'text-amber-400',   badge: 'bg-amber-500/10 border-amber-500/20' },
  maintenance: { dot: 'bg-blue-500',    text: 'text-blue-400',    badge: 'bg-blue-500/10 border-blue-500/20' },
  unknown:     { dot: 'bg-slate-500',   text: 'text-slate-400',   badge: 'bg-slate-500/10 border-slate-500/20' },
};
const getStatusConf = (s?: string | null) => statusConfig[s || 'unknown'] || statusConfig.unknown;

// --- NVR Form defaults --------------------------------------------------------
const emptyNvrForm = () => ({
  site_id: '', device_name: '', vendor: '', host: '', port: '80',
  protocol: 'http' as 'http' | 'https', web_url: '', stream_base_url: '', notes: '',
});

// --- Camera Form defaults -----------------------------------------------------
const emptyCameraForm = () => ({
  site_id: '', nvr_id: '', camera_name: '', vendor: '', channel_no: '',
  coverage_zone: '', live_view_url: '', snapshot_path: '', stream_path: '',
  status: 'unknown' as SecurityCamera['status'],
});

// --- Edit URL Form defaults ---------------------------------------------------
const emptyUrlForm = () => ({ live_view_url: '', stream_path: '' });

const CctvDevicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [centres, setCentres] = useState<any[]>([]);
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [nvrs, setNvrs] = useState<SecurityNvrDevice[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCentreId, setSelectedCentreId] = useState<'all' | string>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<'all' | string>('all');
  const [toast, setToast] = useState<ToastState>(null);

  // Modal state
  const [showAddNvr, setShowAddNvr] = useState(false);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [editNvr, setEditNvr] = useState<SecurityNvrDevice | null>(null);
  const [editUrlCamera, setEditUrlCamera] = useState<SecurityCamera | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nvrForm, setNvrForm] = useState(emptyNvrForm());
  const [cameraForm, setCameraForm] = useState(emptyCameraForm());
  const [urlForm, setUrlForm] = useState(emptyUrlForm());

  const fetchData = async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [centresRes, sitesRes, nvrsRes, camerasRes] = await Promise.all([
        supabase.from('security_centres').select('id, name').order('name'),
        supabase.from('security_sites').select('id, name, centre_id, county, address').order('name'),
        supabase.from('security_nvr_devices').select('id, site_id, device_name, vendor, model, host, port, protocol, stream_base_url, web_url, status, last_sync_at, last_health_check_at, notes, metadata, security_sites(id, name, county, address)').order('device_name'),
        supabase.from('security_cameras').select(`
          id, site_id, post_id, nvr_id, camera_name, vendor, channel_no, coverage_zone,
          stream_path, snapshot_path, live_view_url, status, last_snapshot_url,
          last_snapshot_at, last_seen_at, metadata,
          security_sites(id, name, county, address),
          security_posts(id, name, required_guards),
          security_nvr_devices(id, site_id, device_name, vendor, model, host, port, protocol, stream_base_url, web_url, status, last_sync_at, last_health_check_at, notes, metadata)
        `).order('camera_name'),
      ]);
      if (centresRes.error) throw centresRes.error;
      if (sitesRes.error) throw sitesRes.error;
      if (nvrsRes.error) throw nvrsRes.error;
      if (camerasRes.error) throw camerasRes.error;
      setCentres((centresRes.data || []) as any[]);
      setSites((sitesRes.data || []) as SecuritySite[]);
      setNvrs((nvrsRes.data || []).map(normalizeNvr));
      setCameras((camerasRes.data || []).map(normalizeCamera));
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void fetchData(); }, []);

  const siteMap = useMemo(() => {
    const map = new Map<string, SecuritySite>();
    sites.forEach((s) => map.set(s.id, s));
    return map;
  }, [sites]);

  const filteredCameras = cameras.filter((camera) => {
    const matchesQuery = !query.trim()
      || camera.camera_name.toLowerCase().includes(query.toLowerCase())
      || (camera.coverage_zone || '').toLowerCase().includes(query.toLowerCase())
      || camera.vendor.toLowerCase().includes(query.toLowerCase());
    const site = sites.find(s => s.id === camera.site_id);
    const matchesCentre = selectedCentreId === 'all' || site?.centre_id === selectedCentreId;
    const matchesSite = selectedSiteId === 'all' || camera.site_id === selectedSiteId;
    return matchesQuery && matchesCentre && matchesSite;
  });

  const filteredNvrs = useMemo(() => {
    return nvrs.filter(n => {
      const site = sites.find(s => s.id === n.site_id);
      const matchesCentre = selectedCentreId === 'all' || site?.centre_id === selectedCentreId;
      const matchesSite = selectedSiteId === 'all' || n.site_id === selectedSiteId;
      return matchesCentre && matchesSite;
    });
  }, [nvrs, selectedCentreId, selectedSiteId, sites]);

  const groupedByNvr = useMemo(() => {
    const map = new Map<string, SecurityCamera[]>();
    filteredCameras.forEach((camera) => {
      const key = camera.nvr_id || 'unassigned';
      const current = map.get(key) || [];
      current.push(camera);
      map.set(key, current);
    });
    return map;
  }, [filteredCameras]);

  const copyCamera = async (camera: SecurityCamera) => {
    const block = [
      `Camera: ${camera.camera_name}`,
      `Site: ${siteMap.get(camera.site_id)?.name || 'Unassigned'}`,
      `Recorder: ${camera.security_nvr_devices?.device_name || 'Unassigned'}`,
      `Host: ${camera.security_nvr_devices?.host || 'Not set'}`,
      `Port: ${camera.security_nvr_devices?.port || 'Not set'}`,
      `Channel: ${formatValue(camera.channel_no)}`,
      `Coverage zone: ${camera.coverage_zone || 'Not set'}`,
      `Live target: ${getLiveTarget(camera) || 'Not set'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(block);
      setToast({ message: 'Camera details copied.', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
  };

  // --- Save NVR (add or edit) ------------------------------------------------
  const saveNvr = async () => {
    setSaving(true);
    try {
      const payload = {
        site_id: nvrForm.site_id,
        device_name: nvrForm.device_name,
        vendor: nvrForm.vendor,
        host: nvrForm.host,
        port: Number(nvrForm.port) || 80,
        protocol: nvrForm.protocol,
        web_url: nvrForm.web_url || null,
        stream_base_url: nvrForm.stream_base_url || null,
        notes: nvrForm.notes || null,
      };
      if (editNvr) {
        const { error } = await supabase.from('security_nvr_devices').update(payload).eq('id', editNvr.id);
        if (error) throw error;
        setToast({ message: 'NVR updated.', type: 'success' });
      } else {
        const { error } = await supabase.from('security_nvr_devices').insert(payload);
        if (error) throw error;
        setToast({ message: 'NVR added.', type: 'success' });
      }
      setShowAddNvr(false);
      setEditNvr(null);
      setNvrForm(emptyNvrForm());
      await fetchData(true);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // --- Save Camera -----------------------------------------------------------
  const saveCamera = async () => {
    setSaving(true);
    try {
      const payload = {
        site_id: cameraForm.site_id,
        nvr_id: cameraForm.nvr_id || null,
        camera_name: cameraForm.camera_name,
        vendor: cameraForm.vendor,
        channel_no: cameraForm.channel_no ? Number(cameraForm.channel_no) : null,
        coverage_zone: cameraForm.coverage_zone || null,
        live_view_url: cameraForm.live_view_url || null,
        snapshot_path: cameraForm.snapshot_path || null,
        stream_path: cameraForm.stream_path || null,
        status: cameraForm.status,
      };
      const { error } = await supabase.from('security_cameras').insert(payload);
      if (error) throw error;
      setToast({ message: 'Camera added.', type: 'success' });
      setShowAddCamera(false);
      setCameraForm(emptyCameraForm());
      await fetchData(true);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // --- Save URL edit ---------------------------------------------------------
  const saveUrlEdit = async () => {
    if (!editUrlCamera) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('security_cameras').update({
        live_view_url: urlForm.live_view_url || null,
        stream_path: urlForm.stream_path || null,
      }).eq('id', editUrlCamera.id);
      if (error) throw error;
      setToast({ message: 'URLs updated.', type: 'success' });
      setEditUrlCamera(null);
      setUrlForm(emptyUrlForm());
      await fetchData(true);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openEditNvr = (nvr: SecurityNvrDevice) => {
    setNvrForm({
      site_id: nvr.site_id,
      device_name: nvr.device_name,
      vendor: nvr.vendor,
      host: nvr.host,
      port: String(nvr.port),
      protocol: nvr.protocol,
      web_url: nvr.web_url || '',
      stream_base_url: nvr.stream_base_url || '',
      notes: nvr.notes || '',
    });
    setEditNvr(nvr);
    setShowAddNvr(true);
  };

  const openEditUrl = (camera: SecurityCamera) => {
    setUrlForm({
      live_view_url: camera.live_view_url || '',
      stream_path: camera.stream_path || '',
    });
    setEditUrlCamera(camera);
  };

  const inputCls = "w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-purple/50 placeholder:text-slate-600";
  const labelCls = "block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1";

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-100">
      <CustomToast message={toast?.message || ''} type={toast?.type || 'info'} isVisible={Boolean(toast)} onClose={() => setToast(null)} />

      <div className="mx-auto max-w-[1600px] space-y-8 p-6 lg:p-10">
        {/* Header */}
        <header className="flex flex-col gap-6 border-b border-white/8 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-brand-purple">
              <Radio size={12} /> CCTV Devices
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Camera &amp; <span className="text-brand-purple">NVR Devices</span></h1>
            <p className="max-w-2xl text-sm text-slate-400">Cameras grouped by recorder. Add, edit, and manage all CCTV hardware.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search camera, zone, vendor…" className="rounded-xl border border-white/10 bg-[#111827] py-2.5 pl-9 pr-4 text-sm text-slate-200 outline-none focus:border-brand-purple/50 hover:border-white/15 w-56" />
            </div>
            <select value={selectedCentreId} onChange={(e) => { setSelectedCentreId(e.target.value); setSelectedSiteId('all'); }} className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-purple/50 hover:border-white/15">
              <option value="all">All Branches</option>
              {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-purple/50 hover:border-white/15">
              <option value="all">All Sites</option>
              {sites.filter(s => selectedCentreId === 'all' || s.centre_id === selectedCentreId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" onClick={() => void fetchData(true)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:border-white/15">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button type="button" onClick={() => { setEditNvr(null); setNvrForm(emptyNvrForm()); setShowAddNvr(true); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:border-white/15">
              <Plus size={14} /> Add NVR
            </button>
            <button type="button" onClick={() => { setCameraForm(emptyCameraForm()); setShowAddCamera(true); }} className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-purple/90">
              <Plus size={14} /> Add Camera
            </button>
          </div>
        </header>

        {/* NVR Groups */}
        <div className="space-y-6">
          {Array.from(groupedByNvr.entries()).map(([nvrId, items]) => {
            const nvr = items[0]?.security_nvr_devices || nvrs.find((n) => n.id === nvrId) || null;
            const site = nvr ? siteMap.get(nvr.site_id) : items[0] ? siteMap.get(items[0].site_id) : null;
            const conf = getStatusConf(nvr?.status);
            return (
              <section key={nvrId} className="rounded-2xl border border-white/8 bg-[#0d1424]">
                {/* NVR Group Header */}
                <div className="flex flex-col gap-3 border-b border-white/8 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${conf.dot}`} />
                    <div>
                      <h2 className="font-bold text-white">{nvr?.device_name || 'Unassigned Cameras'}</h2>
                      <p className="text-xs text-slate-500">{site?.name || 'No site'}{nvr ? ` · ${nvr.host}:${nvr.port}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-400">{items.length} cameras</span>
                    {nvr && (
                      <>
                        <button type="button" onClick={() => openEditNvr(nvr)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10">
                          <Pencil size={11} /> Edit NVR
                        </button>
                        <button type="button" onClick={() => { setCameraForm({ ...emptyCameraForm(), site_id: nvr.site_id, nvr_id: nvr.id }); setShowAddCamera(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10">
                          <Plus size={11} /> Add Camera
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Camera Cards */}
                <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((camera) => {
                    const liveTarget = getLiveTarget(camera);
                    const camConf = getStatusConf(camera.status);
                    return (
                      <article key={camera.id} className="overflow-hidden rounded-xl border border-white/8 bg-[#111827] transition-all hover:border-white/15">
                        <div className="relative aspect-video overflow-hidden bg-black">
                          <img src={getSnapshotPreview(camera)} alt={camera.camera_name} className="h-full w-full object-cover opacity-70" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent opacity-60" />
                          <span className={`absolute left-2 top-2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase backdrop-blur-sm ${camConf.badge} ${camConf.text}`}>
                            <span className={`h-1 w-1 rounded-full ${camConf.dot}`} />
                            {camera.status}
                          </span>
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white">{camera.camera_name}</p>
                              <p className="truncate text-[10px] text-slate-500">CH {camera.channel_no ?? '--'} · {camera.coverage_zone || 'Coverage pending'}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] text-slate-500">
                            <span>Vendor: {camera.vendor}</span>
                            <span>Site: {siteMap.get(camera.site_id)?.name || '—'}</span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={() => openEditUrl(camera)} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10">
                              <Pencil size={11} /> Edit URL
                            </button>
                            <button type="button" onClick={() => void copyCamera(camera)} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10">
                              <Copy size={11} /> Copy
                            </button>
                            {liveTarget ? (
                              <a href={liveTarget} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-brand-purple px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-brand-purple/90">
                                Live <ArrowUpRight size={11} />
                              </a>
                            ) : (
                              <span className="inline-flex items-center rounded-xl border border-dashed border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">Bridge Needed</span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {groupedByNvr.size === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-white/8 p-10 text-center text-sm text-slate-500">No cameras match the current filter.</div>
          )}
        </div>
      </div>

      {/* -- Add / Edit NVR Modal ------------------------------------------- */}
      {showAddNvr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold text-white">{editNvr ? 'Edit NVR' : 'Add NVR'}</h3>
              <button type="button" onClick={() => { setShowAddNvr(false); setEditNvr(null); }} className="rounded-lg p-1.5 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Site</label>
                <select value={nvrForm.site_id} onChange={(e) => setNvrForm(f => ({ ...f, site_id: e.target.value }))} className={inputCls}>
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Device Name</label>
                <input value={nvrForm.device_name} onChange={(e) => setNvrForm(f => ({ ...f, device_name: e.target.value }))} className={inputCls} placeholder="NVR-01" />
              </div>
              <div>
                <label className={labelCls}>Vendor</label>
                <input value={nvrForm.vendor} onChange={(e) => setNvrForm(f => ({ ...f, vendor: e.target.value }))} className={inputCls} placeholder="Dahua" />
              </div>
              <div>
                <label className={labelCls}>Host / IP Domain</label>
                <input value={nvrForm.host} onChange={(e) => setNvrForm(f => ({ ...f, host: e.target.value }))} className={inputCls} placeholder="192.168.1.100" />
              </div>
              <div>
                <label className={labelCls}>Port</label>
                <input type="number" value={nvrForm.port} onChange={(e) => setNvrForm(f => ({ ...f, port: e.target.value }))} className={inputCls} placeholder="80" />
              </div>
              <div>
                <label className={labelCls}>Protocol</label>
                <select value={nvrForm.protocol} onChange={(e) => setNvrForm(f => ({ ...f, protocol: e.target.value as 'http' | 'https' }))} className={inputCls}>
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Web Interface URL</label>
                <input value={nvrForm.web_url} onChange={(e) => setNvrForm(f => ({ ...f, web_url: e.target.value }))} className={inputCls} placeholder="http://192.168.1.100" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>HLS / Stream Base URL</label>
                <input value={nvrForm.stream_base_url} onChange={(e) => setNvrForm(f => ({ ...f, stream_base_url: e.target.value }))} className={inputCls} placeholder="http://192.168.1.100/hls/" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea value={nvrForm.notes} onChange={(e) => setNvrForm(f => ({ ...f, notes: e.target.value }))} className={`${inputCls} resize-none`} rows={2} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowAddNvr(false); setEditNvr(null); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10">Cancel</button>
              <button type="button" onClick={() => void saveNvr()} disabled={saving} className="rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-purple/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save NVR'}</button>
            </div>
          </div>
        </div>
      )}

      {/* -- Add Camera Modal ----------------------------------------------- */}
      {showAddCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold text-white">Add Camera</h3>
              <button type="button" onClick={() => setShowAddCamera(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Site</label>
                <select value={cameraForm.site_id} onChange={(e) => setCameraForm(f => ({ ...f, site_id: e.target.value }))} className={inputCls}>
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>NVR</label>
                <select value={cameraForm.nvr_id} onChange={(e) => setCameraForm(f => ({ ...f, nvr_id: e.target.value }))} className={inputCls}>
                  <option value="">Select NVR…</option>
                  {nvrs.map(n => <option key={n.id} value={n.id}>{n.device_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>NVR</label>
                <select value={cameraForm.nvr_id} onChange={(e) => setCameraForm(f => ({ ...f, nvr_id: e.target.value }))} className={inputCls}>
                  <option value="">Select NVR…</option>
                  {nvrs.map(n => <option key={n.id} value={n.id}>{n.device_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Camera Name</label>
                <input value={cameraForm.camera_name} onChange={(e) => setCameraForm(f => ({ ...f, camera_name: e.target.value }))} className={inputCls} placeholder="Main Gate Cam" />
              </div>
              <div>
                <label className={labelCls}>Vendor</label>
                <input value={cameraForm.vendor} onChange={(e) => setCameraForm(f => ({ ...f, vendor: e.target.value }))} className={inputCls} placeholder="Dahua" />
              </div>
              <div>
                <label className={labelCls}>Channel No</label>
                <input type="number" value={cameraForm.channel_no} onChange={(e) => setCameraForm(f => ({ ...f, channel_no: e.target.value }))} className={inputCls} placeholder="1" />
              </div>
              <div>
                <label className={labelCls}>Coverage Zone</label>
                <input value={cameraForm.coverage_zone} onChange={(e) => setCameraForm(f => ({ ...f, coverage_zone: e.target.value }))} className={inputCls} placeholder="Main Gate" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Live View / HLS URL</label>
                <input value={cameraForm.live_view_url} onChange={(e) => setCameraForm(f => ({ ...f, live_view_url: e.target.value }))} className={inputCls} placeholder="http://…/stream.m3u8" />
              </div>
              <div>
                <label className={labelCls}>Snapshot Path</label>
                <input value={cameraForm.snapshot_path} onChange={(e) => setCameraForm(f => ({ ...f, snapshot_path: e.target.value }))} className={inputCls} placeholder="/snapshot/ch1" />
              </div>
              <div>
                <label className={labelCls}>Stream Path</label>
                <input value={cameraForm.stream_path} onChange={(e) => setCameraForm(f => ({ ...f, stream_path: e.target.value }))} className={inputCls} placeholder="/stream/ch1" />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={cameraForm.status} onChange={(e) => setCameraForm(f => ({ ...f, status: e.target.value as SecurityCamera['status'] }))} className={inputCls}>
                  {['online','offline','degraded','maintenance','unknown'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddCamera(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10">Cancel</button>
              <button type="button" onClick={() => void saveCamera()} disabled={saving} className="rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-purple/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save Camera'}</button>
            </div>
          </div>
        </div>
      )}

      {/* -- Edit URL Modal ------------------------------------------------- */}
      {editUrlCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold text-white">Edit URLs — {editUrlCamera.camera_name}</h3>
              <button type="button" onClick={() => setEditUrlCamera(null)} className="rounded-lg p-1.5 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Live View / HLS URL</label>
                <input value={urlForm.live_view_url} onChange={(e) => setUrlForm(f => ({ ...f, live_view_url: e.target.value }))} className={inputCls} placeholder="http://…/stream.m3u8" />
              </div>
              <div>
                <label className={labelCls}>Stream Path</label>
                <input value={urlForm.stream_path} onChange={(e) => setUrlForm(f => ({ ...f, stream_path: e.target.value }))} className={inputCls} placeholder="/stream/ch1" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setEditUrlCamera(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10">Cancel</button>
              <button type="button" onClick={() => void saveUrlEdit()} disabled={saving} className="rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-purple/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save URLs'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CctvDevicesPage;
