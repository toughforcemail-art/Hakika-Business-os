// @ts-nocheck
import { useMemo } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import type { WorkspaceBranding, WorkspaceModule, WorkspaceSubscription } from '../types/workspace';

export interface WorkspaceAdapterValue {
  currentCompany: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  currentOrganization: {
    id: string;
    name: string;
  } | null;
  companyCode: string | null;
  subscriptions: WorkspaceSubscription[];
  availableModules: WorkspaceModule[];
  permissions: Record<string, boolean>;
  roles: string[];
  branding: WorkspaceBranding | null;
  workspaceStatus: 'loading' | 'error' | 'resolved' | 'empty';
  hasModule: (moduleKey: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  isSubscribed: (serviceKey: string) => boolean;
}

export function useWorkspaceAdapter(): WorkspaceAdapterValue {
  const {
    workspace,
    subscriptions,
    availableModules,
    permissions,
    loading,
    error,
  } = useWorkspace();

  return useMemo(() => {
    const currentCompany = workspace?.companyId
      ? {
          id: workspace.companyId,
          name: workspace.name,
          code: workspace.companyCode,
        }
      : null;
    const currentOrganization = workspace?.organizationId
      ? {
          id: workspace.organizationId,
          name: workspace.name,
        }
      : null;

    return {
      currentCompany,
      currentOrganization,
      companyCode: workspace?.companyCode ?? null,
      subscriptions,
      availableModules,
      permissions,
      roles: workspace?.roles ?? [],
      branding: workspace?.branding ?? null,
      workspaceStatus: loading ? 'loading' : error ? 'error' : workspace ? 'resolved' : 'empty',
      hasModule: (moduleKey: string) => availableModules.some((module) => module.key === moduleKey && module.enabled),
      hasPermission: (permission: string) => permissions[permission] === true,
      hasRole: (role: string) => (workspace?.roles ?? []).includes(role),
      isSubscribed: (serviceKey: string) => subscriptions.some((subscription) => (
        subscription.serviceKey === serviceKey && subscription.status === 'active'
      )),
    };
  }, [availableModules, error, loading, permissions, subscriptions, workspace]);
}
