// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { Shield, AlertTriangle } from 'lucide-react';

const ELEVATED_ROLES = new Set(['Director', 'Super Admin', 'Director / Super Admin', 'Administrator']);
const COMPANY_ADMIN_ALLOWED_PATHS = [
  '/admin/dashboards',
  '/admin/overview',
  '/admin/profile',
  '/admin/activity-log',
  '/admin/logs',
  '/admin/archives',
  '/admin/service-rentals',
  '/admin/service-rentals/subscriptions',
  '/admin/service-rentals/admins',
  '/admin/service-rentals/reports',
];
const COMPANY_ADMIN_BLOCKED_PREFIXES = [
  '/admin/companies',
  '/admin/service-subscriptions',
  '/admin/service-billing',
  '/admin/service-pricing',
  '/admin/service-payments',
  '/admin/dashboard-entitlements',
  '/admin/permissions',
  '/admin/page-visibility',
  '/admin/admins',
  '/admin/directors',
  '/admin/roles',
  '/admin/migration-health',
];

interface AdminGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const AdminGuard: React.FC<AdminGuardProps> = ({ 
  children, 
  allowedRoles = ['Director', 'Super Admin'] 
}) => {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dashboardAccess, setDashboardAccess] = useState<string[]>([]);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, dashboard_access')
          .eq('id', user.id)
          .maybeSingle();

        if (error || !profile) {
          console.error('Error fetching user profile:', error);
          setHasAccess(false);
          setLoading(false);
          return;
        }

        setUserRole(profile.role);
        setDashboardAccess(Array.isArray(profile.dashboard_access)
          ? profile.dashboard_access.map((item: unknown) => String(item).trim()).filter(Boolean)
          : typeof profile.dashboard_access === 'string'
            ? profile.dashboard_access.split(',').map((item: string) => item.trim()).filter(Boolean)
            : []);
        const normalizedAllowed = new Set([...allowedRoles, ...Array.from(ELEVATED_ROLES)]);
        const pathname = window.location.pathname;
        const isCompanyAdmin = profile.role === 'Admin' && (
          Array.isArray(profile.dashboard_access)
            ? profile.dashboard_access.includes('ADMIN_DASH')
            : String(profile.dashboard_access || '').includes('ADMIN_DASH')
        );

        const isBlockedPlatformArea = COMPANY_ADMIN_BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
        const isAllowedCompanyAdminPage = COMPANY_ADMIN_ALLOWED_PATHS.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));

        setHasAccess(
          normalizedAllowed.has(profile.role) ||
          (isCompanyAdmin && (!isBlockedPlatformArea || isAllowedCompanyAdminPage))
        );
      } catch (error) {
        console.error('Error in AdminGuard:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [allowedRoles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-dark-background">
        <div className="text-center">
          <Shield className="w-12 h-12 text-pink-500 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-dark-background">
        <div className="max-w-md text-center p-8">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            This area is restricted to administrators only.
          </p>
          {userRole && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Your role: <span className="font-semibold">{userRole}</span>
            </p>
          )}
          <p className="text-xs text-gray-400 mb-6">
            Required roles: {allowedRoles.join(', ')}
          </p>
          {dashboardAccess.includes('ADMIN_DASH') && (
            <p className="text-xs text-emerald-500 mb-6">
              Company admin access detected. Platform setup pages are hidden, but your company dashboard is available.
            </p>
          )}
          <button
            onClick={() => window.location.href = '/admin/dashboards'}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
