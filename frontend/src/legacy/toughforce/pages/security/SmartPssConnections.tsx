// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Copy, Database, Layers3, Pencil, Plus, Radio, Smartphone, SquarePlay, Wifi, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import type { SecurityNvrDevice, SecurityCamera, SecuritySite } from '../../types/security';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

const formatValue = (value?: string | number | null) =>
  value === null || value === undefined || value === '' ? 'Not set' : String(value);

const buildSmartPssBlock = (nvr: SecurityNvrDevice, siteName?: string | null, cameraCount?: number) => [
  `Site: ${siteName || 'Unassigned'}`,
  `Device name: ${nvr.device_name}`,
  `Vendor: ${nvr.vendor}`,
  `Host: ${nvr.host}`,
  `Port: ${nvr.port}`,
  `Protocol: ${nvr.protocol}`,
  `Cameras linked: ${cameraCount ?? 0}`,
  `Web URL: ${nvr.web_url || 'Not set'}`,
  `Stream base URL: ${nvr.stream_base_url || 'Not set'}`,
  '',
  'SmartPSS Lite steps:',
  '1. Open SmartPSS Lite.',
  '2. Go to Devices > Add.',
  '3. Choose IP/Domain Name.',
  '4. Enter the host, port, username, and password from the recorder configuration.',
  '5. If the recorder supports it, add by SN/P2P instead.',
].join('\n');

