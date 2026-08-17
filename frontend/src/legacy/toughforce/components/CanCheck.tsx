// @ts-nocheck
import React, { ReactNode } from 'react';
import { useAccess, PermissionAction } from '../context/AccessContext';

interface CanCheckProps {
  I?: PermissionAction;
  a: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Declarative component for checking user permissions.
 * Usage:
 * <CanCheck I="can_write" a="ws_payroll">
 *    <Button>Create Payroll</Button>
 * </CanCheck>
 */
export const CanCheck: React.FC<CanCheckProps> = ({ I = 'can_read', a, children, fallback = null }) => {
  const { hasAccess, loading } = useAccess();
  
  if (loading) return null; // Avoid flickering before permissions are loaded
  
  if (hasAccess(a, I as PermissionAction)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default CanCheck;
