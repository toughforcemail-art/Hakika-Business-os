// @ts-nocheck
export const platformOrganizations = ['ABC Holdings', 'Hakika Demo Ltd', 'Rock Properties'];
export const platformApplications = ['HR', 'Finance', 'Real Estate', 'ToughForce', 'Church (Preview)', 'Contact Centre (Preview)'];
export const platformJobs = ['Provision Workspace', 'Activate Subscription', 'Upgrade Workspace', 'Suspend Workspace', 'Restore Workspace'];
export const platformNotifications = ['Queued', 'Delivered', 'Retrying', 'Failed'];
export const platformAudit = ['Created Employee', 'Generated Invoice', 'Assigned Guard', 'Created Property', 'Created Tenant', 'Payment Received'];
export const platformRoles = ['Organization Owner', 'HR Manager', 'Finance Officer', 'Security Supervisor', 'Viewer'];
export const platformPermissions = ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage Users', 'Manage Billing'];
export const platformStats = [
  { label: 'Organizations', value: '128', change: '+12%' }, { label: 'Users', value: '2,481', change: '+8%' },
  { label: 'Applications', value: '5', change: '2 preview' }, { label: 'Notifications', value: '3,902', change: '+18%' },
  { label: 'Workspace Jobs', value: '47', change: '4 pending' },
];
export const platformNav = [
  ['Dashboard', 'Platform Dashboard'], ['organizations', 'Organizations'], ['applications', 'Applications'],
  ['jobs', 'Workspace Jobs'], ['notifications', 'Notifications'], ['audit', 'Audit Logs'], ['analytics', 'Analytics'],
  ['roles', 'Roles'], ['permissions', 'Permissions'], ['sessions', 'Sessions'], ['security', 'Security Center'],
  ['activity', 'Activity Feed'], ['subscriptions', 'Subscriptions'], ['billing', 'Billing'], ['plans', 'Plans'],
  ['usage', 'Usage'], ['flags', 'Feature Flags'], ['health', 'System Health'], ['executive', 'Executive Overview'],
] as const;
export const platformSubscriptions = ['Active subscriptions · 386', 'Trials · 24', 'Expiring this month · 8', 'Suspended · 3'];
export const platformBilling = ['Monthly recurring revenue · KSh 4.8M', 'Payments received · KSh 5.2M', 'Failed payments · 7', 'Outstanding invoices · 18'];
export const platformUsage = ['Real Estate · 45%', 'HR · 30%', 'Finance · 20%', 'ToughForce · 5%'];
