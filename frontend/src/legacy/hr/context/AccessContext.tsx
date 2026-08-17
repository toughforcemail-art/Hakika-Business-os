// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { isAbortError } from '../utils/abortErrors';
import { activityLogger } from '../utils/activityLogger';
import { EmailTemplates, sendEmail } from '../services/emailService';
import { sendBulkSms } from '../services/SMSService';
import { getPublicBaseUrl } from '../utils/publicUrl';

export interface PermissionEntry {
  module_id: string;
  can_read: boolean;
  can_write: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_view_menu: boolean;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  email: string;
  avatar_url?: string | null;
  company_id?: string | null;
  company_code?: string | null;
  organization_id?: string | null;
  module?: string | null;
  login_scope?: string | null;
  dashboard_access?: string[] | string | null;
}

const PROFILE_SELECTS = [
  'id:user_id, full_name:display_name, phone_e164, locale',
] as const;

export type PermissionAction = 'can_read' | 'can_write' | 'can_edit' | 'can_delete' | 'can_approve' | 'can_view_menu';

export interface AccessContextType {
  role: string | null;
  profile: Profile | null;
  permissions: Record<string, PermissionEntry>;
  visiblePages: Set<string>;
  activeServices: Set<string>;
  loading: boolean;
  error: string | null;
  hasAccess: (moduleId: string, action?: PermissionAction) => boolean;
  hasServiceAccess: (serviceKey: string) => boolean;
  refreshPermissions: (skipLoading?: boolean) => Promise<void>;
}

export const AccessContext = createContext<AccessContextType | undefined>(undefined);

const AUTH_ROUTES = new Set(['/', '/portal', '/reset-password', '/verify-2fa']);
const ELEVATED_ROLES = new Set(['Super Admin', 'Director', 'Director / Super Admin']);

