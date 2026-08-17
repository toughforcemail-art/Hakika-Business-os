// @ts-nocheck
export type AuditSeverity = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type AuditCategory = "SECURITY" | "ACCESS" | "DATA" | "BILLING" | "WORKSPACE" | "APPLICATION" | "SYSTEM";
export type AuditSource = "PLATFORM" | "APPLICATION" | "API" | "SYSTEM";
export type AuditAction = "Create" | "Update" | "Delete" | "View" | "Export" | "Import" | "Approve" | "Reject" | "Assign" | "Login" | "Logout" | "Failed Login" | "Password Reset" | "Subscription Activated" | "Workspace Activated" | "Role Assigned" | "Permission Changed" | "Payment Received" | "Payment Failed" | "Application Installed" | "Application Removed" | "Organization Created" | "Company Created" | "User Invited" | "Employee Created" | "Employee Updated" | "Employee Deleted" | "Property Created" | "Lease Created" | "Invoice Created" | "Receipt Generated" | "Shift Assigned" | "Incident Reported" | "System Error";
export interface AuditActor { id?: string; type: "USER" | "SERVICE" | "SYSTEM"; name?: string; }
export interface AuditTarget { type: string; id?: string; name?: string; }
export interface AuditMetadata { timestamp: string; actor?: AuditActor; organizationId?: string; companyId?: string; applicationId?: string; module?: string; page?: string; route?: string; recordId?: string; ipAddress?: string; device?: string; browser?: string; os?: string; country?: string; requestId?: string; correlationId?: string; durationMs?: number; success?: boolean; failureReason?: string; [key: string]: unknown; }
export interface AuditContext { requestId?: string; correlationId: string; source: AuditSource; }
export interface AuditResult { success: boolean; failureReason?: string; }
export interface AuditEvent { id: string; action: AuditAction; severity: AuditSeverity; category: AuditCategory; source: AuditSource; actor: AuditActor; target?: AuditTarget; metadata: AuditMetadata; context: AuditContext; result: AuditResult; }
export interface AuditLogger { log(event: AuditEvent): void; }
export interface AuditEventFactory { create(input: Omit<AuditEvent, "id">): AuditEvent; }
export interface AuditService extends AuditLogger { query(filter: Record<string, unknown>): readonly AuditEvent[]; }

export interface TimeSeries { label: string; points: Array<{ timestamp: string; value: number }>; }
export interface DashboardMetric { key: string; label: string; value: number | string; change?: number; }
export interface Report { id: string; name: string; generatedAt?: string; }
export interface ExportableReport extends Report { format: "CSV" | "PDF" | "XLSX"; }
export interface PlatformAnalytics { metrics: DashboardMetric[]; timeSeries: TimeSeries[]; }
export interface OrganizationAnalytics extends PlatformAnalytics { organizationId: string; }
export interface ApplicationAnalytics extends PlatformAnalytics { applicationId: string; }
export interface DashboardMetrics { cards: DashboardMetric[]; series: TimeSeries[]; }
export interface KPICard { key: string; label: string; value: number | string; }

export interface Permission { id: string; key: string; name: string; scope: PermissionScope; }
export interface PermissionGroup { id: string; name: string; permissions: Permission[]; }
export interface PermissionCategory { key: string; name: string; }
export type PermissionScope = "PLATFORM" | "ORGANIZATION" | "COMPANY" | "APPLICATION" | "MODULE" | "RECORD";
export interface CRUDPermissions { create: boolean; read: boolean; update: boolean; delete: boolean; }
export interface ApprovalPermissions { approve: boolean; reject: boolean; }
export interface ExportPermissions { export: boolean; import: boolean; }
export interface AdministrationPermissions { manageUsers: boolean; manageRoles: boolean; manageSettings: boolean; }
export interface PlatformRole { id: string; name: string; }
export interface OrganizationRole extends PlatformRole { organizationId: string; }
export interface SystemRole extends PlatformRole { system: true; }
export interface DefaultRole extends PlatformRole { default: true; }
export interface CustomRole extends PlatformRole { permissions: Permission[]; }
export interface RoleTemplate { id: string; name: string; permissions: string[]; }

export interface PageDefinition { id: string; route: string; applicationId: string; module?: string; }
export interface NavigationPermission { pageId: string; permission: string; }
export interface MenuVisibility { menuId: string; visible: boolean; }
export interface SidebarVisibility { applicationId: string; visible: boolean; }
export interface RouteProtection { route: string; permissions: string[]; roles?: string[]; }
export interface HiddenPage extends PageDefinition { hidden: true; }
export interface PermissionResolver { hasPermission(permission: string): boolean; hasRole(role: string): boolean; canAccessApplication(id: string): boolean; canAccessModule(id: string): boolean; canAccessPage(id: string): boolean; canCreate(resource: string): boolean; canEdit(resource: string): boolean; canDelete(resource: string): boolean; canApprove(resource: string): boolean; canExport(resource: string): boolean; }

export type SecurityEventType = "Failed Login" | "Account Locked" | "Password Changed" | "Role Escalation" | "Permission Change" | "Session Revoked" | "New Device" | "Suspicious Activity";
export interface SecurityEvent { id: string; type: SecurityEventType; userId?: string; timestamp: string; metadata?: Record<string, unknown>; }
export interface ActiveSession { id: string; userId: string; lastSeenAt: string; }
export interface LoginSession extends ActiveSession { loginAt: string; logoutAt?: string; }
export interface DeviceSession extends ActiveSession { deviceId: string; deviceName?: string; }
export interface SessionHistory { sessions: ActiveSession[]; }
export interface GlobalFeed { entries: AuditEvent[]; }
export interface OrganizationFeed extends GlobalFeed { organizationId: string; }
export interface ApplicationFeed extends GlobalFeed { applicationId: string; }
export interface UserFeed extends GlobalFeed { userId: string; }
