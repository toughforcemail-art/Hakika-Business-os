// @ts-nocheck
import {
  LayoutDashboard,
  Smartphone,
  BookOpen,
  Settings,
  Shield,
  Bell,
  Lock,
  FileText,
  Users,
  User,
  Home,
  Receipt,
  AlertCircle,
  UserPlus,
  Briefcase,
  DollarSign,
  Library,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit,
  FileCheck,
  Globe,
  LogOut,
  MapPin,
  Map,
  Camera,
  Truck,
  Building,
  CreditCard,
  Key,
  AlertTriangle,
  Database,
  Gavel,
  ClipboardList,
  Palette,
  Activity,
  Award,
  Landmark,
  TrendingUp,
  ShieldCheck,
  ShieldOff,
  MessageSquare,
  Mail,
  Zap,
  BarChart2,
  Plus,
  Droplets,
  Wrench,
  UserCog,
  LayoutGrid,
  FileSpreadsheet,
  Wallet,
  ArrowRightLeft,
  CalendarCheck,
  CalendarDays,
  History,
  FileBarChart,
  UserCheck,
  CalendarPlus,
  Eye,
  Trash2,
  Archive,
  Package,
  Banknote,
  Users as UserManagement,
  Link2,
  Video,
  Radio,
  Wifi,
  MonitorPlay,
} from 'lucide-react';
import { ModuleConfig, SidebarSection } from './types';

const UNIVERSAL_MENU: SidebarSection = {
  title: "MY ACCOUNT",
  items: []
};

const ADMIN_ACCESS_MENU: SidebarSection = {
  title: "ADMINISTRATION",
  roles: ['Super Admin', 'Director', 'Director / Super Admin', 'Administrator', 'HR Manager'],
  items: [
    { id: 'adm-link-total-emp', label: 'Total Employees', icon: Users, path: '/app/hr/total-employees' },
    { id: 'adm-service-billing', label: 'Service Billing', icon: CreditCard, path: '/admin/service-billing' },
  ]
};

const RE_ADMIN_ACCESS_MENU: SidebarSection = {
  title: "ADMINISTRATION",
  roles: ['Super Admin', 'Director', 'Director / Super Admin', 'Administrator', 'Property Manager'],
  items: []
};

const SECURITY_ADMIN_ACCESS_MENU: SidebarSection = {
  title: "ADMINISTRATION",
  roles: ['Super Admin', 'Director', 'Director / Super Admin', 'Administrator', 'Security Manager'],
  items: [
    { id: 'sec-link-total-guards', label: 'Workforce Hub', icon: Users, path: '/app/security/guards' },
  ]
};

