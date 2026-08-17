// @ts-nocheck
import { supabase } from '../utils/supabase';

export type PlatformLiveMetric = { label: string; value: string; change: string };

const countRows = async (table: string) => {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? null : count;
};

const metric = (label: string, value: number | null, fallback: string): PlatformLiveMetric => ({
  label,
  value: value === null ? 'Unavailable' : value.toLocaleString(),
  change: value === null ? fallback : 'Live read-only count',
});

export const loadPlatformDashboardMetrics = async (): Promise<PlatformLiveMetric[]> => {
  const [organizations, companies, users, audit] = await Promise.all([
    countRows('organizations'),
    countRows('companies'),
    countRows('profiles'),
    countRows('audit_events'),
  ]);

  return [
    metric('Organizations', organizations, 'Unavailable'),
    metric('Companies', companies, 'Unavailable'),
    metric('Users', users, 'Unavailable'),
    metric('Audit Events', audit, 'Unavailable'),
  ];
};
