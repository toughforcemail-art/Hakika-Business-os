// @ts-nocheck
import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface AppRouteBoundaryProps {
  children: React.ReactNode;
  fallbackHref?: string;
  resetKey: string;
}

interface AppRouteBoundaryState {
  error: Error | null;
  isRecoveringChunk: boolean;
}

const CHUNK_RELOAD_KEY = 'hakika_chunk_reload_attempted';

const isChunkLoadError = (error: Error) => {
  const message = `${error.message || ''} ${error.name || ''}`.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('mime type of "text/html"') ||
    message.includes('loading chunk') ||
    message.includes('chunkloaderror')
  );
};

class AppRouteBoundary extends React.Component<AppRouteBoundaryProps, AppRouteBoundaryState> {
  state: AppRouteBoundaryState = {
    error: null,
    isRecoveringChunk: false,
  };

  static getDerivedStateFromError(error: Error): Partial<AppRouteBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Route rendering failed:', error, errorInfo);

    if (typeof window !== 'undefined' && isChunkLoadError(error)) {
      const alreadyRetried = window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === 'true';
      if (!alreadyRetried) {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
        this.setState({ isRecoveringChunk: true });
        window.location.reload();
        return;
      }
    }
  }

  componentDidUpdate(prevProps: AppRouteBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, isRecoveringChunk: false });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="rounded-3xl border border-rose-200 bg-white/90 p-8 shadow-sm dark:border-rose-500/20 dark:bg-dark-surface/85">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle size={22} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                This page hit an unexpected problem
              </h2>
              <p className="text-sm leading-6 text-slate-600 dark:text-dark-text-muted">
                The rest of your workspace is still available. You can reload this route or jump back
                to a safe dashboard while we keep hardening failures like this.
              </p>
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-300">
                {this.state.error.message || 'A rendering error occurred in this route.'}
              </p>
              {this.state.isRecoveringChunk && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trying to recover the route chunk automatically.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e85f00]"
              type="button"
            >
              <RefreshCw size={16} />
              Reload Route
            </button>
            <button
              onClick={() => window.location.assign(this.props.fallbackHref || '/admin/dashboards')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-white/5"
              type="button"
            >
              <Home size={16} />
              Safe Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppRouteBoundary;