const HR_MENU: SidebarSection[] = [
  UNIVERSAL_MENU,
  ADMIN_ACCESS_MENU,

  {
    title: "I. CORE",
    items: [
      { id: 'hr-dash', label: 'Dashboard', icon: LayoutDashboard, path: '/app/hr/dashboard' },
      { id: 'hr-emp-dir', label: 'Employee Directory', icon: Users, path: '/app/hr/employee-directory' },
      { id: 'hr-salary-adv', label: 'Salary Advances', icon: Wallet, path: '/app/hr/payroll/loans-advances', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
      { id: 'hr-salary-adv-app', label: 'Salary Advance Approvals', icon: CheckCircle2, path: '/app/hr/payroll/loans-advances/approvals', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
    ]
  },

  {
    title: "II. WORKSPACES",
    items: [
      { 
        id: 'ws-data', 
        label: 'Data Workspace', 
        icon: Database, 
        children: [
            { id: 'emp-2', label: 'Add Employee', path: '/app/hr/add-employee' },
            { id: 'emp-total-ws', label: 'Total Employees', path: '/app/hr/total-employees' },
            { id: 'emp-past-ws', label: 'Past Employees', path: '/app/hr/past-employees', roles: ['Super Admin', 'Director', 'HR Manager', 'Administrator'] },
            { id: 'dept-1', label: 'Departments', path: '/app/hr/departments' },
            { id: 'role-1', label: 'Roles & Designations', path: '/app/hr/designations' },
            { id: 'mod-1', label: 'Modules', path: '/app/hr/modules' },
            { id: 'comp-1', label: 'Companies', path: '/app/hr/companies' },
        ] 
      },
      { 
        id: 'ws-time', 
        label: 'Time Workspace', 
        icon: Clock, 
        children: [
            { id: 'att-1', label: 'Biometric Logs', path: '/app/hr/biometric-logs' },
            { id: 'att-2', label: 'Site Deployment', path: '/app/hr/site-deployment' },
            { id: 'att-3', label: 'Overtime Records', path: '/app/hr/overtime-records' },
        ] 
      },
      { 
        id: 'ws-expenses', 
        label: 'Expenses Workspace', 
        icon: Receipt, 
        children: [
            { id: 'exp-reports', label: 'Expense Reports', path: '/app/hr/expense-reports' },
        ] 
      },
      { 
        id: 'ws-assets', 
        label: 'Assets Workspace', 
        icon: Package, 
        children: [
            { id: 'ast-add', label: 'Add Asset', path: '/app/hr/add-asset' },
            { id: 'ast-1', label: 'Asset Assignment', path: '/app/hr/asset-assignment' },
            { id: 'ast-2', label: 'Asset Tracking', path: '/app/hr/asset-tracking' },
        ] 
      },
      { 
        id: 'ws-payroll', 
        label: 'Payroll Workspace', 
        icon: DollarSign, 
        children: [
            { id: 'pay-process', label: 'Payroll Overview', path: '/app/hr/payroll/process', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
            { id: 'pay-roll', label: 'Payroll', path: '/app/hr/payroll/payroll', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
            { id: 'pay-slips', label: 'Payslips', path: '/app/hr/payroll/payslips' },
            { id: 'pay-p9a', label: 'P9A Form', path: '/app/hr/payroll/p9a', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
            { id: 'pay-loans', label: 'Salary Advances', path: '/app/hr/payroll/loans-advances' },
            { id: 'pay-loans-app', label: 'Salary Advance Approvals', path: '/app/hr/payroll/loans-advances/approvals', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
            { id: 'pay-statutory', label: 'Statutory Reports', path: '/app/hr/statutory-returns', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
            { id: 'pay-test', label: 'Deductions Calculator', path: '/app/hr/payroll/deductions-test', roles: ['Super Admin', 'Director', 'HR Manager', 'Accountant', 'Director / Super Admin', 'Administrator'] },
        ] 
      },
      { 
        id: 'ws-leave', 
        label: 'Leave Workspace', 
        icon: Calendar, 
        children: [
            { id: 'lv-apply', label: 'Apply for Leave', path: '/app/hr/apply-for-leave' },
            { id: 'lv-requests', label: 'My Leave Requests', path: '/app/hr/my-leave-requests' },
            { id: 'lv-approvals', label: 'Leave Approvals', path: '/app/hr/leave-approvals', roles: ['Super Admin', 'Director', 'HR Manager', 'Director / Super Admin', 'Administrator'] },
            { id: 'lv-types', label: 'Leave Types', path: '/app/hr/leave-types', roles: ['Super Admin', 'Director', 'HR Manager', 'Director / Super Admin', 'Administrator'] },
            { id: 'lv-sick', label: 'Sick Leave Requests', path: '/app/hr/sick-leave-requests' },
        ] 
      },
      { 
        id: 'ws-recruitment', 
        label: 'Recruitment (ATS)', 
        icon: UserPlus, 
        path: '/app/hr/recruitment',
        roles: ['Super Admin', 'Director', 'HR Manager', 'Director / Super Admin', 'Administrator']
      },
    ]
  },

  {
    title: "III. MANAGEMENT",
    items: [
      { 
        id: 'disc-cases', 
        label: 'Disciplinary Cases', 
        icon: AlertTriangle, 
        path: '/app/hr/disciplinary-cases',
        roles: ['Super Admin', 'Director', 'HR Manager', 'Director / Super Admin', 'Administrator']
      },
      { 
        id: 'doc-expiry', 
        label: 'Document Expiry', 
        icon: Clock, 
        path: '/app/hr/document-expiry',
        roles: ['Super Admin', 'Director', 'HR Manager', 'Director / Super Admin', 'Administrator']
      },
    ]
  },

  {
    title: "IV. REPORTS",
    items: [
    ]
  },

  {
    title: "V. NOTES & FINDINGS",
    items: [
      { 
        id: 'hr-notes', 
        label: 'Notes & Findings', 
        icon: MessageSquare, 
        path: '/app/notes'
      },
      { 
        id: 'hr-complaints', 
        label: 'Complaints', 
        icon: AlertTriangle, 
        path: '/app/complaints'
      },
    ]
  },
  {
    title: "VI. AUDIT",
    roles: ['Super Admin', 'Director', 'Director / Super Admin', 'Company Super Admin'],
    items: [
      { id: 'hr-activity-log', label: 'Activity Log', icon: Activity, path: '/admin/activity-log' },
    ]
  }
];

const SECURITY_MENU: SidebarSection[] = [
  UNIVERSAL_MENU,
  SECURITY_ADMIN_ACCESS_MENU,
  {
    title: "I. COMMAND BRANCH",
    roles: ['Super Admin', 'Director', 'Administrator', 'Security Manager', 'Security Supervisor', 'Director / Super Admin'],
    items: [
      { id: 'sec-1', label: 'Tactical Console', icon: Shield, path: '/app/security/tactical' },
      { id: 'sec-ob', label: 'Incident Reporting (OB)', icon: AlertCircle, path: '/app/security/incidents', children: [
          { id: 'ob-reports', label: 'Daily Occurrence Book', path: '/app/security/incidents' },
          { id: 'ob-types', label: 'Incident Types', path: '/app/security/incident-types' },
          { id: 'ob-intel', label: 'Incident Intelligence', path: '/app/security/incident-analytics' },
          { id: 'ob-recommendations', label: 'Recommendations Registry', path: '/app/security/recommendations' },
      ]},
      { id: 'sec-2', label: 'Roster Management', icon: Users, path: '/app/security/roster', children: [
          { id: 'roster-1', label: 'Work Roster', path: '/app/security/roster' },
          { id: 'roster-2', label: 'Workforce Hub', path: '/app/security/guards' },
          { id: 'roster-2b', label: 'Work Roster Calendar', icon: CalendarDays, path: '/app/security/roster/calendar' },
          { id: 'roster-2c', label: 'Attendance Master', icon: Clock, path: '/app/security/attendance' },
          { id: 'roster-3', label: 'Activity Log', path: '/app/security/activity' },
          { id: 'roster-3b', label: 'Past Guards', icon: ShieldOff, path: '/app/security/past-guards' },
          { id: 'roster-4', label: 'Resources', path: '/app/security/resources' },
          { id: 'roster-5', label: 'Client Portals', path: '/app/security/clients' },
      ]},
      { id: 'sec-comp', label: 'Compliance Hub', icon: FileCheck, path: '/app/security/compliance' },
      { id: 'sec-notes', label: 'Notes & Findings', icon: MessageSquare, path: '/app/notes' },
    ]
  },
  {
    title: "II. CCTV & SURVEILLANCE",
    roles: ['Super Admin', 'Director', 'Administrator', 'Security Manager', 'Security Supervisor', 'Director / Super Admin'],
    items: [
      { id: 'cctv-1', label: 'Surveillance Command', icon: MonitorPlay, path: '/app/security/cctv' },
      { id: 'cctv-wall', label: 'Live Wall', icon: Video, path: '/app/security/cctv/wall' },
      { id: 'cctv-2', label: 'Live Coverage', icon: Radio, path: '/app/security/cctv/live' },
      { id: 'cctv-3', label: 'Camera & NVR Devices', icon: Camera, path: '/app/security/cctv/devices' },
      { id: 'cctv-4', label: 'SmartPSS Connections', icon: Wifi, path: '/app/security/cctv/connections' },
    ]
  },
  { title: "III. FIELD OPS", items: [
      { id: 'sec-3', label: 'Patrol Chip Map', icon: Map, path: '/app/security/patrols' }, 
      { id: 'sec-assets-ws', label: 'Asset Management', icon: Package, children: [
          { id: 'sec-assets-reg', label: 'Register New Asset', path: '/app/security/assets' },
          { id: 'sec-assets-issue', label: 'Issue Asset', path: '/app/security/assets/issue' },
          { id: 'sec-assets-dispose', label: 'Dispose Asset', path: '/app/security/assets/dispose' },
          { id: 'sec-assets-transfer', label: 'Transfer Asset', path: '/app/security/assets/transfer' },
          { id: 'sec-assets-repair', label: 'Repair / Service Request', path: '/app/security/assets/repair' },
          { id: 'sec-assets-inv', label: 'Inventory List', path: '/app/security/assets' },
      ]},
      { id: 'sec-catalog', label: 'Asset Catalog', icon: Library, path: '/app/security/asset-catalog' }
    ] },
  { title: "IV. PERSONNEL", items: [{ id: 'sec-6', label: 'Guard Database', icon: Users, path: '/app/security/guards' }] },
  { title: "V. ADMIN CONTROL", roles: ['Super Admin', 'Director', 'Administrator', 'Director / Super Admin'], items: [
      { id: 'sec-admin-1', label: 'Sites & Branches', icon: MapPin, path: '/app/security/sites' }, 
      { id: 'sec-admin-billing', label: 'Revenue & Billing', icon: DollarSign, path: '/app/security/billing' },
      { id: 'sec-activity-log', label: 'Activity Log', icon: Activity, path: '/admin/activity-log', roles: ['Super Admin', 'Director', 'Director / Super Admin', 'Company Super Admin'] },
    ] }
];

const REAL_ESTATE_MENU: SidebarSection[] = [
  UNIVERSAL_MENU, RE_ADMIN_ACCESS_MENU,
  { title: "I. OVERVIEW", items: [
      { id: 're-dash', label: 'Dashboard', icon: LayoutDashboard, path: '/app/real-estate/dashboard' },
      { id: 're-props', label: 'Properties', icon: Building, path: '/app/real-estate/properties' }, 
      { id: 're-houses', label: 'Houses / Units', icon: Home, path: '/app/real-estate/houses' }, 
      { id: 're-units', label: 'Units', icon: Home, path: '/app/real-estate/units' }, 
      { id: 're-insp', label: 'Inspections', icon: ClipboardList, path: '/app/real-estate/inspections' },
      { id: 're-ledger', label: 'Global Ledger', icon: BookOpen, path: '/app/real-estate/ledger' },
       { id: 're-notes', label: 'Notes & Findings', icon: MessageSquare, path: '/app/real-estate/notes' }
  ] },
  { title: "II. TENANTS", items: [{ id: 're-tenants', label: 'Tenant Management', icon: Users, path: '/app/real-estate/tenants' }, { id: 're-tenants-archive', label: 'Tenant Archive', icon: Archive, path: '/app/real-estate/deleted/tenants' }, { id: 're-comm-vac', label: 'Vacating Notices', icon: LogOut, path: '/app/real-estate/communication/vacating-notices' }, { id: 're-leases', label: 'Digital Leases', icon: FileText, path: '/app/real-estate/leases', roles: ['Super Admin', 'Director', 'Administrator', 'Director / Super Admin'] }, { id: 're-maint', label: 'Maintenance', icon: Wrench, path: '/app/real-estate/maintenance' }] },
  { title: "III. INVOICE & BILLING", roles: ['Super Admin', 'Director', 'Administrator', 'Property Manager', 'Accountant', 'Director / Super Admin'], items: [{ id: 're-inv-types', label: 'Add Invoice Type', icon: Receipt, path: '/app/real-estate/invoice/types' }, { id: 're-inv-add', label: 'Create Invoice', icon: Receipt, path: '/app/real-estate/invoice/add-item' }, { id: 're-inv-deleted', label: 'Deleted Invoices', icon: Trash2, path: '/app/real-estate/invoice/deleted' }, { id: 're-inv', label: 'Invoice', icon: Receipt, children: [{ id: 're-inv-main', label: 'Overview', path: '/app/real-estate/invoice' }, { id: 're-inv-list', label: 'Invoice List', path: '/app/real-estate/invoice/list' }, { id: 're-inv-auto', label: 'Auto Billing', path: '/app/real-estate/invoice/auto-billing' }, { id: 're-inv-add-child', label: 'Create Invoice', path: '/app/real-estate/invoice/add-item' }, { id: 're-inv-arr', label: 'Arrears', path: '/app/real-estate/invoice/arrears' }, { id: 're-inv-pen', label: 'Penalties', path: '/app/real-estate/invoice/penalties' }, { id: 're-inv-kra', label: 'KRA / eTims', path: '/app/real-estate/invoice/kra' }, { id: 're-inv-recon', label: 'Smart Reconciliation', path: '/app/real-estate/reconciliation', roles: ['Super Admin', 'Director', 'Administrator', 'Director / Super Admin'] }, { id: 're-inv-payments', label: 'Payment Tracker', path: '/app/real-estate/payments/mpesa' }] }, { id: 're-reconcile', label: 'Smart Reconciliation', icon: TrendingUp, path: '/app/real-estate/reconciliation', roles: ['Super Admin', 'Director', 'Administrator', 'Director / Super Admin'] }] },
  { title: "III-A. SPLIT MANAGEMENT", roles: ['Super Admin', 'Director', 'Administrator', 'Property Manager', 'Accountant', 'Director / Super Admin'], items: [
    { id: 'hakika-split-management', label: 'Split Management', icon: Banknote, path: '/app/real-estate/split-management' },
    { id: 'hakika-split-audit', label: 'Split Audit', icon: Activity, path: '/app/real-estate/split-management/split-audit' },
    { id: 'hakika-split-queue', label: 'Split Queue', icon: ArrowRightLeft, path: '/app/real-estate/split-management/queue' },
    { id: 'hakika-payout-bank', label: 'Bank Join', icon: Landmark, path: '/app/real-estate/split-management/bank-join' },
  ] },
  { title: "IV. UTILITIES", roles: ['Super Admin', 'Director', 'Administrator', 'Property Manager', 'Director / Super Admin'], items: [{ id: 're-bill-water', label: 'Bill Water', icon: Droplets, children: [{ id: 're-bw-add', label: 'Add Bill', path: '/app/real-estate/bill-water/add-bill' }, { id: 're-bw-sum', label: 'Billing Summary', path: '/app/real-estate/bill-water/billing-summary' }] }, { id: 're-bill-power', label: 'Bill Power', icon: Zap, children: [{ id: 're-bp-meter', label: 'Meter Readings', path: '/app/real-estate/bill-power/meter-recordings' }, { id: 're-bp-post', label: 'PostPaid Meters', path: '/app/real-estate/bill-power/postpaid-meters' }, { id: 're-bp-conf', label: 'Configure Houses', path: '/app/real-estate/bill-power/configure-houses' }] }] },
  { title: "V. REPORTS", roles: ['Super Admin', 'Director', 'Administrator', 'Accountant', 'Property Manager', 'Director / Super Admin'], items: [{ id: 're-rep', label: 'Reports', icon: BarChart2, children: [{ id: 're-rep-rent', label: 'Statement of Rent', path: '/app/real-estate/reports/statement-of-rent' }, { id: 're-rep-ledger', label: 'Tenant Ledger', path: '/app/real-estate/reports/tenant-ledger' }, { id: 're-rep-ref', label: 'Payment Reference', path: '/app/real-estate/reports/payment-reference' }, { id: 're-rep-water', label: 'Water Consumption', path: '/app/real-estate/reports/water-consumption' }, { id: 're-rep-arr', label: 'Arrears Report', path: '/app/real-estate/reports/arrears' }, { id: 're-rep-exp', label: 'Expense Report', path: '/app/real-estate/reports/expenses' }] }, { id: 're-yield', label: 'Financial Yield', icon: DollarSign, path: '/app/real-estate/yield', roles: ['Super Admin', 'Director', 'Administrator', 'Director / Super Admin'] }] },
  { title: "VI. MANAGEMENT", roles: ['Super Admin', 'Director', 'Administrator', 'Property Manager', 'Director / Super Admin'], items: [{ id: 're-comm', label: 'Communication', icon: Mail, children: [{ id: 're-comm-maint', label: 'Maintenance', path: '/app/real-estate/communication/maintenance' }, { id: 're-comm-lease', label: 'Lease Documents', path: '/app/real-estate/communication/lease-documents' }, { id: 're-comm-hub', label: 'Communications Hub', path: '/app/real-estate/communication/hub' }] }, { id: 're-mgmt', label: 'Personnel', icon: UserCog, children: [{ id: 're-mgmt-care', label: 'Caretakers', path: '/app/real-estate/management/caretakers' }, { id: 're-mgmt-land', label: 'Landlords', path: '/app/real-estate/management/landlords' }, { id: 're-mgmt-del-props', label: 'Deleted Properties', path: '/app/real-estate/deleted/properties' }, { id: 're-mgmt-del-care', label: 'Deleted Caretakers', path: '/app/real-estate/deleted/caretakers' }, { id: 're-mgmt-del-land', label: 'Deleted Landlords', path: '/app/real-estate/deleted/landlords' }] }, { id: 're-marketing', label: 'Marketing Studio', icon: Palette, path: '/app/real-estate/marketing' }] },
  { title: "VII. ASSETS", items: [
    { id: 're-ast-mgmt', label: 'Asset Management', icon: Package, path: '/app/real-estate/assets' },
    { id: 're-ast-track', label: 'Asset Tracking', icon: BarChart2, path: '/app/real-estate/assets/tracking' },
    { id: 're-ast-add', label: 'Add Asset', icon: Plus, path: '/app/real-estate/assets/add' }
  ] },
  { title: "VIII. AUDIT", roles: ['Super Admin', 'Director', 'Director / Super Admin', 'Company Super Admin'], items: [{ id: 're-activity-log', label: 'Activity Log', icon: Activity, path: '/admin/activity-log' }] }
];

const ROCK_OF_AGES_MENU: SidebarSection[] = [
  UNIVERSAL_MENU,
  {
    title: "I. CORE",
    items: [
      { id: 'roa-dash', label: 'Dashboard', icon: LayoutDashboard, path: '/app/rock-of-ages/dashboard' },
      { id: 'roa-members', label: 'Members', icon: Users, path: '/app/rock-of-ages/members' },
    ],
  },
  {
    title: "II. FINANCE",
    items: [
      { id: 'roa-finance', label: 'Finance', icon: Landmark, path: '/app/rock-of-ages/finance' },
      { id: 'roa-budget', label: 'Budget', icon: Wallet, path: '/app/rock-of-ages/budget' },
      { id: 'roa-receipt', label: 'Receipt', icon: Receipt, path: '/app/rock-of-ages/receipt' },
      { id: 'roa-payment', label: 'Payment', icon: CreditCard, path: '/app/rock-of-ages/payment' },
      { id: 'roa-reqs', label: 'Requisitions', icon: ClipboardList, path: '/app/rock-of-ages/requisitions' },
    ],
  },
  {
    title: "III. OPERATIONS",
    items: [
      { id: 'roa-inventory', label: 'Inventory', icon: Package, path: '/app/rock-of-ages/inventory' },
      { id: 'roa-events', label: 'Events', icon: Calendar, path: '/app/rock-of-ages/events' },
      { id: 'roa-ministry', label: 'Ministry Programs', icon: Landmark, path: '/app/rock-of-ages/ministry-programs' },
      { id: 'roa-reports', label: 'Reports', icon: BarChart2, path: '/app/rock-of-ages/reports' },
    ],
  },
  {
    title: "IV. ASSETS",
    items: [
      { id: 'roa-ast-add', label: 'Add Asset', path: '/app/rock-of-ages/add-asset' },
    ],
  },
  {
    title: "V. MANAGEMENT",
    items: [
      { id: 'roa-user-mgmt', label: 'User Management', icon: UserManagement, path: '/app/rock-of-ages/user-management' },
      { id: 'roa-devotion', label: 'Daily Devotion', icon: BookOpen, path: '/app/rock-of-ages/daily-devotion' },
    ],
  },
  {
    title: "VI. ACCOUNT",
    items: [
      { id: 'roa-profile', label: 'Profile', icon: User, path: '/app/rock-of-ages/profile' },
      { id: 'roa-notes', label: 'Notes & Findings', icon: MessageSquare, path: '/app/notes' },
      { id: 'roa-complaints', label: 'Complaints', icon: AlertTriangle, path: '/app/complaints' },
      { id: 'roa-activity-log', label: 'Activity Log', icon: Activity, path: '/admin/activity-log', roles: ['Super Admin', 'Director', 'Director / Super Admin', 'Company Super Admin'] },
    ],
  },
];

const FINANCE_MENU: SidebarSection[] = [
  UNIVERSAL_MENU,
  { 
    title: "I. OVERSIGHT", 
    items: [
      { id: 'fin-dash', label: 'Finance Dashboard', icon: LayoutDashboard, path: '/app/finance/dashboard' },
      { id: 'fin-ledger', label: 'Global Ledger', icon: BookOpen, path: '/app/finance/ledger' },
      { id: 'fin-journal-entry', label: 'Journal Entry', icon: ClipboardList, path: '/app/finance/journal-entry' },
      { id: 'fin-bank-accounts', label: 'Bank Accounts', icon: Landmark, path: '/app/finance/bank-accounts' },
      { id: 'fin-wallets', label: 'Wallets', icon: Wallet, path: '/app/finance/wallets' },
      { id: 'fin-bank-connections', label: 'Bank Connections', icon: Link2, path: '/app/finance/bank-connections' },
      { id: 'fin-payment-options', label: 'Payment Options', icon: CreditCard, path: '/app/finance/payment-options' },
      { id: 'fin-notes', label: 'Notes & Findings', icon: MessageSquare, path: '/app/finance/notes' },
      { id: 'fin-statements', label: 'Statements', icon: FileSpreadsheet, path: '/app/finance/statements' },
    ] 
  },
  { 
    title: "II. TRANSACTIONS", 
    items: [
      { id: 'fin-inv', label: 'Customer Hub', icon: Receipt, path: '/app/finance/invoices' },
    ] 
  },
  { 
    title: "III. OPERATIONS", 
    items: [
      { 
        id: 'fin-masterdata', 
        label: 'Master Data', 
        icon: LayoutGrid, 
        children: [
          { id: 'fin-vendors', label: 'Vendors', path: '/app/finance/vendors' },
          { id: 'fin-cost-centres', label: 'Cost Centres', path: '/app/finance/cost-centres' },
          { id: 'fin-expense-groups', label: 'Expense Groups', path: '/app/finance/expense-groups' },
        ] 
      },
      { id: 'fin-exp', label: 'Expenses', icon: Wallet, children: [
          { id: 'fin-exp-requisitions', label: 'Requisitions', path: '/app/finance/expenses' },
          { id: 'fin-exp-payments', label: 'Payments', path: '/app/finance/payments' },
          { id: 'fin-exp-vouchers', label: 'Payment Vouchers', path: '/app/finance/payment-vouchers' },
          { id: 'fin-exp-approvals', label: 'Approvals', path: '/app/finance/requisition-approvals' },
          { id: 'fin-exp-deleted', label: 'Deleted', path: '/app/finance/deleted-requisitions' },
        ] },
      { id: 'fin-recon', label: 'Bank Reconciliation', icon: TrendingUp, path: '/app/finance/reconciliation' },
    ] 
  },
  { 
    title: "IV. REPORTS", 
    items: [
      { id: 'fin-reports-center', label: 'Finance Reports', icon: FileSpreadsheet, children: [
          { id: 'fin-reports-expenses', label: 'Expenses Report', path: '/app/finance/reports/expenses' },
          { id: 'fin-reports-receipts', label: 'Receipts Report', path: '/app/finance/reports/receipts' },
          { id: 'fin-reports-arrears', label: 'Arrears Report', path: '/app/finance/reports/arrears' },
        ] },
    ] 
  },
  { 
    title: "V. COMPLIANCE", 
    items: [
      { id: 'fin-tax', label: 'Tax & Returns', icon: Gavel, path: '/app/finance/tax' },
      { id: 'fin-audit', label: 'Audit Trail', icon: History, path: '/app/finance/audit' },
    ] 
  }
];

const ADMIN_MENU: SidebarSection[] = [
  UNIVERSAL_MENU,
  { title: "I. PLATFORM ADMIN", items: [
      { id: 'adm-platform-overview', label: 'Platform Overview', icon: LayoutDashboard, path: '/admin/overview' },
      { id: 'adm-service-overview', label: 'Service Overview', icon: BarChart2, path: '/admin/service-overview' },
      { id: 'adm-service-pricing', label: 'Service Pricing', icon: Wallet, path: '/admin/service-pricing' },
      { id: 'adm-visibility', label: 'Page Visibility', icon: Eye, path: '/admin/page-visibility' },
  ] },
  { title: "II. COMPANY SETUP", items: [
      { id: 'adm-companies', label: 'Companies', icon: Building, path: '/admin/companies' },
      { id: 'adm-service-subscriptions', label: 'Subscriptions', icon: Users, path: '/admin/service-subscriptions' },
      { id: 'adm-service-billing', label: 'Service Billing', icon: CreditCard, path: '/admin/service-billing' },
      { id: 'adm-contact-inbox', label: 'Contact Inbox', icon: Mail, path: '/admin/contact-inbox' },
      { id: 'adm-deleted-companies', label: 'Deleted Companies', icon: Trash2, path: '/admin/deleted-companies' },
      { id: 'adm-deleted-subscriptions', label: 'Deleted Subscriptions', icon: Trash2, path: '/admin/deleted-subscriptions' },
      { id: 'adm-roles', label: 'Role Management', icon: UserManagement, path: '/admin/roles' },
      { id: 'adm-entitlements', label: 'Dashboard Entitlements', icon: ShieldCheck, path: '/admin/dashboard-entitlements' },
      { id: 'adm-cred', label: 'Employee Credentials', icon: Key, path: '/admin/employee-credentials' }, 
      { id: 'adm-land-cred', label: 'Landlord Credentials', icon: Key, path: '/admin/landlord-credentials' }, 
      { id: 'adm-8', label: 'Admins', icon: ShieldCheck, path: '/admin/admins' }, 
      { id: 'adm-9', label: 'Directors', icon: Award, path: '/admin/directors' }
  ] },
  { title: "III. ACTIVATION / PAYMENT", items: [
      { id: 'adm-service-payments', label: 'Recent Payments', icon: CreditCard, path: '/admin/service-payments' },
      { id: 'adm-service-events', label: 'Recent Events', icon: Activity, path: '/admin/service-events' },
      { id: 'adm-service-rentals', label: 'Manage Rentals', icon: Package, path: '/admin/service-rentals' },
  ] },
  { title: "IV. AUDIT / HISTORY", items: [
      { id: 'adm-activity-log', label: 'Activity Log', icon: Activity, path: '/admin/logs' },
      { id: 'adm-comm-hist', label: 'Communication Registry', icon: Clock, path: '/admin/communication-history' },
      { id: 'adm-archives', label: 'Archives', icon: Database, path: '/admin/archives' },
      { id: 'adm-5', label: 'System Logs', icon: ClipboardList, path: '/admin/logs' },
  ] },
  { title: "V. TOOLS", items: [
      { id: 'adm-msg-test', label: 'Messaging Test Hub', icon: MessageSquare, path: '/admin/messaging-test' },
      { id: 'adm-mpesa-test', label: 'M-Pesa Test Console', icon: Wallet, path: '/admin/mpesa-test-console' },
      { id: 'adm-delete-logs', label: 'Delete Logs', icon: Trash2, path: '/admin/delete-logs' },
      { id: 'adm-debug', label: 'Supabase Debug', icon: Database, path: '/admin/debug' },
  ] },
  { title: "VI. RECOVERY", items: [
      { id: 'adm-restore', label: 'Backup & Restore', icon: Database, path: '/admin/restore' },
      { id: 'adm-permissions', label: 'Permissions', icon: Database, path: '/admin/permissions' },
      { id: 'adm-health', label: 'Migration Health', icon: Database, path: '/admin/migration-health' },
  ] },
  { title: "VII. NOTES & FINDINGS", items: [
      { id: 'adm-notes', label: 'Notes & Findings', icon: MessageSquare, path: '/app/notes' },
      { id: 'adm-complaints', label: 'Complaints', icon: AlertTriangle, path: '/app/complaints' },
  ] },
];

export const MODULES: Record<string, ModuleConfig> = {
  ADMIN: { id: 'ADMIN', name: 'System Admin', description: 'Global Oversight', icon: Shield, menu: ADMIN_MENU },
  FINANCE: { id: 'FINANCE', name: 'Finance', description: 'Consolidated Accounts', icon: Landmark, menu: FINANCE_MENU },
  HR: { id: 'HR', name: 'HR Master', description: 'Workforce Control', icon: Users, menu: HR_MENU },
  ROCK_OF_AGES_CMS: { id: 'ROCK_OF_AGES_CMS', name: 'Rock of Ages CMS', description: 'Church Operations', icon: Library, menu: ROCK_OF_AGES_MENU },
  SECURITY: { id: 'SECURITY', name: 'Tough Force', description: 'Security & Logistics', icon: Shield, menu: SECURITY_MENU },
  REAL_ESTATE: { id: 'REAL_ESTATE', name: 'Hakika', description: 'Real Estate Automation', icon: Building, menu: REAL_ESTATE_MENU }
};
