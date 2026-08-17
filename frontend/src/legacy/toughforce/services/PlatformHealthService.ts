// @ts-nocheck
import { supabase, SUPABASE_URL } from '../utils/supabase';

export type HealthState = 'Healthy' | 'Online' | 'Unavailable' | 'Unknown';
export type PlatformHealthMetric = { label: string; value: string; state: HealthState };
export type PlatformHealthSnapshot = { metrics: PlatformHealthMetric[]; latencyMs: number | null; refreshedAt: string; connectionError?: string };

const unavailable = (label: string): PlatformHealthMetric => ({ label, value: 'Unavailable', state: 'Unavailable' });

export const PlatformHealthService = {
  async testConnection(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
    const started = performance.now();
    try {
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      const latencyMs = Math.round(performance.now() - started);
      return error ? { ok: false, latencyMs, error: error.message } : { ok: true, latencyMs };
    } catch (error) {
      return { ok: false, latencyMs: null, error: error instanceof Error ? error.message : 'Supabase is unreachable' };
    }
  },
  async getSnapshot(): Promise<PlatformHealthSnapshot> {
    const connection = await this.testConnection();
    const projectHost = (() => { try { return new URL(SUPABASE_URL).hostname; } catch { return null; } })();
    const metrics: PlatformHealthMetric[] = [
      { label: 'Database', value: connection.ok ? 'Healthy' : 'Database Offline', state: connection.ok ? 'Healthy' : 'Unavailable' },
      { label: 'Project', value: projectHost ? 'Active' : 'Unavailable', state: projectHost ? 'Online' : 'Unavailable' },
      { label: 'REST API', value: connection.ok ? 'Online' : 'API Unreachable', state: connection.ok ? 'Online' : 'Unavailable' },
      { label: 'Authentication', value: supabase.auth ? 'Online' : 'Authentication Unavailable', state: supabase.auth ? 'Online' : 'Unavailable' },
      unavailable('Region'), unavailable('PostgreSQL version'), unavailable('Storage'), unavailable('Realtime'), unavailable('Edge Functions'),
    ];
    return { metrics, latencyMs: connection.latencyMs, refreshedAt: new Date().toISOString(), connectionError: connection.error };
  },
};
