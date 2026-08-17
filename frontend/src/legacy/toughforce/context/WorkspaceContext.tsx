// @ts-nocheck
import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import type {
  Workspace,
  WorkspaceContextValue,
  WorkspaceMembership,
  WorkspaceModule,
  WorkspacePermissions,
  WorkspaceSubscription,
} from '../types/workspace';

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
let sessionWorkspace: Workspace | null | undefined;

const asRecord = (value: unknown): Record<string, unknown> => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
);

const asString = (value: unknown): string | null => typeof value === 'string' ? value : null;

const mapMembership = (value: unknown): WorkspaceMembership | null => {
  const row = asRecord(value);
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    role: asString(row.role),
    organizationId: asString(row.organization_id),
    companyId: asString(row.company_id),
  };
};

const rowsFrom = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

async function readOptionalTable(table: string, userId: string) {
  return supabase.from(table).select('*').eq('user_id', userId);
}

async function resolveWorkspace(): Promise<Workspace | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profileResult = await supabase
    .from('profiles')
    .select('id, full_name, email, role, company_id, company_code, organization_id, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;

  const profile = asRecord(profileResult.data);
  const companyId = asString(profile.company_id);
  const organizationId = asString(profile.organization_id);
  const [organizationResult, companyResult, subscriptionsResult, organizationMembershipsResult, companyMembershipsResult] = await Promise.all([
    organizationId ? supabase.from('organizations').select('id, name, logo_url, theme').eq('id', organizationId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    companyId ? supabase.from('companies').select('id, name, company_name, code, logo_url, theme').eq('id', companyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    companyId ? supabase.from('company_service_subscriptions').select('id, service_key, status, access_state, expires_at').eq('company_id', companyId) : Promise.resolve({ data: [], error: null }),
    readOptionalTable('organization_memberships', user.id).catch(() => ({ data: [], error: null })),
    readOptionalTable('company_memberships', user.id).catch(() => ({ data: [], error: null })),
  ]);

  const organization = asRecord(organizationResult.data);
  const company = asRecord(companyResult.data);
  const subscriptions = rowsFrom(subscriptionsResult.data).map((value): WorkspaceSubscription | null => {
    const row = asRecord(value);
    const id = asString(row.id);
    const serviceKey = asString(row.service_key);
    if (!id || !serviceKey) return null;
    return {
      id,
      serviceKey,
      status: asString(row.status) ?? asString(row.access_state) ?? 'unknown',
      expiresAt: asString(row.expires_at),
    };
  }).filter((value): value is WorkspaceSubscription => value !== null);

  const roles = [asString(profile.role), ...rowsFrom(organizationMembershipsResult.data).map(row => asString(asRecord(row).role)), ...rowsFrom(companyMembershipsResult.data).map(row => asString(asRecord(row).role))]
    .filter((role): role is string => Boolean(role));
  const availableModules: WorkspaceModule[] = subscriptions.map(subscription => ({
    key: subscription.serviceKey,
    label: subscription.serviceKey,
    enabled: subscription.status === 'active' || subscription.status === 'trialing',
  }));
  const permissions: WorkspacePermissions = {};
  const organizationName = asString(organization.name);
  const companyName = asString(company.name) ?? asString(company.company_name);

  return {
    id: companyId ?? organizationId ?? user.id,
    userId: user.id,
    email: user.email ?? asString(profile.email),
    fullName: asString(profile.full_name),
    organizationId,
    companyId,
    name: companyName ?? organizationName ?? 'Workspace',
    companyCode: asString(profile.company_code) ?? asString(company.code),
    roles: [...new Set(roles)],
    organizationMemberships: rowsFrom(organizationMembershipsResult.data).map(mapMembership).filter((value): value is WorkspaceMembership => value !== null),
    companyMemberships: rowsFrom(companyMembershipsResult.data).map(mapMembership).filter((value): value is WorkspaceMembership => value !== null),
    branding: {
      name: companyName ?? organizationName ?? 'Workspace',
      logo: asString(company.logo_url) ?? asString(organization.logo_url) ?? asString(profile.avatar_url),
      theme: asString(company.theme) ?? asString(organization.theme),
    },
    subscriptionStatus: subscriptions[0]?.status ?? null,
    subscriptions,
    availableModules,
    permissions,
  };
}

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [workspace, setWorkspace] = useState<WorkspaceContextValue['workspace']>(sessionWorkspace ?? null);
  const [loading, setLoading] = useState(sessionWorkspace === undefined);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refreshWorkspace = async () => {
    setLoading(true);
    setError(null);
    const startedAt = performance.now();
    try {
      const resolved = await resolveWorkspace();
      sessionWorkspace = resolved;
      if (mounted.current) setWorkspace(resolved);
      if (import.meta.env.DEV) {
        console.info('Workspace Resolution', {
          'Authenticated User': resolved?.userId ?? null,
          Organization: resolved?.organizationId ?? null,
          Company: resolved?.companyId ?? null,
          Subscriptions: resolved?.subscriptions ?? [],
          Modules: resolved?.availableModules ?? [],
          Permissions: resolved?.permissions ?? {},
          'Resolution Time': Math.round(performance.now() - startedAt),
        });
      }
    } catch (resolutionError) {
      sessionWorkspace = null;
      if (mounted.current) {
        setWorkspace(null);
        setError(resolutionError instanceof Error ? resolutionError.message : 'Workspace resolution failed.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    if (sessionWorkspace === undefined) void refreshWorkspace();
    return () => { mounted.current = false; };
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace,
    workspaceId: workspace?.id ?? null,
    organizationId: workspace?.organizationId ?? null,
    activeCompanyId: workspace?.companyId ?? null,
    subscriptions: [],
    availableModules: [],
    permissions: {},
    loading,
    error,
    refreshWorkspace,
    switchWorkspace: async () => { /* Switching is intentionally deferred to a later phase. */ },
  }), [error, loading, refreshWorkspace, workspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export { WorkspaceContext };
