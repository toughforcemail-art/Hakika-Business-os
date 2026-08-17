// @ts-nocheck
import { supabase } from './supabase';
import { isAbortError } from './abortErrors';

interface ActivityLogParams {
  actionType: string;
  actionCategory?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  actorName?: string;
  verb?: string;
  description?: string;
  metadata?: Record<string, any>;
}

class ActivityLogger {
  private sessionId: string;
  private userId: string | null = null;
  private userEmail: string | null = null;
  private userName: string | null = null;
  private canWriteLogs = false;
  private companyCode: string | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Synchronize user state from the application context.
   * This avoids the logger making its own database calls which can cause auth loops.
   */
  syncUser(userId: string | null, email: string | null, name: string | null, canWrite = true, companyCode?: string | null) {
    this.userId = userId;
    this.userEmail = email;
    this.userName = name;
    this.canWriteLogs = canWrite;
    this.companyCode = companyCode ?? null;
    
    console.debug('ActivityLogger: Synced user state', { userId, canWrite });
  }

  private getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'desktop';
    let platform = 'unknown';

    if (/mobile/i.test(ua)) deviceType = 'mobile';
    else if (/tablet/i.test(ua)) deviceType = 'tablet';

    if (/windows/i.test(ua)) platform = 'Windows';
    else if (/mac/i.test(ua)) platform = 'macOS';
    else if (/linux/i.test(ua)) platform = 'Linux';
    else if (/android/i.test(ua)) platform = 'Android';
    else if (/ios|iphone|ipad/i.test(ua)) platform = 'iOS';