export const AccessProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PermissionEntry>>({});
  const [visiblePages, setVisiblePages] = useState<Set<string>>(new Set());
  const [activeServices, setActiveServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true); // Added for watchdog cleanup

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const isFetching = useRef(false);
  const profileRef = useRef<Profile | null>(null);
  const authBootstrapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readCookie = useCallback((name: string) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie
      .split('; ')
      .find(part => part.startsWith(`${encodeURIComponent(name)}=`));
    if (!match) return null;
    return decodeURIComponent(match.split('=').slice(1).join('='));
  }, []);

  const writeCookie = useCallback((name: string, value: string) => {
    if (typeof document === 'undefined') return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=31536000${secure}`;
  }, []);

  const getDeviceId = useCallback(() => {
    const key = 'hakika_device_id';
    let deviceId = localStorage.getItem(key) || readCookie(key);
    if (!deviceId) {
      deviceId = window.crypto?.randomUUID?.() || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    localStorage.setItem(key, deviceId);
    writeCookie(key, deviceId);
    return deviceId;
  }, [readCookie, writeCookie]);

  const getDeviceName = useCallback(() => {
    const userAgentDataPlatform = (navigator as any).userAgentData?.platform;
    const parts = [navigator.platform, userAgentDataPlatform, navigator.userAgent].filter(Boolean);
    return parts.join(' | ').slice(0, 180);
  }, []);

  const registerCurrentDevice = useCallback(async () => {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    const attemptRegister = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        const { data: { user: fallbackUser } } = await supabase.auth.getUser();
        if (!fallbackUser) return null;
      }

      const { data, error } = await supabase.rpc('register_user_device', {
        p_device_id: deviceId,
        p_device_name: deviceName,
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      return data;
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await attemptRegister();
        if (result) return result;
        return;
      } catch (error: any) {
        const message = String(error?.message || '');
        const authRelated = /authentication required|jwt|token|session/i.test(message);
        if (authRelated && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
  }, [getDeviceId, getDeviceName]);

  const notifyDeviceLimitReached = useCallback(async () => {
    const user = profileRef.current;
    if (!user) return;

    const publicBaseUrl = getPublicBaseUrl();
    const resetLink = publicBaseUrl ? `${publicBaseUrl}/reset-password` : `${window.location.origin}/reset-password`;
    const subject = 'New device sign-in blocked';
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New device sign-in blocked</h2>
        <p>Hello ${user.full_name || 'there'}, we blocked a login because your account is already active on the maximum allowed number of devices.</p>
        <p>If this was you, revoke an old device from your Devices page and sign in again.</p>
        <p>If this was not you, please reset your password immediately.</p>
        <p><a href="${resetLink}">Reset password</a></p>
      </div>
    `;

    const smsMessage = `HAKIKA: A new device sign-in was blocked because your account reached the 2-device limit. If this was not you, reset your password: ${resetLink}`;

    const notifications: Array<{ label: string; promise: Promise<any> }> = [];
    if (user.email) {
      notifications.push({
        label: 'email',
        promise: sendEmail({
          to: user.email,
          subject,
          html,
        }),
      });
    }
    if ((user as any).phone || (user as any).phone_number) {
      notifications.push({
        label: 'sms',
        promise: sendBulkSms([((user as any).phone || (user as any).phone_number) as string], smsMessage),
      });
    }
    const results = await Promise.allSettled(notifications.map((item) => item.promise));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Device limit notification ${notifications[index].label} failed:`, result.reason);
      }
    });
  }, []);

  const notifyNewDeviceDetected = useCallback(async () => {
    const user = profileRef.current;
    if (!user?.email) return;
    const deviceId = getDeviceId();
    const notificationKey = `hakika_new_device_notified_${deviceId}`;
    if (localStorage.getItem(notificationKey) === '1') return;

    const subject = 'New device detected';
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New device detected</h2>
        <p>Hello ${user.full_name || 'there'}, we detected a sign-in from a new device on your account.</p>
        <p>If this was you, no action is needed.</p>
        <p>If this was not you, please reset your password immediately.</p>
        <p><a href="${getPublicBaseUrl() ? `${getPublicBaseUrl()}/reset-password` : `${window.location.origin}/reset-password`}">Reset password</a></p>
      </div>
    `;

    const smsMessage = `HAKIKA: A new device was detected on your account. If this was not you, reset your password: ${getPublicBaseUrl() ? `${getPublicBaseUrl()}/reset-password` : `${window.location.origin}/reset-password`}`;

    const notifications: Array<{ label: string; promise: Promise<any> }> = [{
      label: 'email',
      promise: sendEmail({
        to: user.email,
        subject,
        html,
      }),
    }];

    if ((user as any).phone || (user as any).phone_number) {
      notifications.push({
        label: 'sms',
        promise: sendBulkSms([((user as any).phone || (user as any).phone_number) as string], smsMessage),
      });
    }

    const results = await Promise.allSettled(notifications.map((item) => item.promise));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`New device notification ${notifications[index].label} failed:`, result.reason);
      }
    });
    localStorage.setItem(notificationKey, '1');
  }, []);
  const clearCachedAccess = useCallback(() => {
    localStorage.removeItem('hakika_cached_profile');
    localStorage.removeItem('hakika_cached_permissions');
    localStorage.removeItem('hakika_cached_visible_pages');
    localStorage.removeItem('hakika_cached_services');
    localStorage.removeItem('hakika_cached_at');
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Load from cache on initial startup to prevent flicker.
  // If the cache is older than CACHE_TTL_MS, still show it immediately but
  // mark it stale so the auth listener triggers a background refresh.
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  useEffect(() => {
    const cachedProfile = localStorage.getItem('hakika_cached_profile');
    const cachedPerms = localStorage.getItem('hakika_cached_permissions');
    const cachedVisible = localStorage.getItem('hakika_cached_visible_pages');
    const cachedServices = localStorage.getItem('hakika_cached_services');
    const cachedAt = localStorage.getItem('hakika_cached_at');

    if (cachedProfile && cachedPerms) {
      try {
        const parsedProfile = JSON.parse(cachedProfile);
        const cacheAge = cachedAt ? Date.now() - Number(cachedAt) : Infinity;
        const isStale = cacheAge > CACHE_TTL_MS;

        // Populate state from cache immediately to prevent "null role" redirects
        setProfile(parsedProfile);
        profileRef.current = parsedProfile;
        setPermissions(JSON.parse(cachedPerms));
        if (cachedVisible) setVisiblePages(new Set(JSON.parse(cachedVisible)));
        if (cachedServices) setActiveServices(new Set(JSON.parse(cachedServices)));
        setRole(parsedProfile.role);

        // Sync logger with cached identity
        activityLogger.syncUser(parsedProfile.id, parsedProfile.email, parsedProfile.full_name, true, parsedProfile.company_code);

        setLoading(false); // We have enough to show the app while background refresh happens

        if (isStale) {
          console.log('AccessContext: Cache is stale, background refresh will be triggered by auth listener.');
        } else {
          console.log('AccessContext: Initialized from fresh cache for role:', parsedProfile.role);
        }
      } catch (e) {
        console.warn('AccessContext: Failed to parse cache.');
        clearCachedAccess();
      }
    }
  }, []);

  const fetchPermissions = useCallback(async (skipLoading = false, providedSession?: any) => {
    if (isFetching.current) {
      console.log('AccessContext: Fetch already in progress, skipping.');
      return;
    }
    
    // Only show loading if we don't have a profile yet (initial cold load)
    if (!skipLoading && !profileRef.current && isMounted.current) setLoading(true);
    isFetching.current = true;

    try {
      if (isMounted.current) {
        setError(null);
      }

      // 1. Use the provided auth event payload. Avoid additional auth reads
      // here because they can wake the refresh-token path on some browsers.
      const user = providedSession?.user;
      
      if (!user) {
        console.log('AccessContext: No user session found.');
        if (isMounted.current) {
          setRole(null);
          setProfile(null);
          setPermissions({});
          setVisiblePages(new Set());
          setActiveServices(new Set());
          clearCachedAccess();
          setLoading(false);
        }
        return;
      }

      // 2. Fetch fresh profile
      console.log('AccessContext: Fetching profile for', user.id);
      let profileResponse = null as Awaited<ReturnType<typeof supabase.from>> extends never ? never : any;
      for (const fields of PROFILE_SELECTS) {
        const attempt = await supabase.schema('iam').from('profiles').select(fields).eq('user_id', user.id).maybeSingle();
        profileResponse = attempt;
        if (!attempt.error) break;
      }

      const { data: profileData, error: profileError, status: profileStatus, statusText: profileStatusText } = profileResponse;

      console.log('AccessContext: Profile fetch response', {
        userId: user.id,
        status: profileStatus,
        statusText: profileStatusText,
        hasData: Boolean(profileData),
        profileRole: profileData?.role || null,
        profileEmail: profileData?.email || null,
        errorCode: profileError?.code || null,
        errorMessage: profileError?.message || null,
        errorDetails: profileError?.details || null,
        errorHint: profileError?.hint || null,
      });

      if (profileError) {
        console.error('AccessContext: Profile fetch error', {
          userId: user.id,
          status: profileStatus,
          statusText: profileStatusText,
          error: profileError,
        });
        if (isMounted.current) {
          setError('We could not load your profile right now.');
          if (!profileRef.current) {
            setRole(null);
            setProfile(null);
            setPermissions({});
            setVisiblePages(new Set());
            setActiveServices(new Set());
            clearCachedAccess();
          }
          setLoading(false);
        }
        return;
      }

      if (!profileData) {
        console.warn('AccessContext: Profile fetch returned no row', {
          userId: user.id,
          status: profileStatus,
          statusText: profileStatusText,
        });
        if (isMounted.current) {
          if (profileRef.current) {
            console.warn('AccessContext: Keeping cached profile because the live profile row is missing.');
            setError(null);
            setLoading(false);
            isFetching.current = false;
            return;
          }

          const fallbackProfile = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email || 'Signed in user',
            role: user.user_metadata?.role || 'Staff',
            email: user.email || '',
            avatar_url: null,
            company_id: user.user_metadata?.company_id || null,
            company_code: user.user_metadata?.company_code || null,
            organization_id: null,
            module: user.user_metadata?.module || null,
            login_scope: user.user_metadata?.login_scope || null,
            dashboard_access: Array.isArray(user.user_metadata?.dashboard_access)
              ? user.user_metadata.dashboard_access
              : [],
          } satisfies Profile;

          console.warn('AccessContext: Using auth metadata fallback profile until the database profile is restored.');
          setError('We could not load your saved profile right now. Showing a limited session.');
          setRole(fallbackProfile.role);
          setProfile(fallbackProfile);
          setPermissions({});
          setVisiblePages(new Set());
          setActiveServices(new Set());
          localStorage.setItem('hakika_cached_profile', JSON.stringify(fallbackProfile));
          clearCachedAccess();
          setLoading(false);
        }
        return;
      }

      try {
        await registerCurrentDevice();
        await notifyNewDeviceDetected();
      } catch (deviceError: any) {
        console.warn('AccessContext: Device registration failed.', deviceError);
        if (isMounted.current) {
          setError('We could not register this device right now.');
          setLoading(false);
        }
        return;
      }

      // 3. Update State & Cache
      if (isMounted.current) {
        setRole(prev => prev !== profileData.role ? profileData.role : prev);
        setProfile(prev => JSON.stringify(prev) !== JSON.stringify(profileData) ? profileData : prev);
        localStorage.setItem('hakika_cached_profile', JSON.stringify(profileData));
        localStorage.setItem('hakika_cached_at', String(Date.now()));

        // Sync logger with fresh identity
        activityLogger.syncUser(profileData.id, profileData.email, profileData.full_name, true, profileData.company_code);
      }

      // 4. Fetch Permissions & Visibility
      const [rolePermsRes, visibilityRes, profileVisibilityRes] = await Promise.allSettled([
        supabase.from('role_permissions').select('*').eq('role', profileData.role),
        supabase.from('page_visibility').select('page_path, is_visible').eq('role', profileData.role),
        supabase.from('profile_page_visibility').select('page_path, is_visible').eq('profile_id', profileData.id)
      ]);
      const servicesRes = await supabase
        .from('company_service_subscriptions')
        .select('service_key, access_state, status, expires_at')
        .eq('company_id', profileData.company_id ?? '00000000-0000-0000-0000-000000000000');

      if (isMounted.current) {
        const rolePermsValue = rolePermsRes.status === 'fulfilled' ? rolePermsRes.value : null;
        if (rolePermsValue && !rolePermsValue.error && rolePermsValue.data) {
          const rolePerms = rolePermsValue.data;
          const permsMap: Record<string, PermissionEntry> = {};
          rolePerms.forEach(p => {
            permsMap[p.module_id] = p;
          });
          setPermissions(prev => JSON.stringify(prev) !== JSON.stringify(permsMap) ? permsMap : prev);
          localStorage.setItem('hakika_cached_permissions', JSON.stringify(permsMap));
        } else if (rolePermsValue?.error) {
          if (!isAbortError(rolePermsValue.error)) {
            console.error('AccessContext: Permissions fetch error', rolePermsValue.error);
            setError(prev => prev || 'We could not load your permissions right now.');
          }
        } else if (rolePermsRes.status === 'rejected') {
          if (!isAbortError(rolePermsRes.reason)) {
            console.error('AccessContext: Permissions fetch rejected', rolePermsRes.reason);
            setError(prev => prev || 'We could not load your permissions right now.');
          }
        }

        let visibleSet = new Set<string>();
        let servicesSet = new Set<string>();

        if (!ELEVATED_ROLES.has(profileData.role)) {
          const visibilityValue = visibilityRes.status === 'fulfilled' ? visibilityRes.value : null;
          const profileVisibilityValue = profileVisibilityRes.status === 'fulfilled' ? profileVisibilityRes.value : null;
          const settings = visibilityValue && !visibilityValue.error ? visibilityValue.data : null;
          const profileSettings = profileVisibilityValue && !profileVisibilityValue.error ? profileVisibilityValue.data : [];

          if (visibilityValue?.error) {
            if (!isAbortError(visibilityValue.error)) {
              console.error('AccessContext: Page visibility fetch error', visibilityValue.error);
              setError(prev => prev || 'We could not load page visibility right now.');
            }
          } else if (visibilityRes.status === 'rejected') {
            if (!isAbortError(visibilityRes.reason)) {
              console.error('AccessContext: Page visibility fetch rejected', visibilityRes.reason);
              setError(prev => prev || 'We could not load page visibility right now.');
            }
          }

          if (settings && settings.length > 0) {
            visibleSet = new Set(
              settings
                .filter(s => s.is_visible)
                .map(s => s.page_path)
            );
          }

          // Explicit user overrides win over the role default for this route.
          (profileSettings || []).forEach((setting: { page_path: string; is_visible: boolean }) => {
            if (setting.is_visible) visibleSet.add(setting.page_path);
            else visibleSet.delete(setting.page_path);
          });
        }
        
        setVisiblePages(prev => {
          const prevArr = Array.from(prev);
          const newArr = Array.from(visibleSet);
          if (JSON.stringify(prevArr) !== JSON.stringify(newArr)) {
            return visibleSet;
          }
          return prev;
        });
        localStorage.setItem('hakika_cached_visible_pages', JSON.stringify(Array.from(visibleSet)));

        if (!servicesRes.error && servicesRes.data) {
          servicesSet = new Set(
            servicesRes.data
              .filter((s: any) =>
                s.access_state === 'active' &&
                ['active', 'trial', 'grace'].includes(s.status) &&
                (!s.expires_at || new Date(s.expires_at) > new Date())
              )
              .map((s: any) => s.service_key)
          );
          setActiveServices(servicesSet);
          localStorage.setItem('hakika_cached_services', JSON.stringify(Array.from(servicesSet)));
        }
      }
    } catch (err: any) {
      if (isAbortError(err)) return;
      console.error("AccessContext: Error during refresh", err);
      if (isMounted.current) setError('We could not refresh your session right now.');
    } finally {
      if (isMounted.current) setLoading(false);
      isFetching.current = false;
    }
  }, [clearCachedAccess, registerCurrentDevice]); // Removed [profile] dependency to break the loop

  useEffect(() => {
    console.log('AccessContext: Subscribing to auth state changes. Initial path:', window.location.pathname);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (authBootstrapTimer.current) {
        clearTimeout(authBootstrapTimer.current);
      }

      authBootstrapTimer.current = setTimeout(() => {
        void (async () => {
          if (!isMounted.current) return;
          console.log('AccessContext: Auth State Change Event (Throttled):', event, 'User:', session?.user?.email);
          
          try {
            const currentPath = window.location.pathname;
            const isAuthRoute = AUTH_ROUTES.has(currentPath);

            if (event === 'PASSWORD_RECOVERY') {
              console.log('AccessContext: Password recovery session detected. Skipping profile/permission bootstrap.');
              if (isMounted.current) {
                setLoading(false);
                setError(null);
              }
              return;
            }

            if (event === 'TOKEN_REFRESHED') {
              // Token refreshes are expected noise; avoid logging them so real auth failures stand out.
              if (isMounted.current && loading) {
                setLoading(false);
              }
              return;
            }

            if (event === 'SIGNED_OUT') {
              console.log('AccessContext: User signed out. Clearing state.');
              if (isMounted.current) {
                setRole(null);
                setProfile(null);
                setPermissions({});
                setVisiblePages(new Set());
                setActiveServices(new Set());
                clearCachedAccess();
                
                // Clear logger identity
                activityLogger.syncUser(null, null, null, false);
                
                setError(null);
                setLoading(false);
              }
            } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
              // Only trigger a full bootstrap if we don't have this user yet, or if it's a SIGNED_IN event
              const isNewUser = profileRef.current?.id !== session.user.id;
              
              if (isNewUser || event === 'SIGNED_IN') {
                console.log(`AccessContext: ${event} for ${session.user.email} from ${currentPath} - bootstrapping profile and permissions.`);
                await fetchPermissions(false, session);
              } else {
                console.log('AccessContext: Initial session matched existing profile. Skipping redundant bootstrap.');
                if (isMounted.current) setLoading(false);
              }
            } else if (isAuthRoute) {
              console.log('AccessContext: On auth route with no session. Clearing loading.');
              if (isMounted.current) {
                setLoading(false);
                setError(null);
              }
            } else {
              console.log(`AccessContext: Unhandled auth event ${event} on ${currentPath}.`);
              await fetchPermissions(isAuthRoute, session);
            }
          } catch (err) {
            if (!isAbortError(err)) {
              console.warn('AccessContext: Auth bootstrap failed.', err);
            }
          }
        })();
      }, 25);
    });

    return () => {
      if (authBootstrapTimer.current) {
        clearTimeout(authBootstrapTimer.current);
        authBootstrapTimer.current = null;
      }
      subscription.unsubscribe();
    };
  }, [clearCachedAccess, fetchPermissions]);

  // Safety watchdog: ensure loading is cleared after 10 seconds if no auth event happens
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && isMounted.current) {
        console.warn('AccessContext: Loading timeout triggered. Forcing loading to false.');
        setLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  const hasAccess = (moduleId: string, action: PermissionAction = 'can_read') => {
    // Super Admins and Directors always retain admin control, regardless of page visibility policy.
    if (['Super Admin', 'Director', 'Director / Super Admin', 'Administrator'].includes(role || '') && moduleId.startsWith('admin_')) {
      return true;
    }
    
    const perm = permissions[moduleId];
    if (!perm) return false;

    return !!perm[action];
  };

  const hasServiceAccess = (serviceKey: string) => activeServices.has(serviceKey);

  // Expose as refreshPermissions in context
  return (
    <AccessContext.Provider value={{ role, profile, permissions, visiblePages, activeServices, loading, error, hasAccess, hasServiceAccess, refreshPermissions: fetchPermissions }}>
      {children}
    </AccessContext.Provider>
  );
};

export const useAccess = (): AccessContextType => {
  const context = useContext(AccessContext);
  if (context === undefined) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return context;
};

export const useAccessOrFallback = (): AccessContextType => {
  const context = useContext(AccessContext);
  if (context === undefined) {
    return {
      role: null,
      profile: null,
      permissions: {},
      visiblePages: new Set(),
      activeServices: new Set(),
      loading: true,
      error: null,
      hasAccess: () => false,
      hasServiceAccess: () => false,
      refreshPermissions: async () => {},
    };
  }
  return context;
};