const statusConfig: Record<string, { dot: string; text: string; badge: string }> = {
  online:      { dot: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/20' },
  offline:     { dot: 'bg-rose-500',    text: 'text-rose-400',    badge: 'bg-rose-500/10 border-rose-500/20' },
  degraded:    { dot: 'bg-amber-500',   text: 'text-amber-400',   badge: 'bg-amber-500/10 border-amber-500/20' },
  maintenance: { dot: 'bg-blue-500',    text: 'text-blue-400',    badge: 'bg-blue-500/10 border-blue-500/20' },
  unknown:     { dot: 'bg-slate-500',   text: 'text-slate-400',   badge: 'bg-slate-500/10 border-slate-500/20' },
};
const getStatusConf = (s?: string | null) => statusConfig[s || 'unknown'] || statusConfig.unknown;

const emptyNvrForm = () => ({
  site_id: '', device_name: '', vendor: '', host: '', port: '80',
  protocol: 'http' as 'http' | 'https', web_url: '', stream_base_url: '', notes: '',
});

const SmartPssConnections: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [nvrs, setNvrs] = useState<SecurityNvrDevice[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<'all' | string>('all');
  const [toast, setToast] = useState<ToastState>(null);

  // Modal state
  const [showAddNvr, setShowAddNvr] = useState(false);
  const [editNvr, setEditNvr] = useState<SecurityNvrDevice | null>(null);
  const [editUrlNvr, setEditUrlNvr] = useState<SecurityNvrDevice | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nvrForm, setNvrForm] = useState(emptyNvrForm());
  const [urlForm, setUrlForm] = useState({ web_url: '', stream_base_url: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sitesRes, nvrsRes, camerasRes] = await Promise.all([
        supabase.from('security_sites').select('id, name, county, address').order('name'),
        supabase.from('security_nvr_devices').select('id, site_id, device_name, vendor, model, host, port, protocol, stream_base_url, web_url, status, last_sync_at, last_health_check_at, notes, metadata').order('device_name'),
        supabase.from('security_cameras').select('id, site_id, nvr_id, camera_name, vendor, channel_no, status').order('camera_name'),
      ]);
      if (sitesRes.error) throw sitesRes.error;
      if (nvrsRes.error) throw nvrsRes.error;
      if (camerasRes.error) throw camerasRes.error;
      setSites((sitesRes.data || []) as SecuritySite[]);
      setNvrs((nvrsRes.data || []) as SecurityNvrDevice[]);
      setCameras((camerasRes.data || []) as SecurityCamera[]);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, []);

  const filteredNvrs = selectedSiteId === 'all' ? nvrs : nvrs.filter((nvr) => nvr.site_id === selectedSiteId);

  const cameraCountByNvr = useMemo(() => {
    const map = new Map<string, number>();
    cameras.forEach((camera) => {
      if (!camera.nvr_id) return;
      map.set(camera.nvr_id, (map.get(camera.nvr_id) || 0) + 1);
    });
    return map;
  }, [cameras]);

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => map.set(site.id, site.name));
    return map;
  }, [sites]);

  const copyBlock = async (nvr: SecurityNvrDevice) => {
    const text = buildSmartPssBlock(nvr, siteNameById.get(nvr.site_id), cameraCountByNvr.get(nvr.id));
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message: 'SmartPSS Lite setup copied.', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
  };

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
      await fetchData();
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveUrlEdit = async () => {
    if (!editUrlNvr) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('security_nvr_devices').update({
        web_url: urlForm.web_url || null,
        stream_base_url: urlForm.stream_base_url || null,
      }).eq('id', editUrlNvr.id);
      if (error) throw error;
      setToast({ message: 'URLs updated.', type: 'success' });
      setEditUrlNvr(null);
      setUrlForm({ web_url: '', stream_base_url: '' });
      await fetchData();
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

  const openEditUrl = (nvr: SecurityNvrDevice) => {
    setUrlForm({ web_url: nvr.web_url || '', stream_base_url: nvr.stream_base_url || '' });
    setEditUrlNvr(nvr);
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
              <Radio size={12} /> SmartPSS Lite
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">SmartPSS <span className="text-brand-purple">Connections</span></h1>
            <p className="max-w-2xl text-sm text-slate-400">Recorder connection details for SmartPSS Lite. Copy a block and paste the values into the desktop client.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-purple/50 hover:border-white/15">
              <option value="all">All Sites</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
            <button type="button" onClick={() => navigate('/app/security/cctv')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:border-white/15">
              ? CCTV
            </button>
            <button type="button" onClick={() => { setEditNvr(null); setNvrForm(emptyNvrForm()); setShowAddNvr(true); }} className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-purple/90">
              <Plus size={14} /> Add NVR
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sites',   value: sites.length,   color: 'border-brand-purple/50', text: 'text-brand-purple' },
            { label: 'NVRs',    value: nvrs.length,    color: 'border-emerald-500/50',  text: 'text-emerald-400' },
            { label: 'Cameras', value: cameras.length, color: 'border-amber-500/50',    text: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-white/8 bg-[#0d1424] p-5 border-l-2 ${s.color}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{s.label}</p>
              <p className={`mt-2 text-3xl font-black ${s.text}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Info Banner */}
        <div className="rounded-2xl border border-brand-purple/20 bg-[#0d1424] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                <Smartphone size={11} /> SmartPSS Lite P2P Setup
              </div>
              <h2 className="font-bold text-white">Mirror your recorder into the desktop client</h2>
              <p className="max-w-2xl text-sm text-slate-400">
                Use the IP/Domain or SN-based device details below to add the recorder into SmartPSS Lite. This page does not log in for you — it exposes the device connection data from your site records.
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-white/8 bg-[#111827] p-4 text-xs text-slate-400 max-w-xs">
              We do not store your SmartPSS Lite login here. Only device connection data from your site records is shown.
            </div>
          </div>
        </div>

        {/* NVR Connection Blocks */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">NVR Connection Blocks · {filteredNvrs.length} recorders</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredNvrs.map((nvr) => {
              const conf = getStatusConf(nvr.status);
              const siteName = siteNameById.get(nvr.site_id);
              const camCount = cameraCountByNvr.get(nvr.id) || 0;
              return (
                <article key={nvr.id} className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-white">{nvr.device_name}</p>
                      <p className="text-xs text-slate-500">{siteName || 'Unassigned site'}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${conf.badge} ${conf.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                      {formatValue(nvr.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: 'Host',            value: nvr.host },
                      { label: 'Port',            value: String(nvr.port) },
                      { label: 'Protocol',        value: nvr.protocol },
                      { label: 'Linked Cameras',  value: String(camCount) },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl border border-white/8 bg-[#111827] p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-200">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <pre className="mt-4 overflow-x-auto rounded-xl border border-dashed border-white/8 bg-[#111827] p-4 text-xs leading-5 text-slate-400 whitespace-pre-wrap">
                    {buildSmartPssBlock(nvr, siteName, camCount)}
                  </pre>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copyBlock(nvr)} className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-brand-purple/90">
                      <Copy size={12} /> Copy Block
                    </button>
                    <button type="button" onClick={() => openEditUrl(nvr)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10">
                      <Pencil size={12} /> Edit URLs
                    </button>
                    <button type="button" onClick={() => openEditNvr(nvr)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10">
                      <Pencil size={12} /> Edit NVR
                    </button>
                    {nvr.web_url && (
                      <a href={nvr.web_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10">
                        Open Recorder <ArrowUpRight size={12} />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}

            {!loading && filteredNvrs.length === 0 && (
              <div className="col-span-2 rounded-2xl border border-dashed border-white/8 p-10 text-center text-sm text-slate-500">
                No recorders available for this site. Add a recorder first.
              </div>
            )}
          </div>
        </section>
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

      {/* -- Edit URLs Modal ------------------------------------------------ */}
      {editUrlNvr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1424] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-bold text-white">Edit URLs — {editUrlNvr.device_name}</h3>
              <button type="button" onClick={() => setEditUrlNvr(null)} className="rounded-lg p-1.5 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Web Interface URL</label>
                <input value={urlForm.web_url} onChange={(e) => setUrlForm(f => ({ ...f, web_url: e.target.value }))} className={inputCls} placeholder="http://192.168.1.100" />
              </div>
              <div>
                <label className={labelCls}>HLS / Stream Base URL</label>
                <input value={urlForm.stream_base_url} onChange={(e) => setUrlForm(f => ({ ...f, stream_base_url: e.target.value }))} className={inputCls} placeholder="http://192.168.1.100/hls/" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setEditUrlNvr(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10">Cancel</button>
              <button type="button" onClick={() => void saveUrlEdit()} disabled={saving} className="rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-purple/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save URLs'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartPssConnections;
