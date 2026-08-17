// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Building2,
  Camera,
  Database,
  Globe,
  LayoutGrid,
  Layers3,
  MonitorPlay,
  RefreshCw,
  Radio,
  Shield,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import CustomLoader from '../../components/CustomLoader';
import type {
  SecurityCamera,
  SecurityCameraHealthLog,
  SecurityNvrDevice,
  SecurityPost,
  SecuritySite,
} from '../../types/security';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;
type CameraAction = 'health-check' | 'snapshot';

const snapshotFallbacks = ['/cctv_main_gate.webp', '/cctv_lobby.webp', '/cctv_parking.webp'];

const statusConfig: Record<string, { label: string; dot: string; badge: string; text: string }> = {
  online:      { label: 'Online',      dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
  offline:     { label: 'Offline',     dot: 'bg-rose-500',    badge: 'bg-rose-500/10 border-rose-500/20',       text: 'text-rose-400' },
  degraded:    { label: 'Degraded',    dot: 'bg-amber-500',   badge: 'bg-amber-500/10 border-amber-500/20',     text: 'text-amber-400' },
  maintenance: { label: 'Maintenance', dot: 'bg-blue-500',    badge: 'bg-blue-500/10 border-blue-500/20',       text: 'text-blue-400' },
  unknown:     { label: 'Unknown',     dot: 'bg-slate-500',   badge: 'bg-slate-500/10 border-slate-500/20',     text: 'text-slate-400' },
};

const getStatusConfig = (status?: string | null) => statusConfig[status || 'unknown'] || statusConfig.unknown;

const getSnapshotPreview = (camera: SecurityCamera, index: number, latestLog?: SecurityCameraHealthLog) =>
  latestLog?.snapshot_url || camera.last_snapshot_url || snapshotFallbacks[index % snapshotFallbacks.length];

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

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

const CctvSurveillance: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [posts, setPosts] = useState<SecurityPost[]>([]);
  const [nvrs, setNvrs] = useState<SecurityNvrDevice[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  const [logs, setLogs] = useState<SecurityCameraHealthLog[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<'all' | string>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchCctvData = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [sitesRes, postsRes, nvrsRes, camerasRes, logsRes] = await Promise.all([
        supabase.from('security_sites').select('id, name, county, address').order('name'),
        supabase.from('security_posts').select('id, name, site_id, required_guards').order('name'),
        supabase.from('security_nvr_devices').select('id, site_id, device_name, vendor, model, host, port, protocol, stream_base_url, web_url, status, last_sync_at, last_health_check_at, notes, metadata, security_sites(id, name, county, address)').order('device_name'),
        supabase.from('security_cameras').select(`id, site_id, post_id, nvr_id, camera_name, vendor, channel_no, coverage_zone, stream_path, snapshot_path, live_view_url, status, credential_secret_ref, last_snapshot_url, last_snapshot_at, last_seen_at, installed_at, is_recording, is_ptz, metadata, security_sites(id, name, county, address), security_posts(id, name, required_guards), security_nvr_devices(id, site_id, device_name, vendor, model, host, port, protocol, stream_base_url, web_url, status, last_sync_at, last_health_check_at, notes, metadata)`).order('camera_name'),
        supabase.from('security_camera_health_logs').select('id, camera_id, nvr_id, check_type, status, response_ms, status_code, message, snapshot_url, payload, checked_at').order('checked_at', { ascending: false }).limit(100),
      ]);

      if (sitesRes.error) throw sitesRes.error;
      if (postsRes.error) throw postsRes.error;
      if (nvrsRes.error) throw nvrsRes.error;
      if (camerasRes.error) throw camerasRes.error;
      if (logsRes.error) throw logsRes.error;

      setSites(sitesRes.data as SecuritySite[]);
      setPosts(postsRes.data as SecurityPost[]);
      setNvrs(nvrsRes.data.map(normalizeNvr));
      setCameras(camerasRes.data.map(normalizeCamera));
      setLogs(logsRes.data as SecurityCameraHealthLog[]);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchCctvData();
  }, []);

  const filteredCameras = cameras.filter(c => selectedSiteId === 'all' || c.site_id === selectedSiteId);
  const filteredNvrs = nvrs.filter(n => selectedSiteId === 'all' || n.site_id === selectedSiteId);

  const latestLogByCamera = logs.reduce<Record<string, SecurityCameraHealthLog>>((acc, log) => {
    if (!acc[log.camera_id]) acc[log.camera_id] = log;
    return acc;
  }, {});

  const stats = {
    total: filteredCameras.length,
    online: filteredCameras.filter(c => c.status === 'online').length,
    offline: filteredCameras.filter(c => c.status === 'offline').length,
    recording: filteredCameras.filter(c => c.is_recording).length,
  };

  const runCameraAction = async (camera: SecurityCamera, action: CameraAction) => {
    setBusyAction(`${action}:${camera.id}`);
    try {
      const res = await invokeEdgeFunction<{ message?: string }>('dahua-proxy', { action, cameraId: camera.id });
      setToast({ message: res.message || 'Action completed successfully.', type: 'success' });
      await fetchCctvData(true);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0f1a]">
        <CustomLoader label="Activating Surveillance Grid..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-100">
      <CustomToast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={Boolean(toast)}
        onClose={() => setToast(null)}
      />

      <div className="mx-auto max-w-[1600px] space-y-8 p-6 lg:p-10">
        {/* Header */}
        <header className="flex flex-col gap-6 border-b border-white/8 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-brand-purple">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-purple opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-purple" />
              </span>
              Command Center Live
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              CCTV <span className="text-brand-purple">Surveillance</span>
            </h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Managing <span className="text-white font-semibold">{cameras.length}</span> channels across{' '}
              <span className="text-white font-semibold">{sites.length}</span> locations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-purple/50 hover:border-white/15"
            >
              <option value="all">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="flex rounded-xl border border-white/10 bg-[#111827] p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded-lg p-2 transition-all ${viewMode === 'grid' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-lg p-2 transition-all ${viewMode === 'list' ? 'bg-brand-purple text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <MonitorPlay size={16} />
              </button>
            </div>

            <button
              onClick={() => void fetchCctvData(true)}
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition-all hover:bg-white/10 hover:border-white/15"
              title="Refresh"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Total Cameras', value: stats.total,     color: 'border-brand-purple/50', text: 'text-brand-purple' },
            { label: 'Online',        value: stats.online,    color: 'border-emerald-500/50',  text: 'text-emerald-400' },
            { label: 'Offline',       value: stats.offline,   color: 'border-rose-500/50',     text: 'text-rose-400' },
            { label: 'Recording',     value: stats.recording, color: 'border-blue-500/50',     text: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-white/8 bg-[#0d1424] p-5 border-l-2 ${s.color}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{s.label}</p>
              <p className={`mt-2 text-3xl font-black ${s.text}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_360px]">
          {/* Camera Grid */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-[0.25em] text-slate-500">
                <Video size={16} className="text-brand-purple" />
                Active Monitors
                <span className="ml-1 rounded-lg border border-white/8 bg-white/5 px-2 py-0.5 text-xs font-bold normal-case tracking-normal text-slate-400">
                  {filteredCameras.length}
                </span>
              </h2>
            </div>

            <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {filteredCameras.map((camera, idx) => {
                const log = latestLogByCamera[camera.id];
                const preview = getSnapshotPreview(camera, idx, log);
                const conf = getStatusConfig(camera.status);
                const isBusy = busyAction?.includes(camera.id);

                return (
                  <article
                    key={camera.id}
                    className="overflow-hidden rounded-2xl border border-white/8 bg-[#0d1424] transition-all hover:border-white/15"
                  >
                    {/* Snapshot */}
                    <div className="relative aspect-video overflow-hidden bg-black">
                      <img
                        src={preview}
                        alt={camera.camera_name}
                        className="h-full w-full object-cover opacity-70 transition-transform duration-500 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0d1424] via-transparent to-transparent opacity-70" />

                      {/* Top badges */}
                      <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
                        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm ${conf.badge} ${conf.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${conf.dot} animate-pulse`} />
                          {conf.label}
                        </span>
                        {camera.is_recording && (
                          <span className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-400 backdrop-blur-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            REC
                          </span>
                        )}
                      </div>

                      {/* Bottom overlay */}
                      <div className="absolute bottom-3 left-4">
                        <p className="text-lg font-black text-white drop-shadow">{camera.camera_name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          {camera.security_sites?.name} · CH {camera.channel_no ?? '--'}
                        </p>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="space-y-4 p-5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Coverage Zone</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-200">{camera.coverage_zone || 'Unmapped'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Last Seen</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-200">{formatDateTime(camera.last_seen_at || log?.checked_at)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void runCameraAction(camera, 'snapshot')}
                          disabled={!!isBusy}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/10 disabled:opacity-50"
                        >
                          <Camera size={13} className="text-brand-purple" />
                          {busyAction === `snapshot:${camera.id}` ? 'Fetching…' : 'Capture'}
                        </button>
                        <button
                          onClick={() => void runCameraAction(camera, 'health-check')}
                          disabled={!!isBusy}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/10 disabled:opacity-50"
                        >
                          <Activity size={13} className="text-blue-400" />
                          {busyAction === `health-check:${camera.id}` ? 'Testing…' : 'Health Check'}
                        </button>
                        {camera.live_view_url && (
                          <a
                            href={camera.live_view_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple text-white shadow-lg shadow-brand-purple/20 transition-all hover:bg-brand-purple/90"
                          >
                            <ArrowUpRight size={16} />
                          </a>
                        )}
                      </div>

                      {log?.message && (
                        <p className="truncate rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[10px] italic text-slate-500">
                          "{log.message}"
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}

              {filteredCameras.length === 0 && (
                <div className="col-span-2 rounded-2xl border border-dashed border-white/8 p-10 text-center text-sm text-slate-500">
                  No cameras found for this filter.
                </div>
              )}
            </div>
          </section>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            {/* NVR Network Nodes */}
            <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Globe size={16} className="text-blue-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Network Nodes</h3>
              </div>
              <div className="space-y-3">
                {filteredNvrs.length === 0 && (
                  <p className="text-xs text-slate-500">No NVRs for this filter.</p>
                )}
                {filteredNvrs.map(nvr => {
                  const conf = getStatusConfig(nvr.status);
                  return (
                    <div key={nvr.id} className="rounded-xl border border-white/8 bg-[#111827] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{nvr.device_name}</p>
                          <p className="truncate text-[10px] text-slate-500">{nvr.host}:{nvr.port}</p>
                        </div>
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${conf.dot}`} />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => navigate('/app/security/cctv/connections')}
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-white/10"
                        >
                          Setup
                        </button>
                        {nvr.web_url && (
                          <a
                            href={nvr.web_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                          >
                            <ArrowUpRight size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Health Log */}
            <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Database size={16} className="text-brand-purple" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Recent Health Log</h3>
              </div>
              <div className="space-y-4">
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="relative pl-5 before:absolute before:bottom-0 before:left-0 before:top-2 before:w-px before:bg-white/8">
                    <span className={`absolute left-[-3px] top-2 h-1.5 w-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : log.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <p className="text-xs font-bold text-slate-200">
                      {cameras.find(c => c.id === log.camera_id)?.camera_name || 'System'}
                    </p>
                    {log.message && <p className="mt-0.5 text-[10px] text-slate-500">{log.message}</p>}
                    <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">{formatDateTime(log.checked_at)}</p>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-xs text-slate-500">No health logs yet.</p>}
              </div>
            </div>

            {/* Quick Nav */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Sites',    icon: Building2, path: '/app/security/sites' },
                { label: 'Devices',  icon: Layers3,   path: '/app/security/cctv/devices' },
                { label: 'Live',     icon: Video,     path: '/app/security/cctv/live' },
                { label: 'Roster',   icon: Shield,    path: '/app/security/roster' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-white/8 bg-white/5 p-4 transition-all hover:bg-white/10 hover:border-white/15"
                >
                  <item.icon size={18} className="text-slate-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{item.label}</p>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CctvSurveillance;
