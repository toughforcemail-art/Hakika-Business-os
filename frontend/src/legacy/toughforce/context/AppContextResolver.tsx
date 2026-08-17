// @ts-nocheck
import { useAccess } from './AccessContext';
import { useWorkspaceAdapter, type WorkspaceAdapterValue } from './WorkspaceAdapter';
import { ENABLE_WORKSPACE_CONTEXT } from '../config/featureFlags';
import type { AccessContextType } from './AccessContext';

export type AppContextValue =
  | { mode: 'legacy'; context: AccessContextType }
  | { mode: 'workspace'; context: WorkspaceAdapterValue };

/**
 * Selects the application context without changing either context's behavior.
 * The flag is intentionally disabled until an individual consumer is migrated.
 */
export function useAppContextResolver(): AppContextValue {
  const legacyContext = useAccess();
  const workspaceContext = useWorkspaceAdapter();

  if (ENABLE_WORKSPACE_CONTEXT) {
    return { mode: 'workspace', context: workspaceContext };
  }

  return { mode: 'legacy', context: legacyContext };
}