    return { deviceType, platform, userAgent: ua };
  }

  private getActorName(override?: string) {
    return override || this.userName || 'User';
  }

  private getModuleFromPath(pathname: string) {
    const path = pathname.toLowerCase();
    if (path.includes('/admin/')) return 'admin';
    if (path.includes('/app/hr/')) return 'hr';
    if (path.includes('/app/finance/')) return 'finance';
    if (path.includes('/app/security/')) return 'security';
    if (path.includes('/app/real-estate/')) return 'real_estate';
    if (path.includes('/app/rock-of-ages/')) return 'rock_of_ages_cms';
    if (path.includes('/app/')) return 'app';
    return 'public';
  }

  private buildResourceLabel(resourceType?: string, resourceName?: string, resourceId?: string) {
    const parts = [resourceName, resourceType, resourceId ? `(${resourceId})` : null].filter(Boolean);
    return parts.join(' ');
  }

  private buildDescription(params: ActivityLogParams) {
    if (params.description) return params.description;

    const actor = this.getActorName(params.actorName);
    const resourceLabel = this.buildResourceLabel(params.resourceType, params.resourceName, params.resourceId);

    if (params.actionType === 'page_view') {
      const page = params.resourceName || params.metadata?.page || 'page';
      return `${actor} viewed ${page}`;
    }

    if (params.actionType === 'click') {
      const element = params.resourceName || params.metadata?.element || 'item';
      const type = params.metadata?.type ? ` (${params.metadata.type})` : '';
      return `${actor} clicked ${element}${type}`;
    }

    if (params.actionType === 'form_submit') {
      const form = params.resourceName || params.metadata?.form || 'form';
      const outcome = typeof params.metadata?.success === 'boolean' ? (params.metadata.success ? ' successfully' : ' with errors') : '';
      return `${actor} submitted ${form}${outcome}`;
    }

    if (params.actionType === 'search') {
      return `${actor} searched for ${params.metadata?.query ? `"${params.metadata.query}"` : 'a term'}`;
    }

    if (params.actionType === 'login' || params.actionType === 'logout' || params.actionType === 'sign_in' || params.actionType === 'sign_out') {
      return `${actor} ${params.verb || params.actionType.replace('_', ' ')}`;
    }

    if (params.actionType === 'create' || params.actionType === 'update' || params.actionType === 'delete' || params.actionType === 'approve' || params.actionType === 'reject') {
      const verb = params.actionType === 'delete' ? 'deleted' : params.actionType === 'create' ? 'created' : params.actionType === 'update' ? 'updated' : params.actionType;
      return `${actor} ${params.verb || verb}${resourceLabel ? ` ${resourceLabel}` : ''}`;
    }

    return `${actor} ${params.verb || params.actionType}${resourceLabel ? ` ${resourceLabel}` : ''}`.trim();
  }

  private logBuffer: any[] = [];
  private flushTimer: any = null;

  async log(params: ActivityLogParams) {
    // Basic safety: only log if we have a user identity
    if (!this.userId) return;

    const deviceInfo = this.getDeviceInfo();
    const logEntry = {
      user_id: this.userId,
      user_email: this.userEmail,
      user_name: this.userName,
      action_type: params.actionType,
      action_category: params.actionCategory || 'general',
      module: this.getModuleFromPath(window.location.pathname),
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      description: this.buildDescription(params),
      metadata: params.metadata || {},
      user_agent: deviceInfo.userAgent,
      device_type: deviceInfo.deviceType,
      platform: deviceInfo.platform,
      page_url: window.location.href,
      referrer_url: document.referrer,
      session_id: this.sessionId,
      company_code: this.companyCode,
      created_at: new Date().toISOString()
    };

    this.logBuffer.push(logEntry);

    if (this.logBuffer.length >= 10) {
      this.flushLogs();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushLogs(), 5000);
    }
  }

  private async flushLogs() {
    if (this.logBuffer.length === 0) return;
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const { error } = await supabase.from('activity_logs').insert(logsToSend);
      if (error && !isAbortError(error)) {
        if (error.code === 'PGRST204' || /module|company_code/i.test(String(error.message || ''))) {
          // Strip any columns the schema cache doesn't know about yet (pending migrations)
          const missingModule = /module/i.test(String(error.message || ''));
          const missingCompanyCode = /company_code/i.test(String(error.message || ''));
          const fallbackLogs = logsToSend.map((entry) => {
            const log = { ...entry };
            if (missingModule || error.code === 'PGRST204') delete (log as any).module;
            if (missingCompanyCode || error.code === 'PGRST204') delete (log as any).company_code;
            return log;
          });
          const retry = await supabase.from('activity_logs').insert(fallbackLogs);
          if (!retry.error) {
            console.debug('Activity logger retried without unrecognised columns and succeeded.');
            return;
          }
          if (retry.error && !isAbortError(retry.error)) {
            if (retry.error.code === '42501') {
              console.debug('Activity logger skipped due to auth/RLS state.');
              return;
            }
            console.warn('Activity batch log error after module fallback:', retry.error);
            return;
          }
        }
        // If we get an RLS error, it's expected if the database policy hasn't been updated yet.
        if (error.code === '42501') {
          console.debug('Activity logger skipped due to auth/RLS state.');
          return;
        }
        console.warn('Activity batch log error:', error);
      }
    } catch (error: any) {
      if (!isAbortError(error)) {
        if (error?.code === '42501' || /401|unauthorized/i.test(String(error?.message ?? ''))) {
          console.debug('Activity logger skipped due to auth/RLS state.');
          return;
        }
        console.warn('Failed to flush activity logs:', error);
      }
    }
  }

  // Convenience methods for common actions
  async logPageView(pageName: string) {
    await this.log({
      actionType: 'page_view',
      actionCategory: 'navigation',
      resourceName: pageName,
      metadata: { page: pageName }
    });
  }

  async logClick(elementName: string, elementType?: string) {
    await this.log({
      actionType: 'click',
      actionCategory: 'interaction',
      resourceName: elementName,
      metadata: { element: elementName, type: elementType }
    });
  }

  async logFormSubmit(formName: string, success: boolean) {
    await this.log({
      actionType: 'form_submit',
      actionCategory: 'form',
      resourceName: formName,
      metadata: { form: formName, success }
    });
  }

  async logSearch(query: string, results?: number) {
    await this.log({
      actionType: 'search',
      actionCategory: 'interaction',
      metadata: { query, results }
    });
  }

  async logDataAction(action: string, resourceType: string, resourceId?: string, resourceName?: string) {
    await this.log({
      actionType: action,
      actionCategory: 'data',
      resourceType,
      resourceId,
      resourceName,
      verb: action === 'delete' ? 'deleted' : action === 'create' ? 'created' : action === 'update' ? 'updated' : action,
      metadata: { resourceType, resourceId, resourceName, action }
    });
  }

  async logAuth(action: string) {
    await this.log({
      actionType: action,
      actionCategory: 'auth',
      verb: action
    });
  }

  async logError(error: string, context?: string) {
    await this.log({
      actionType: 'error',
      actionCategory: 'system',
      description: error,
      metadata: { context }
    });
  }
}

declare global {
  interface Window {
    __hakikaActivityLogger?: ActivityLogger;
  }
}

export const activityLogger =
  typeof window !== 'undefined' && window.__hakikaActivityLogger
    ? window.__hakikaActivityLogger
    : (() => {
        const logger = new ActivityLogger();
        if (typeof window !== 'undefined') {
          window.__hakikaActivityLogger = logger;
        }
        return logger;
      })();
