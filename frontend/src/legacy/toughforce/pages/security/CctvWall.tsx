// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Expand,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  Maximize2,
  Minimize2,
  MinusCircle,
  MonitorPlay,
  Move,
  PlusCircle,
  RefreshCw,
  Video,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import type { SecurityCamera, SecurityNvrDevice, SecuritySite } from '../../types/security';

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;
type GridLayout = 1 | 2 | 3 | 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const snapshotFallbacks = ['/cctv_main_gate.webp', '/cctv_lobby.webp', '/cctv_parking.webp'];

const getLiveUrl = (camera: SecurityCamera): string | null =>
  camera.live_view_url ||
  camera.security_nvr_devices?.stream_base_url ||
  camera.security_nvr_devices?.web_url ||
  null;

const getSnapshot = (camera: SecurityCamera, idx: number): string =>
  camera.last_snapshot_url || camera.snapshot_path || snapshotFallbacks[idx % snapshotFallbacks.length];

const statusDot: Record<string, string> = {
  online:      'bg-emerald-500',
  offline:     'bg-rose-500',
  degraded:    'bg-amber-500',
  maintenance: 'bg-blue-500',
  unknown:     'bg-slate-500',
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

// ─── CameraCell ───────────────────────────────────────────────────────────────
// Renders a single camera tile. If live_view_url is an HLS .m3u8 URL it uses
// a <video> tag with native HLS (Safari) or falls back to a snapshot image.
// For non-HLS URLs (NVR web interface) it opens in a new tab on click.
const CameraCell: React.FC<{
  camera: SecurityCamera;
  index: number;
  onExpand: () => void;
  isFullscreen?: boolean;
}> = ({ camera, index, onExpand, isFullscreen }) => {
  const liveUrl = getLiveUrl(camera);
  const snapshot = getSnapshot(camera, index);
  const isHls = liveUrl?.includes('.m3u8') || liveUrl?.includes('/stream') || liveUrl?.includes('/hls');
  const dot = statusDot[camera.status] || statusDot.unknown;

  return (
    <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black">
      {/* Video / Snapshot area */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {liveUrl && isHls ? (
          <video
            key={liveUrl}
            src={liveUrl}
            autoPlay
            muted
            playsInline
            loop
            className="h-full w-full object-cover"
            onError={(e) => {
              // Fall back to snapshot on video error
              const target = e.currentTarget;
              target.style.display = 'none';
              const img = target.nextElementSibling as HTMLImageElement | null;
              if (img) img.style.display = 'block';
            }}
          />
        ) : null}

        {/* Snapshot fallback — shown when no HLS or video errors */}
        <img
          src={snapshot}
          alt={camera.camera_name}
          className="h-full w-full object-cover opacity-60"
          style={{ display: liveUrl && isHls ? 'none' : 'block' }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* No stream badge */}
        {!liveUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <WifiOff size={24} className="text-slate-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">No Stream</p>
          </div>
        )}

        {/* Top-left: status dot + REC + PTZ badge */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dot} shadow-lg`} />
          {camera.is_recording && (
            <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-400 backdrop-blur-sm">
              <span className="h-1 w-1 animate-pulse rounded-full bg-rose-500" />
              REC
            </span>
          )}
          {camera.is_ptz && (
            <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-brand-purple backdrop-blur-sm">
              PTZ
            </span>
          )}
        </div>

        {/* Top-right: expand button */}
        <button
          type="button"
          onClick={onExpand}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-slate-300 opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-white/20 hover:text-white"
          title="Fullscreen"
        >
          <Maximize2 size={13} />
        </button>

        {/* Open in new tab for non-HLS URLs */}
        {liveUrl && !isHls && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span className="rounded-xl border border-white/20 bg-black/60 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm">
              Open in new tab
            </span>
          </a>
        )}
      </div>

      {/* Bottom label bar */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-[#0a0f1a] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">{camera.camera_name}</p>
          <p className="truncate text-[10px] text-slate-500">
            {camera.security_sites?.name || '—'} · CH {camera.channel_no ?? '--'}
          </p>
        </div>
        {!isFullscreen && (
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-600">
            {camera.coverage_zone || ''}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── PTZ Controls ─────────────────────────────────────────────────────────────
// go2rtc exposes PTZ via: GET /api/ptz?src=<stream>&move=<direction>
// Directions: left, right, up, down, zoom_in, zoom_out, stop
// The go2rtc base URL is extracted from the camera's live_view_url
const getPtzBase = (camera: SecurityCamera): string | null => {
  const url = camera.live_view_url;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

const getStreamName = (camera: SecurityCamera): string | null => {
  const url = camera.live_view_url;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('src') || parsed.pathname.split('/').filter(Boolean)[0] || null;
  } catch {
    return null;
  }
};

type PtzDirection = 'left' | 'right' | 'up' | 'down' | 'zoom_in' | 'zoom_out' | 'stop';

const sendPtz = async (camera: SecurityCamera, move: PtzDirection) => {
  const base = getPtzBase(camera);
  const src = getStreamName(camera);
  if (!base || !src) return;
  try {
    await fetch(`${base}/api/ptz?src=${encodeURIComponent(src)}&move=${move}`);
  } catch {
    // PTZ errors are non-critical — camera may not support it
  }
};

const PtzPad: React.FC<{ camera: SecurityCamera }> = ({ camera }) => {
  const isPtz = camera.is_ptz;
  const hasPtzUrl = Boolean(getPtzBase(camera) && getStreamName(camera));

  if (!isPtz && !hasPtzUrl) return null;

  const btnCls =
    'flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-brand-purple hover:border-brand-purple hover:text-white active:scale-95 select-none';

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">PTZ Control</p>

      {/* D-pad */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* Row 1 */}
        <div />
        <button type="button" className={btnCls} onMouseDown={() => void sendPtz(camera, 'up')} onMouseUp={() => void sendPtz(camera, 'stop')} onTouchStart={() => void sendPtz(camera, 'up')} onTouchEnd={() => void sendPtz(camera, 'stop')} title="Tilt up">
          <ChevronUp size={18} />
        </button>
        <div />

        {/* Row 2 */}
        <button type="button" className={btnCls} onMouseDown={() => void sendPtz(camera, 'left')} onMouseUp={() => void sendPtz(camera, 'stop')} onTouchStart={() => void sendPtz(camera, 'left')} onTouchEnd={() => void sendPtz(camera, 'stop')} title="Pan left">
          <ChevronLeft size={18} />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Move size={14} className="text-slate-600" />
        </div>
        <button type="button" className={btnCls} onMouseDown={() => void sendPtz(camera, 'right')} onMouseUp={() => void sendPtz(camera, 'stop')} onTouchStart={() => void sendPtz(camera, 'right')} onTouchEnd={() => void sendPtz(camera, 'stop')} title="Pan right">
          <ChevronRight size={18} />
        </button>

        {/* Row 3 */}
        <div />
        <button type="button" className={btnCls} onMouseDown={() => void sendPtz(camera, 'down')} onMouseUp={() => void sendPtz(camera, 'stop')} onTouchStart={() => void sendPtz(camera, 'down')} onTouchEnd={() => void sendPtz(camera, 'stop')} title="Tilt down">
          <ChevronDown size={18} />
        </button>
        <div />
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-2">
        <button type="button" className={btnCls} onMouseDown={() => void sendPtz(camera, 'zoom_out')} onMouseUp={() => void sendPtz(camera, 'stop')} onTouchStart={() => void sendPtz(camera, 'zoom_out')} onTouchEnd={() => void sendPtz(camera, 'stop')} title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Zoom</span>
        <button type="button" className={btnCls} onMouseDown={() => void sendPtz(camera, 'zoom_in')} onMouseUp={() => void sendPtz(camera, 'stop')} onTouchStart={() => void sendPtz(camera, 'zoom_in')} onTouchEnd={() => void sendPtz(camera, 'stop')} title="Zoom in">
          <ZoomIn size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Fullscreen Modal ─────────────────────────────────────────────────────────
const FullscreenModal: React.FC<{
  camera: SecurityCamera;
  index: number;
  onClose: () => void;
}> = ({ camera, index, onClose }) => {
  const liveUrl = getLiveUrl(camera);
  const snapshot = getSnapshot(camera, index);
  const isHls = liveUrl?.includes('.m3u8') || liveUrl?.includes('/stream') || liveUrl?.includes('/hls');
  const dot = statusDot[camera.status] || statusDot.unknown;
  const showPtz = camera.is_ptz && Boolean(getPtzBase(camera));

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/98 backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#0a0f1a] px-6 py-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          <div>
            <p className="font-bold text-white">{camera.camera_name}</p>
            <p className="text-xs text-slate-500">
              {camera.security_sites?.name} · CH {camera.channel_no ?? '--'} · {camera.coverage_zone || 'No zone'}
            </p>
          </div>
          {camera.is_recording && (
            <span className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-rose-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
              REC
            </span>
          )}
          {camera.is_ptz && (
            <span className="rounded-full border border-brand-purple/30 bg-brand-purple/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand-purple">
              PTZ
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {liveUrl && !isHls && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
            >
              Open in tab <Maximize2 size={13} />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main content: video + optional PTZ sidebar */}
      <div className={`flex flex-1 overflow-hidden ${showPtz ? 'flex-row' : ''}`}>
        {/* Video */}
        <div className="relative flex-1 overflow-hidden bg-black">
          {liveUrl && isHls ? (
            <video
              key={liveUrl}
              src={liveUrl}
              autoPlay
              muted
              playsInline
              controls
              className="h-full w-full object-contain"
            />
          ) : (
            <img
              src={snapshot}
              alt={camera.camera_name}
              className="h-full w-full object-contain opacity-70"
            />
          )}

          {!liveUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <WifiOff size={48} className="text-slate-700" />
              <p className="text-sm font-bold text-slate-600">No stream URL configured</p>
              <p className="text-xs text-slate-700">Go to Camera &amp; NVR Devices → Edit URL to add one</p>
            </div>
          )}
        </div>

        {/* PTZ sidebar — only shown for PTZ cameras with a go2rtc URL */}
        {showPtz && (
          <div className="flex w-48 shrink-0 flex-col items-center justify-center gap-6 border-l border-white/[0.08] bg-[#0a0f1a] p-5">
            <PtzPad camera={camera} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const CctvWall: React.FC = () => {
  const navigate = useNavigate();
  const wallRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [cameras, setCameras] = useState<SecurityCamera[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<'all' | string>('all');
  const [layout, setLayout] = useState<GridLayout>(2);
  const [fullscreenCamera, setFullscreenCamera] = useState<SecurityCamera | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [isPageFullscreen, setIsPageFullscreen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [sitesRes, camerasRes] = await Promise.all([
        supabase.from('security_sites').select('id, name, county').order('name'),
        supabase.from('security_cameras').select(`
          id, site_id, post_id, nvr_id, camera_name, vendor, channel_no,
          coverage_zone, stream_path, snapshot_path, live_view_url, status,
          last_snapshot_url, last_snapshot_at, last_seen_at, is_recording, is_ptz,
          security_sites(id, name, county, address),
          security_posts(id, name, required_guards),
          security_nvr_devices(id, site_id, device_name, vendor, host, port, protocol, stream_base_url, web_url, status)
        `).order('camera_name'),
      ]);
      if (sitesRes.error) throw sitesRes.error;
      if (camerasRes.error) throw camerasRes.error;
      setSites((sitesRes.data || []) as SecuritySite[]);
      setCameras((camerasRes.data || []).map(normalizeCamera));
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Browser fullscreen API
  const togglePageFullscreen = async () => {
    if (!document.fullscreenElement) {
      await wallRef.current?.requestFullscreen();
      setIsPageFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsPageFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsPageFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const filteredCameras = cameras.filter(c => selectedSiteId === 'all' || c.site_id === selectedSiteId);
  const liveCount = filteredCameras.filter(c => Boolean(getLiveUrl(c))).length;
  const onlineCount = filteredCameras.filter(c => c.status === 'online').length;

  const gridClass: Record<GridLayout, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  };

  const layoutButtons: { cols: GridLayout; icon: React.ReactNode; label: string }[] = [
    { cols: 1, icon: <MonitorPlay size={15} />,  label: '1×1' },
    { cols: 2, icon: <Grid2x2 size={15} />,      label: '2×2' },
    { cols: 3, icon: <Grid3x3 size={15} />,      label: '3×3' },
    { cols: 4, icon: <LayoutGrid size={15} />,   label: '4×4' },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0f1a]">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Loading Camera Wall…</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={wallRef} className="flex h-screen flex-col bg-[#0a0f1a] text-slate-100 overflow-hidden">
      <CustomToast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={Boolean(toast)}
        onClose={() => setToast(null)}
      />

      {/* Fullscreen camera modal */}
      {fullscreenCamera && (
        <FullscreenModal
          camera={fullscreenCamera}
          index={fullscreenIndex}
          onClose={() => setFullscreenCamera(null)}
        />
      )}

      {/* ── Top Control Bar ──────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#0a0f1a] px-5 py-3">
        {/* Left: back + title */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/security/cctv')}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-purple opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-purple" />
            </span>
            <h1 className="text-sm font-black uppercase tracking-[0.25em] text-white">
              Live Wall
            </h1>
            <span className="rounded-lg border border-white/[0.08] bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
              {filteredCameras.length} cameras
            </span>
          </div>

          {/* Status pills */}
          <div className="hidden items-center gap-2 lg:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {onlineCount} online
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-brand-purple/20 bg-brand-purple/10 px-2.5 py-1 text-[10px] font-black uppercase text-brand-purple">
              <Video size={10} />
              {liveCount} live
            </span>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Site filter */}
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-xs text-slate-200 outline-none hover:border-white/20 focus:border-brand-purple/50"
          >
            <option value="all">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Layout switcher */}
          <div className="flex rounded-xl border border-white/10 bg-[#111827] p-1">
            {layoutButtons.map(btn => (
              <button
                key={btn.cols}
                type="button"
                onClick={() => setLayout(btn.cols)}
                title={`${btn.label} grid`}
                className={`flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-all ${
                  layout === btn.cols
                    ? 'bg-brand-purple text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {btn.icon}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => void fetchData(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* Page fullscreen */}
          <button
            type="button"
            onClick={() => void togglePageFullscreen()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
            title={isPageFullscreen ? 'Exit fullscreen' : 'Fullscreen wall'}
          >
            {isPageFullscreen ? <Minimize2 size={15} /> : <Expand size={15} />}
          </button>
        </div>
      </header>

      {/* ── Camera Grid ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-3">
        {filteredCameras.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Camera size={48} className="text-slate-700" />
            <p className="text-sm font-bold text-slate-600">No cameras found</p>
            <p className="text-xs text-slate-700">
              {selectedSiteId !== 'all'
                ? 'No cameras for this site. Try "All Sites".'
                : 'Add cameras in Camera & NVR Devices first.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/app/security/cctv/devices')}
              className="rounded-xl bg-brand-purple px-4 py-2 text-xs font-bold text-white hover:bg-brand-purple/90"
            >
              Go to Devices
            </button>
          </div>
        ) : (
          <div className={`grid gap-2 ${gridClass[layout]}`} style={{ gridAutoRows: layout === 1 ? 'calc(100vh - 80px)' : layout === 2 ? 'calc(50vh - 50px)' : 'calc(33vh - 40px)' }}>
            {filteredCameras.map((camera, idx) => (
              <CameraCell
                key={camera.id}
                camera={camera}
                index={idx}
                onExpand={() => {
                  setFullscreenCamera(camera);
                  setFullscreenIndex(idx);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Bottom status bar ────────────────────────────────────────────── */}
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.06] bg-[#0a0f1a] px-5 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
          Tough Force · CCTV Live Wall
        </p>
        <p className="text-[10px] text-slate-700">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </footer>
    </div>
  );
};

export default CctvWall;
