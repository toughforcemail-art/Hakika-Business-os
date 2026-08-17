// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Camera, ChevronDown, ChevronRight, Layers3, Radio, RefreshCw, Shield, Video, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import type { SecurityCamera, SecurityNvrDevice, SecurityPost, SecuritySite } from '../../types/security';

type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

const snapshotFallbacks = ['/cctv_main_gate.webp', '/cctv_lobby.webp', '/cctv_parking.webp'];

const getSnapshotPreview = (camera: SecurityCamera, index: number) =>
  camera.last_snapshot_url || camera.snapshot_path || snapshotFallbacks[index % snapshotFallbacks.length];

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

const LiveCoverage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [posts, setPosts] = useState<SecurityPost[]>([]);
  const [nvrs, setNvrs] = useState<SecurityNvrDevice[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<'all' | string>('all');
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);

  const fetchCoverage = async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [sitesRes, postsRes, nvrsRes, camerasRes] = await Promise.all([
        supabase.from('security_sites').select('id, name, county, address').order('name'),
        supabase.from('security_posts').select('id, name, site_id, required_guards').order('name'),
        supabase
          .from('security_nvr_devices')
          .select('id, site_id, device_name, vendor, model, host, port, protocol, stream_base_url, web_url, status, last_sync_at, last_health_check_at, notes, metadata, security_sites(id, name, county, address)')
          .order('device_name'),
        supabase
          .from('security_cameras')
          .select(`
            id,
            site_id,
            post_id,
            nvr_id,
            camera_name,
            vendor,
            channel_no,
            coverage_zone,
            stream_path,
            snapshot_path,
            live_view_url,
            status,
            last_snapshot_url,
            last_snapshot_at,
            last_seen_at,
            metadata,
            security_sites(id, name, county, address),
            security_posts(id, name, required_guards),
            security_nvr_devices(id, site_id, device_name, vendor, model, host, port, protocol, stream_base_url, web_url, status, last_sync_at, last_health_check_at, notes, metadata)
          `)
          .order('camera_name'),
      ]);

      if (sitesRes.error) throw sitesRes.error;
      if (postsRes.error) throw postsRes.error;
      if (nvrsRes.error) throw nvrsRes.error;
      if (camerasRes.error) throw camerasRes.error;

      setSites((sitesRes.data || []) as SecuritySite[]);
      setPosts((postsRes.data || []) as SecurityPost[]);
      setNvrs((nvrsRes.data || []).map((item) => normalizeNvr(item)));
      setCameras((camerasRes.data || []).map((item) => normalizeCamera(item)));
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchCoverage();
  }, []);

  const filteredSites = selectedSiteId === 'all' ? sites : sites.filter((site) => site.id === selectedSiteId);
  const filteredPosts = posts.filter((post) => selectedSiteId === 'all' || post.site_id === selectedSiteId);
  const filteredCameras = cameras.filter((camera) => selectedSiteId === 'all' || camera.site_id === selectedSiteId);

  const liveCount = filteredCameras.filter((camera) => Boolean(getLiveTarget(camera))).length;
  const offlineCount = filteredCameras.filter((camera) => camera.status === 'offline').length;
  const onlineCount = filteredCameras.filter((camera) => camera.status === 'online').length;
  const linkedPosts = new Set(filteredCameras.map((camera) => camera.post_id).filter(Boolean)).size;

  const coverageRows = useMemo(() => filteredSites.map((site) => {
    const sitePosts = posts.filter((post) => post.site_id === site.id);
    const siteCameras = cameras.filter((camera) => camera.site_id === site.id);
    const live = siteCameras.filter((camera) => Boolean(getLiveTarget(camera))).length;
    return { site, sitePosts, siteCameras, live };
  }), [filteredSites, posts, cameras]);

  const toggleSite = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

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
              <Radio size={12} /> Live Coverage
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              CCTV <span className="text-brand-purple">Live Coverage</span>
            </h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Cameras grouped by site and post. Prefers <code className="rounded bg-white/5 px-1 text-xs">live_view_url</code>, then stream base URL, then snapshot fallback.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-purple/50 hover:border-white/15"
            >
              <option value="all">All Sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void fetchCoverage(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:border-white/15"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/security/cctv')}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:border-white/15"
            >
              ← Surveillance
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Live Targets',   value: liveCount,                          color: 'border-brand-purple/50', text: 'text-brand-purple' },
            { label: 'Online',         value: onlineCount,                        color: 'border-emerald-500/50',  text: 'text-emerald-400' },
            { label: 'Offline',        value: offlineCount,                       color: 'border-rose-500/50',     text: 'text-rose-400' },
            { label: 'Linked Posts',   value: `${linkedPosts}/${filteredPosts.length}`, color: 'border-amber-500/50', text: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-white/8 bg-[#0d1424] p-5 border-l-2 ${s.color}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{s.label}</p>
              <p className={`mt-2 text-3xl font-black ${s.text}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_340px]">
          {/* Accordion Site Cards */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
              Site Coverage Grid · {coverageRows.length} sites
            </h2>

            {coverageRows.map(({ site, sitePosts, siteCameras, live }) => {
              const isExpanded = expandedSites.has(site.id);
              return (
                <div key={site.id} className="overflow-hidden rounded-2xl border border-white/8 bg-[#0d1424]">
                  {/* Site Header (accordion toggle) */}
                  <button
                    type="button"
                    onClick={() => toggleSite(site.id)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left transition-all hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-white">{site.name}</p>
                      <p className="text-xs text-slate-500">{site.county || 'County not set'} · {site.address || 'Address not set'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand-purple">
                        {siteCameras.length} cams
                      </span>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                        {live} live
                      </span>
                      {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {/* Posts + Cameras */}
                  {isExpanded && (
                    <div className="border-t border-white/8 p-5 space-y-5">
                      {sitePosts.length === 0 && (
                        <p className="text-sm text-slate-500">No posts configured for this site.</p>
                      )}
                      {sitePosts.map((post) => {
                        const postCameras = siteCameras.filter((c) => c.post_id === post.id);
                        const hasLive = postCameras.some((c) => Boolean(getLiveTarget(c)));
                        return (
                          <div key={post.id} className="rounded-xl border border-white/8 bg-[#111827] p-4">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-white">{post.name}</p>
                                <p className="text-xs text-slate-500">{post.required_guards || 0} guard slots</p>
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${hasLive ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/20 bg-rose-500/10 text-rose-400'}`}>
                                {hasLive ? 'Live' : 'No Stream'}
                              </span>
                            </div>

                            {postCameras.length === 0 ? (
                              <p className="text-xs text-slate-500">No cameras assigned to this post.</p>
                            ) : (
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {postCameras.map((camera, index) => {
                                  const liveTarget = getLiveTarget(camera);
                                  const preview = getSnapshotPreview(camera, index);
                                  const conf = getStatusConf(camera.status);
                                  return (
                                    <div key={camera.id} className="overflow-hidden rounded-xl border border-white/8 bg-[#0d1424]">
                                      <div className="relative aspect-video overflow-hidden bg-black">
                                        <img src={preview} alt={camera.camera_name} className="h-full w-full object-cover opacity-70" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1424] via-transparent to-transparent opacity-60" />
                                        <span className={`absolute left-2 top-2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase backdrop-blur-sm ${conf.badge} ${conf.text}`}>
                                          <span className={`h-1 w-1 rounded-full ${conf.dot}`} />
                                          {camera.status}
                                        </span>
                                      </div>
                                      <div className="p-3">
                                        <p className="truncate text-sm font-bold text-white">{camera.camera_name}</p>
                                        <p className="truncate text-[10px] text-slate-500">CH {camera.channel_no ?? '--'} · {camera.coverage_zone || 'Coverage pending'}</p>
                                        <div className="mt-3">
                                          {liveTarget ? (
                                            <a
                                              href={liveTarget}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-purple px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-brand-purple/90"
                                            >
                                              Open Stream <ArrowUpRight size={11} />
                                            </a>
                                          ) : (
                                            <span className="inline-flex items-center rounded-xl border border-dashed border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                              Bridge Needed
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {coverageRows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/8 p-10 text-center text-sm text-slate-500">
                No sites found.
              </div>
            )}
          </section>

          {/* Right Panel */}
          <aside className="space-y-6">
            {/* Stream Setup Guide */}
            <div className="rounded-2xl border border-brand-purple/30 bg-[#0d1424] p-5">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-purple/30 bg-brand-purple/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-brand-purple">
                <Video size={11} /> Stream Setup Guide
              </div>
              <h3 className="mb-2 font-bold text-white">HLS Bridge Approach</h3>
              <p className="text-xs leading-5 text-slate-400">
                Browsers cannot play raw RTSP streams. To get live video in the browser, run an HLS bridge (e.g. <span className="text-slate-200">go2rtc</span> or <span className="text-slate-200">mediamtx</span>) that converts RTSP → HLS. Then store the HLS URL in <code className="rounded bg-white/5 px-1">live_view_url</code> or <code className="rounded bg-white/5 px-1">stream_base_url</code>.
              </p>
              <ol className="mt-4 space-y-2 text-xs text-slate-400">
                {['Deploy go2rtc / mediamtx on your network', 'Point it at the NVR RTSP stream', 'Copy the HLS output URL', 'Paste into live_view_url on the camera record'].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 text-[9px] font-black text-brand-purple">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* NVR Targets */}
            <div className="rounded-2xl border border-white/8 bg-[#0d1424] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">NVR Targets</h3>
                <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-400">{nvrs.length}</span>
              </div>
              <div className="space-y-3">
                {nvrs.map((nvr) => {
                  const conf = getStatusConf(nvr.status);
                  return (
                    <div key={nvr.id} className="rounded-xl border border-white/8 bg-[#111827] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{nvr.device_name}</p>
                          <p className="truncate text-[10px] text-slate-500">{nvr.vendor} · {nvr.host}:{nvr.port}</p>
                        </div>
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${conf.dot}`} />
                      </div>
                      {(nvr.web_url || nvr.stream_base_url) && (
                        <p className="mt-2 truncate text-[10px] text-slate-500">
                          {nvr.web_url || nvr.stream_base_url}
                        </p>
                      )}
                    </div>
                  );
                })}
                {nvrs.length === 0 && <p className="text-xs text-slate-500">No NVRs configured.</p>}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LiveCoverage;
