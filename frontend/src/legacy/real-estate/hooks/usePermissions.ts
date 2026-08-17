// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { MODULES } from '../constants';

const ELEVATED_ROLES = new Set(['Super Admin', 'super_admin', 'Director', 'Director / Super Admin']);

export const usePermissions = () => {
    const [userRole, setUserRole] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return;
                }

                // Get role from profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile) {
                    setUserRole(profile.role);

                    // If Super Admin/Director, they have full access
                    if (ELEVATED_ROLES.has(profile.role)) {
                        setPermissions([]); // Empty means full access for these roles in our logic
                    } else {
                        // Get explicit permissions
                        const { data: rolePerms } = await supabase
                            .from('role_permissions')
                            .select('*')
                            .eq('role', profile.role);
                        
                        setPermissions(rolePerms || []);
                    }
                } else {
                    setUserRole(null);
                    setPermissions([]);
                }
            } catch (error) {
                console.error('Error fetching permissions:', error);
                if (!userRole || !ELEVATED_ROLES.has(userRole)) {
                    setPermissions([]);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, []);

    const canAccessModule = (moduleId: string): boolean => {
        if (ELEVATED_ROLES.has(userRole || '')) return true;
        if (permissions.length === 0) return false;
        return permissions.some((perm) => perm.module_id === moduleId && perm.can_read);
    };

    const canAccessPath = (path: string): boolean => {
        if (ELEVATED_ROLES.has(userRole || '')) return true;
        if (permissions.length === 0) return false;
        return true;
    };

    return { userRole, loading, canAccessModule, canAccessPath };
};
