// @ts-nocheck
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import PlatformLayout from './components/PlatformLayout';
import PublicLayout from './components/PublicLayout';
import { ModuleType } from './types';
import { supabase } from './utils/supabase';
import AppRouteBoundary from './components/AppRouteBoundary';
import AppShellLoader from './components/AppShellLoader';
import { AccessProvider, useAccessOrFallback } from './context/AccessContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { useAccess } from './hooks/useAccess';
import { activityLogger } from './utils/activityLogger';
import AdminGuard from './components/AdminGuard';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import { getModuleLandingPath, resolveAvailableModules } from './utils/navigation';
import { ENABLE_AUDIT_ENGINE, ENABLE_BILLING_ENGINE, ENABLE_ENTERPRISE_AUDIT_COVERAGE, ENABLE_PERMISSION_ENGINE, ENABLE_PLATFORM_GOVERNANCE, ENABLE_PLATFORM_IDENTITY, ENABLE_PLATFORM_OPERATIONS, ENABLE_PLATFORM_PREVIEW, ENABLE_SUPPORT_CENTER, ENABLE_WORKSPACE_ADMINISTRATION, ENABLE_WORKSPACE_PLATFORM } from './config/featureFlags';

const normalizeDashboardAccess = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

// ─── Analytics Provider ───────────────────────────────────────────────────────
// Registers a global click/navigation tracker as a React component so it
// mounts/unmounts cleanly and is never registered at module-evaluation time.
const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    activityLogger.logPageView(window.location.pathname);

    const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (SKIP_TAGS.has(target.tagName)) return;

      // Find the closest interactive element
      const interactiveEl = target.closest('button, a, [role="button"], [onclick], .cursor-pointer, input[type="submit"], input[type="button"]');
      
      if (interactiveEl && !interactiveEl.classList.contains('no-track')) {
        const text = interactiveEl.textContent?.trim() || 
                     interactiveEl.getAttribute('aria-label') || 
                     interactiveEl.getAttribute('title') || 
                     (interactiveEl as HTMLInputElement).value ||
                     interactiveEl.getAttribute('placeholder') ||
                     'Interactive Element';
        
        const type = interactiveEl.tagName.toLowerCase() === 'a' ? 'link' : 
                     interactiveEl.tagName.toLowerCase() === 'button' ? 'button' : 
                     'element';
                     
        activityLogger.logClick(text.substring(0, 50), type);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return <>{children}</>;
};

import { usePageVisibility } from './hooks/usePageVisibility_fix';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Every page is lazy so only the current route's JS is downloaded.

// Shared / utility pages
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const GenericPage = lazy(() => import('./pages/GenericPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const AdminUserProfile = lazy(() => import('./pages/AdminUserProfile'));
const SupabaseDebug = lazy(() => import('./pages/SupabaseDebug'));
const DeviceManagementPage = lazy(() => import('./pages/DeviceManagementPage'));
const DeviceLimitReachedPage = lazy(() => import('./pages/DeviceLimitReachedPage'));
const PlatformPreviewPage = lazy(() => import('./pages/PlatformPreviewPage'));
const PlatformValidationPage = lazy(() => import('./pages/PlatformValidationPage'));
const WorkflowOrchestratorPage = lazy(() => import('./pages/WorkflowOrchestratorPage'));
const PlatformBusPage = lazy(() => import('./pages/PlatformBusPage'));
const SupportCenterPage = lazy(() => import('./pages/SupportCenterPage'));
const PlatformBillingPage = lazy(() => import('./pages/PlatformBillingPage'));
const PlatformWorkspacePage = lazy(() => import('./pages/PlatformWorkspacePage'));
const PlatformIdentityPage = lazy(() => import('./pages/PlatformIdentityPage'));
const PlatformHealthPage = lazy(() => import('./pages/PlatformHealthPage'));
const PlatformAnalyticsPage = lazy(() => import('./pages/PlatformAnalyticsPage'));
const PlatformOperationsPage = lazy(() => import('./pages/PlatformOperationsPage'));
const PlatformApplicationsPage = lazy(() => import('./pages/PlatformApplicationsPage'));
const PlatformWorkflowsPage = lazy(() => import('./pages/PlatformWorkflowsPage'));
const PlatformNotificationsPage = lazy(() => import('./pages/PlatformNotificationsPage'));
const PlatformIntegrationsPage = lazy(() => import('./pages/PlatformIntegrationsPage'));
const PlatformApplicationPreviewPage = lazy(() => import('./pages/PlatformApplicationPreviewPage'));

// Public / marketing pages (not needed by logged-in users at all)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const RequestRentalPage = lazy(() => import('./pages/RequestRentalPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const PressPage = lazy(() => import('./pages/PressPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const ContactDeveloperPage = lazy(() => import('./pages/ContactDeveloperPage'));
const ETimsVerification = lazy(() => import('./pages/ETimsVerification'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PortalLogin = lazy(() => import('./pages/PortalLogin'));
const TwoFactorVerification = lazy(() => import('./pages/TwoFactorVerification'));
// LegalPages exports multiple named components — wrap each in its own lazy chunk
const PrivacyPolicy = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.TermsOfService })));
const CookiePolicy = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.CookiePolicy })));
const SecurityAudit = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.SecurityAudit })));

// Admin pages
const AdminsPage = lazy(() => import('./pages/admin/AdminsPage'));
const DirectorsPage = lazy(() => import('./pages/admin/DirectorsPage'));
const RoleManagementPage = lazy(() => import('./pages/admin/RoleManagementPage'));
const DashboardEntitlementsPage = lazy(() => import('./pages/admin/DashboardEntitlementsPage'));
const ServiceOverviewPage = lazy(() => import('./pages/admin/ServiceOverviewPage'));
const ServiceBillingPage = lazy(() => import('./pages/admin/ServiceBillingPage'));
const ServicePricingPage = lazy(() => import('./pages/admin/ServicePricingPage'));
const ServiceSubscriptionsPage = lazy(() => import('./pages/admin/ServiceSubscriptionsPage'));
const ServicePaymentsPage = lazy(() => import('./pages/admin/ServicePaymentsPage'));
const ServiceEventsPage = lazy(() => import('./pages/admin/ServiceEventsPage'));
const ContactInboxPage = lazy(() => import('./pages/admin/ContactInboxPage'));
const ContactInquiryDetailPage = lazy(() => import('./pages/admin/ContactInquiryDetailPage'));
const SystemLogsPage = lazy(() => import('./pages/admin/SystemLogsPage'));
const PageVisibilityManagement = lazy(() => import('./pages/admin/PageVisibilityManagement'));
const MpesaAdminTestConsole = lazy(() => import('./pages/admin/MpesaAdminTestConsole'));
const MessagingTestPage = lazy(() => import('./pages/admin/MessagingTestPage'));
const CommunicationHistoryPage = lazy(() => import('./pages/admin/CommunicationHistoryPage'));
const BackupRestoreAdmin = lazy(() => import('./pages/admin/BackupRestoreAdmin'));
const DeleteLogsPage = lazy(() => import('./pages/admin/DeleteLogsPage'));
const DeletedCompaniesPage = lazy(() => import('./pages/admin/DeletedCompaniesPage'));
const AdminCompaniesPage = lazy(() => import('./pages/admin/CompaniesPage'));
const DeletedSubscriptionsPage = lazy(() => import('./pages/admin/DeletedSubscriptionsPage'));
const ArchiveEventsPage = lazy(() => import('./pages/admin/ArchiveEventsPage'));
const ModulePermissionSummaryPage = lazy(() => import('./pages/admin/ModulePermissionSummaryPage'));
const MigrationHealthPage = lazy(() => import('./pages/admin/MigrationHealthPage'));

// HR pages
const EmployeeCredentials = lazy(() => import('./pages/hr/EmployeeCredentials'));
const LandlordCredentials = lazy(() => import('./pages/admin/LandlordCredentials'));
const Departments = lazy(() => import('./pages/hr/Departments'));
const Designations = lazy(() => import('./pages/hr/Designations'));
const Modules = lazy(() => import('./pages/hr/Modules'));
const MyPayroll = lazy(() => import('./pages/hr/MyPayroll'));
const MyLeave = lazy(() => import('./pages/hr/MyLeave'));
const MyLeaveRequests = lazy(() => import('./pages/hr/MyLeaveRequests'));
const LeaveApprovals = lazy(() => import('./pages/hr/LeaveApprovals'));
const LeaveTypesManagement = lazy(() => import('./pages/hr/LeaveTypesManagement'));
const ApplyForLeave = lazy(() => import('./pages/hr/ApplyForLeave'));
const PayrollDeductionsTest = lazy(() => import('./pages/hr/PayrollDeductionsTest'));
const PastEmployees = lazy(() => import('./pages/hr/PastEmployees'));
const DisciplinaryCases = lazy(() => import('./pages/hr/DisciplinaryCases'));
const DocumentExpiry = lazy(() => import('./pages/hr/DocumentExpiry'));
const StatutoryReturns = lazy(() => import('./pages/hr/StatutoryReturns'));
const ExpenseReports = lazy(() => import('./pages/hr/ExpenseReports'));
const SalaryAdvances = lazy(() => import('./pages/hr/SalaryAdvances'));
const SalaryAdvanceApprovals = lazy(() => import('./pages/hr/SalaryAdvanceApprovals'));
const HRAddAsset = lazy(() => import('./pages/hr/AddAsset'));
const Companies = lazy(() => import('./pages/hr/Companies'));
const HRAssetTracking = lazy(() => import('./pages/hr/AssetTracking'));

// Security pages
const IncidentAnalytics = lazy(() => import('./pages/security/IncidentAnalytics'));
const LocationsManagement = lazy(() => import('./pages/security/LocationsManagement'));
const AddLocation = lazy(() => import('./pages/security/AddLocation'));
const LogIncident = lazy(() => import('./pages/security/LogIncident'));
const IncidentTypes = lazy(() => import('./pages/security/IncidentTypes'));
const AssetManagement = lazy(() => import('./pages/security/AssetManagement'));
const AddAsset = lazy(() => import('./pages/security/AddAsset'));
const AssignAsset = lazy(() => import('./pages/security/AssignAsset'));
const AssetCatalog = lazy(() => import('./pages/security/AssetCatalog'));
const AssetAssignment = lazy(() => import('./pages/security/AssetAssignment'));
const AssetDisposal = lazy(() => import('./pages/security/AssetDisposal'));
const AssetTransfer = lazy(() => import('./pages/security/AssetTransfer'));
const AssetTransferForm = lazy(() => import('./pages/security/AssetTransferForm'));
const AssetRepair = lazy(() => import('./pages/security/AssetRepair'));
const PatrolTracking = lazy(() => import('./pages/security/PatrolTracking'));
const AddGuard = lazy(() => import('./pages/security/AddGuard'));
const ComplianceHub = lazy(() => import('./pages/security/ComplianceHub'));
const CctvSurveillance = lazy(() => import('./pages/security/CctvSurveillance'));
const LiveCoverage = lazy(() => import('./pages/security/LiveCoverage'));
const CctvDevicesPage = lazy(() => import('./pages/security/CctvDevicesPage'));
const SmartPssConnections = lazy(() => import('./pages/security/SmartPssConnections'));
const CctvWall = lazy(() => import('./pages/security/CctvWall'));
const SecurityBilling = lazy(() => import('./pages/security/SecurityBilling'));
const SecurityActivityLog = lazy(() => import('./pages/security/SecurityActivityLog'));
const SecurityRecommendations = lazy(() => import('./pages/security/SecurityRecommendations'));

// Finance pages
const TaxReturns = lazy(() => import('./pages/finance/TaxReturns'));
const FinanceAlerts = lazy(() => import('./pages/finance/FinanceAlerts'));
const DashboardSelector = lazy(() => import('./pages/DashboardSelector'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AddEmployee = lazy(() => import('./pages/hr/AddEmployee'));
const EditEmployee = lazy(() => import('./pages/hr/EditEmployee'));
const TotalEmployees = lazy(() => import('./pages/hr/TotalEmployees'));
const PayrollOverview = lazy(() => import('./pages/hr/PayrollOverview'));
const PayeCsvBuilder = lazy(() => import('./pages/hr/PayeCsvBuilder'));
const P9AForm = lazy(() => import('./pages/hr/P9AForm'));
const LeaveManagement = lazy(() => import('./pages/hr/LeaveManagement'));
const Recruitment = lazy(() => import('./pages/hr/Recruitment'));
const DashboardRealEstate = lazy(() => import('./pages/DashboardRealEstate'));
const DashboardRockOfAges = lazy(() => import('./pages/DashboardRockOfAges'));
const RockOfAgesBudgetPage = lazy(() => import('./pages/rock-of-ages/BudgetPage'));
const RockOfAgesMembersPage = lazy(() => import('./pages/rock-of-ages/MembersPage'));
const RockOfAgesFinancePage = lazy(() => import('./pages/rock-of-ages/FinancePage'));
const RockOfAgesPaymentsPage = lazy(() => import('./pages/rock-of-ages/PaymentsPage'));
const RockOfAgesReceiptsPage = lazy(() => import('./pages/rock-of-ages/ReceiptsPage'));
const RockOfAgesRequisitionsPage = lazy(() => import('./pages/rock-of-ages/RequisitionsPage'));
const ROAAddAsset = lazy(() => import('./pages/rock-of-ages/AddAsset'));
const RockOfAgesInventoryPage = lazy(() => import('./pages/rock-of-ages/InventoryPage'));
const RockOfAgesEventsPage = lazy(() => import('./pages/rock-of-ages/EventsPage'));
const RockOfAgesMinistryProgramsPage = lazy(() => import('./pages/rock-of-ages/MinistryProgramsPage'));
const RockOfAgesReportsPage = lazy(() => import('./pages/rock-of-ages/ReportsPage'));
const RockOfAgesUserManagementPage = lazy(() => import('./pages/rock-of-ages/UserManagementPage'));
const RockOfAgesDailyDevotionPage = lazy(() => import('./pages/rock-of-ages/DailyDevotionPage'));
const Properties = lazy(() => import('./pages/real-estate/Properties'));
const PropertyDetails = lazy(() => import('./pages/real-estate/PropertyDetails'));
const TenantManagement = lazy(() => import('./pages/real-estate/TenantManagement'));
const AddUnitPage = lazy(() => import('./pages/real-estate/AddUnitPage'));
const UnitsManagement = lazy(() => import('./pages/real-estate/UnitsManagement'));
const TenantProfilePage = lazy(() => import('./pages/real-estate/TenantProfilePage'));
const TenantDashboardPage = lazy(() => import('./pages/real-estate/TenantDashboardPage'));
const CaretakerDashboardPage = lazy(() => import('./pages/real-estate/CaretakerDashboardPage'));
const TenantPortalProfilePage = lazy(() => import('./pages/real-estate/TenantPortalProfilePage'));
const TenantPaymentsPage = lazy(() => import('./pages/real-estate/TenantPaymentsPage'));
const TenantPortalDetailsPage = lazy(() => import('./pages/real-estate/TenantPortalDetailsPage'));
const LandlordPortalDetailsPage = lazy(() => import('./pages/real-estate/LandlordPortalDetailsPage'));
const LandlordDashboardPage = lazy(() => import('./pages/real-estate/LandlordDashboardPage'));
const MaintenanceRequest = lazy(() => import('./pages/real-estate/MaintenanceRequest'));
const NotesFindings = lazy(() => import('./pages/real-estate/NotesFindings'));
const HousesUnits = lazy(() => import('./pages/real-estate/HousesUnits'));
const DigitalLeases = lazy(() => import('./pages/real-estate/DigitalLeases'));
const LeaseDetailPage = lazy(() => import('./pages/real-estate/LeaseDetailPage'));
const FinancialYield = lazy(() => import('./pages/real-estate/FinancialYield'));
const VacatingNotices = lazy(() => import('./pages/real-estate/VacatingNotices'));
const AssetTracking = lazy(() => import('./pages/real-estate/AssetTracking'));
const UnitAssetInventory = lazy(() => import('./pages/real-estate/UnitAssetInventory'));
const AssetInventory = lazy(() => import('./pages/real-estate/AssetInventory'));
const TenantAssetAssignmentPage = lazy(() => import('./pages/real-estate/TenantAssetAssignmentPage'));
const AssignAssetToTenantPage = lazy(() => import('./pages/real-estate/AssignAssetToTenantPage'));
const SmsCommunication = lazy(() => import('./pages/real-estate/SmsCommunication'));
const InvoiceOverview = lazy(() => import('./pages/real-estate/InvoiceOverview'));
const InvoiceList = lazy(() => import('./pages/real-estate/InvoiceList'));
const AutoBilling = lazy(() => import('./pages/real-estate/AutoBilling'));
const AutoBillingPropertyDetail = lazy(() => import('./pages/real-estate/AutoBillingPropertyDetail'));
const PublicInvoicePage = lazy(() => import('./pages/real-estate/PublicInvoicePage'));
const AddInvoiceItem = lazy(() => import('./pages/real-estate/AddInvoiceItem'));
const ArrearsManagement = lazy(() => import('./pages/real-estate/ArrearsManagement'));
const PenaltiesManagement = lazy(() => import('./pages/real-estate/PenaltiesManagement'));
const REAddAsset = lazy(() => import('./pages/real-estate/AddAsset'));
const KRAeTims = lazy(() => import('./pages/real-estate/KRAeTims'));
const InvoiceTypesPage = lazy(() => import('./pages/real-estate/InvoiceTypesPage'));
const DeletedInvoicesPage = lazy(() => import('./pages/real-estate/DeletedInvoicesPage'));
const SplitPayment = lazy(() => import('./pages/real-estate/SplitPayment'));
const HakikaPayoutControl = lazy(() => import('./pages/real-estate/HakikaPayoutControl'));
const HakikaPayoutOverview = lazy(() => import('./pages/real-estate/HakikaPayoutOverview'));
const HakikaPayoutRecipients = lazy(() => import('./pages/real-estate/HakikaPayoutRecipients'));
const HakikaPayoutQueue = lazy(() => import('./pages/real-estate/HakikaPayoutQueue'));
const HakikaPayoutHistory = lazy(() => import('./pages/real-estate/HakikaPayoutHistory'));
const HakikaSplitAudit = lazy(() => import('./pages/real-estate/HakikaSplitAudit'));
const HakikaBankJoin = lazy(() => import('./pages/real-estate/HakikaBankJoin'));
const MpesaTransactions = lazy(() => import('./pages/real-estate/MpesaPaymentTracker'));
const ManualPayments = lazy(() => import('./pages/real-estate/ManualPayments'));
const PesalinkTransactions = lazy(() => import('./pages/real-estate/PesalinkTransactions'));
const HakikaReconciliation = lazy(() => import('./pages/real-estate/HakikaReconciliation'));
const AddWaterBill = lazy(() => import('./pages/real-estate/AddWaterBill'));
const WaterBillingSummary = lazy(() => import('./pages/real-estate/WaterBillingSummary'));
const MeterReadings = lazy(() => import('./pages/real-estate/MeterReadings'));
const PostpaidMeters = lazy(() => import('./pages/real-estate/PostpaidMeters'));
const ConfigureHouses = lazy(() => import('./pages/real-estate/ConfigureHouses'));
const StatementOfRent = lazy(() => import('./pages/real-estate/StatementOfRent'));
const TenantLedgerPage = lazy(() => import('./pages/real-estate/TenantLedgerPage'));
const PaymentReference = lazy(() => import('./pages/real-estate/PaymentReference'));
const WaterConsumptionReport = lazy(() => import('./pages/real-estate/WaterConsumptionReport'));
const ArrearsReport = lazy(() => import('./pages/real-estate/ArrearsReport'));
const ExpenseReport = lazy(() => import('./pages/real-estate/ExpenseReport'));
const MaintenanceCommunication = lazy(() => import('./pages/real-estate/MaintenanceCommunication'));
const LeaseDocumentsComm = lazy(() => import('./pages/real-estate/LeaseDocumentsComm'));
const CaretakersManagement = lazy(() => import('./pages/real-estate/CaretakersManagement'));
const LandlordsManagement = lazy(() => import('./pages/real-estate/LandlordsManagement'));
const DeletedRealEstateRecords = lazy(() => import('./pages/real-estate/DeletedRealEstateRecords'));
const InspectionReports = lazy(() => import('./pages/real-estate/InspectionReports'));
const HakikaLedger = lazy(() => import('./pages/real-estate/HakikaLedger'));
const TacticalConsole = lazy(() => import('./pages/security/TacticalConsole'));
const TenantActivityLogPage = lazy(() => import('./pages/admin/TenantActivityLogPage'));
const IncidentReporting = lazy(() => import('./pages/security/IncidentReporting'));
const RosterManagement = lazy(() => import('./pages/security/RosterManagement'));

// Guard Mobile App pages
const GuardDashboardPage = lazy(() => import('./pages/mobile/GuardDashboardPage'));
const GuardCheckInPage = lazy(() => import('./pages/mobile/GuardCheckInPage'));
const GuardCheckOutPage = lazy(() => import('./pages/mobile/GuardCheckOutPage'));
const GuardShiftsPage = lazy(() => import('./pages/mobile/GuardShiftsPage'));
const GuardAttendancePage = lazy(() => import('./pages/mobile/GuardAttendancePage'));
const GuardNotificationsPage = lazy(() => import('./pages/mobile/GuardNotificationsPage'));
const EditRosterShiftPage = lazy(() => import('./pages/security/EditRosterShiftPage'));
const AssignGuardDutyPage = lazy(() => import('./pages/security/AssignGuardDutyPage'));
const AttendanceShiftPage = lazy(() => import('./pages/security/AttendanceShiftPage'));
const RosterCalendar = lazy(() => import('./pages/security/RosterCalendar'));
const GuardDatabase = lazy(() => import('./pages/security/GuardDatabase'));
const PastGuards = lazy(() => import('./pages/security/PastGuards'));
const AttendanceMaster = lazy(() => import('./pages/security/AttendanceMaster'));
const WorkforceHub = lazy(() => import('./pages/security/WorkforceHub'));
const FinanceDashboardAdmin = lazy(() => import('./pages/finance/FinanceDashboardAdmin'));
const GlobalLedger = lazy(() => import('./pages/finance/GlobalLedger'));
const JournalEntryPage = lazy(() => import('./pages/finance/JournalEntryPage'));
const Reconciliation = lazy(() => import('./pages/finance/Reconciliation'));
const DashboardLedger = lazy(() => import('./pages/DashboardLedger'));
const BankAccountsManagement = lazy(() => import('./pages/BankAccountsManagement'));
const InvoicingCenter = lazy(() => import('./pages/finance/InvoicingCenter'));
const FinancePayments = lazy(() => import('./pages/finance/FinancePayments'));
const FinancePayeeManager = lazy(() => import('./pages/finance/FinancePayeeManager'));
const FinanceCostCentres = lazy(() => import('./pages/finance/FinanceCostCentres'));
const FinanceExpenseGroups = lazy(() => import('./pages/finance/FinanceExpenseGroups'));

// Service Marketplace
const ServiceMarketplace = lazy(() => import('./pages/services/ServiceMarketplace'));

// Service Rentals Admin Pages
const ServiceRentalsOverview = lazy(() => import('./pages/admin/ServiceRentalsOverview'));
const ServiceRentalsSubscriptions = lazy(() => import('./pages/admin/ServiceRentalsSubscriptions'));
const ServiceRentalsAdmins = lazy(() => import('./pages/admin/ServiceRentalsAdmins'));
const ServiceRentalsReports = lazy(() => import('./pages/admin/ServiceRentalsReports'));
const ServiceRentalDetails = lazy(() => import('./pages/admin/ServiceRentalDetails'));

const FinancePaymentVouchers = lazy(() => import('./pages/finance/FinancePaymentVouchers'));
const FinanceRequisitions = lazy(() => import('./pages/finance/FinanceRequisitions'));
const FinanceRequisitionApprovals = lazy(() => import('./pages/finance/FinanceRequisitionApprovals'));
const FinanceDeletedRequisitions = lazy(() => import('./pages/finance/FinanceDeletedRequisitions'));
const FinancePaymentOptions = lazy(() => import('./pages/finance/FinancePaymentOptions'));
const FinanceWallets = lazy(() => import('./pages/finance/FinanceWallets'));
const FinanceExpenseReport = lazy(() => import('./pages/finance/FinanceExpenseReport'));
const FinanceReceiptsReport = lazy(() => import('./pages/finance/FinanceReceiptsReport'));
const FinanceArrearsReport = lazy(() => import('./pages/finance/FinanceArrearsReport'));
const BankAccounts = lazy(() => import('./pages/BankAccountsManagement'));
const BankConnections = lazy(() => import('./pages/finance/BankConnections'));
const FinanceNotes = lazy(() => import('./pages/finance/FinanceNotes'));
const FinanceStatements = lazy(() => import('./pages/finance/FinanceStatements'));

const ShellRouteBoundary: React.FC<{
  children: React.ReactNode;
  fallbackHref?: string;
}> = ({ children, fallbackHref }) => {
  const location = useLocation();

  return (
    <AppRouteBoundary fallbackHref={fallbackHref} resetKey={location.pathname}>
      {children}
    </AppRouteBoundary>
  );
};

const RouteSuspense: React.FC<{
  children: React.ReactNode;
  label?: string;
}> = ({ children, label = 'Loading workspace...' }) => (
  <Suspense fallback={<AppShellLoader label={label} variant="panel" />}>{children}</Suspense>
);

const resolveModuleFromPath = (pathname: string): ModuleType => {
  if (pathname.startsWith('/admin')) return 'ADMIN';
  if (pathname.startsWith('/app/finance')) return 'FINANCE';
  if (pathname.startsWith('/app/rock-of-ages')) return 'ROCK_OF_AGES_CMS';
  if (pathname.startsWith('/app/security')) return 'SECURITY';
  if (pathname.startsWith('/app/real-estate')) return 'REAL_ESTATE';
  if (pathname.startsWith('/app/tenant')) return 'REAL_ESTATE';
  return 'HR';
};

const resolveModuleFromProfile = (profileModule?: string | null): ModuleType | null => {
  const normalized = (profileModule || '').trim().toLowerCase();
  switch (normalized) {
    case 'hakika':
    case 'real_estate':
    case 'real-estate':
      return 'REAL_ESTATE';
    case 'hr':
      return 'HR';
    case 'security':
    case 'tough_force':
      return 'SECURITY';
    case 'rock_of_ages':
    case 'rock_of_ages_cms':
    case 'rock-of-ages':
      return 'ROCK_OF_AGES_CMS';
    case 'finance':
      return 'FINANCE';
    case 'admin':
      return 'ADMIN';
    default:
      return null;
  }
};

const AccessGuard: React.FC<{
  path: string;
  children: React.ReactNode;
}> = ({ path, children }) => {
  const { canSeePage, loading: pageLoading, permissions } = usePageVisibility();
  const { role, hasServiceAccess, profile } = useAccess();
  const dashboardAccess = Array.isArray(profile?.dashboard_access)
    ? profile.dashboard_access.map((item) => String(item).trim())
    : typeof profile?.dashboard_access === 'string'
      ? profile.dashboard_access.split(',').map((item) => item.trim())
      : [];
  const location = useLocation();

  // Only show the loader if we are currently loading AND we have no permissions data yet.
  // This prevents flickering during background re-fetches on tab focus.
  if (pageLoading && Object.keys(permissions).length === 0) {
    return <AppShellLoader label="Verifying access..." variant="panel" />;
  }

  if (path === '/app/account/billing' || path === '/admin/service-billing') {
    return <>{children}</>;
  }

  if (!canSeePage(path)) {
    if (role === 'Tenant') {
      return <Navigate to="/app/tenant/dashboard" replace />;
    }
    if (path === '/app/account/billing') {
      return <Navigate to="/admin/service-billing" replace />;
    }
    // Redirect to the dashboard which is whitelisted
    return <Navigate to="/app/dashboard" replace />;
  }

  const serviceByPath: Array<{ prefix: string; serviceKey: string }> = [
    { prefix: '/app/hr', serviceKey: 'hr' },
    { prefix: '/app/security', serviceKey: 'tough_force' },
    { prefix: '/app/real-estate', serviceKey: 'hakika' },
    { prefix: '/admin', serviceKey: 'admin' },
  ];

  const serviceMatch = serviceByPath.find((item) => path.startsWith(item.prefix) || location.pathname.startsWith(item.prefix));
  if (serviceMatch && role !== 'Super Admin' && role !== 'Director' && role !== 'Director / Super Admin' && role !== 'Administrator') {
    if (serviceMatch.serviceKey === 'admin' && dashboardAccess.includes('ADMIN_DASH')) {
      return <>{children}</>;
    }
    if (!hasServiceAccess(serviceMatch.serviceKey)) {
      const billingPath = `/app/account/billing?service=${encodeURIComponent(serviceMatch.serviceKey)}`;
      return <Navigate to={billingPath} replace state={{ requiredService: serviceMatch.serviceKey, companyCode: profile?.company_code || null }} />;
    }
  }

  return <>{children}</>;
};

const ModuleRedirector: React.FC = () => {
  const { role, profile, loading } = useAccessOrFallback();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}`;
    const go = (target: string) => {
      if (currentPath !== target) {
        navigate(target, { replace: true });
      }
    };

    // Fast path: if we already have the role, go immediately
    if (role) {
      if (role === 'Tenant') {
        go('/app/tenant/dashboard');
        return;
      }
      if (role === 'Landlord') {
        go('/app/landlord/dashboard');
        return;
      }
      if (role === 'Caretaker') {
        go('/app/caretaker/dashboard');
        return;
      }
      const lastModule = localStorage.getItem('last_active_module');
      const preference = resolveModuleFromProfile(profile?.module) || (lastModule as ModuleType | null);
      const availableModules = resolveAvailableModules(role, profile?.module);
      const extraDashboards = normalizeDashboardAccess(profile?.dashboard_access).filter((path) =>
        path === '/app/landlord/dashboard' || path === '/app/tenant/dashboard'
      );

      if (availableModules.length === 0 && extraDashboards.length === 0) {
        go('/app/dashboard');
        return;
      }

      if (availableModules.length + extraDashboards.length > 1) {
        go('/app/select-dashboard');
        return;
      }

      if (preference && availableModules.some(m => m.id === preference)) {
        go(getModuleLandingPath(preference));
        return;
      }

      go(getModuleLandingPath(availableModules[0].id));
    } else if (!loading) {
      // If loading is finished but still no role, clear session
      const isAuthRoute = location.pathname === '/portal' || location.pathname === '/verify-2fa' || location.pathname === '/';
    
      if (!role && !loading && !isAuthRoute) {
        console.warn("ModuleRedirector: No role found on protected route, redirecting to portal.", {
          path: location.pathname,
          role,
          loading
        });
        go('/portal');
        return;
      }
    }

    // Safety fallback: if we're still loading after 8 seconds, redirect to a safe default
    const fallbackTimer = window.setTimeout(() => {
      if (loading && !role) {
        console.log("ModuleRedirector: Long wait for profile, jumping to default dashboard.");
        navigate('/app/select-dashboard');
      }
    }, 8000);

    return () => window.clearTimeout(fallbackTimer);
  }, [loading, location.pathname, location.search, navigate, profile?.dashboard_access, profile?.module, role]);

  return <AppShellLoader label="Routing to your workspace..." />;
};

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, role } = useAccessOrFallback();
  
  // Only show the authenticating loader if we don't have a role yet.
  // If we already have a role, we can safely render the children even if
  // a background refresh is happening (triggered by tab focus).
  if (loading && !role) {
    return <AppShellLoader label="Authenticating session..." />;
  }

  if (!loading && !role) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
};

// Admin Content Component
const AdminContent: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();

  const handleModuleChange = (module: ModuleType) => {
    navigate(getModuleLandingPath(module));
  };

  return (
    <Layout currentModule="ADMIN" onModuleChange={handleModuleChange} onLogout={onLogout}>
      <ShellRouteBoundary fallbackHref="/admin/dashboards">
        <RouteSuspense label="Loading admin workspace...">
          <Routes>
        <Route path="profile" element={<AccessGuard path="/admin/profile"><MyProfilePage /></AccessGuard>} />
        <Route path="hr/dashboard" element={<AccessGuard path="/app/hr/dashboard"><Dashboard /></AccessGuard>} />
        <Route path="dashboards" element={ENABLE_PLATFORM_PREVIEW && ENABLE_WORKSPACE_ADMINISTRATION ? <Navigate to="/app/platform-preview/executive" replace /> : <AccessGuard path="/admin/dashboards"><Dashboard /></AccessGuard>} />

        <Route path="visibility" element={<AccessGuard path="/admin/visibility"><GenericPage module="Page Visibility" /></AccessGuard>} />
        <Route path="approvals" element={<AccessGuard path="/admin/approvals"><GenericPage module="Approvals" /></AccessGuard>} />
        <Route path="employee-credentials" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_IDENTITY ? <Navigate to="/app/platform/credentials" replace /> : <AccessGuard path="/admin/employee-credentials"><EmployeeCredentials /></AccessGuard>} />
        <Route path="landlord-credentials" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_IDENTITY ? <Navigate to="/app/platform/credentials" replace /> : <AccessGuard path="/admin/landlord-credentials"><LandlordCredentials /></AccessGuard>} />
        <Route path="admins" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_IDENTITY ? <Navigate to="/app/platform/users" replace /> : <AccessGuard path="/admin/admins"><AdminsPage /></AccessGuard>} />
        <Route path="directors" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_IDENTITY ? <Navigate to="/app/platform/users" replace /> : <AccessGuard path="/admin/directors"><DirectorsPage /></AccessGuard>} />
        <Route path="roles" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_IDENTITY ? <Navigate to="/app/platform/roles" replace /> : <AccessGuard path="/admin/roles"><RoleManagementPage /></AccessGuard>} />
        <Route path="dashboard-entitlements" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_IDENTITY ? <Navigate to="/app/platform/dashboard-access" replace /> : <AccessGuard path="/admin/dashboard-entitlements"><DashboardEntitlementsPage /></AccessGuard>} />
        <Route path="service-overview" element={<AdminGuard><ServiceOverviewPage /></AdminGuard>} />
        <Route path="service-subscriptions" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/subscriptions" replace /> : <AdminGuard><ServiceSubscriptionsPage /></AdminGuard>} />
        <Route path="service-payments" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/invoices" replace /> : <AdminGuard><ServicePaymentsPage /></AdminGuard>} />
        <Route path="service-events" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/billing" replace /> : <AdminGuard><ServiceEventsPage /></AdminGuard>} />
        <Route path="contact-inbox" element={ENABLE_SUPPORT_CENTER && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/support-center/inbox" replace /> : <AdminGuard><ContactInboxPage /></AdminGuard>} />
        <Route path="contact-inbox/:id" element={ENABLE_SUPPORT_CENTER && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/support-center/tickets" replace /> : <AdminGuard><ContactInquiryDetailPage /></AdminGuard>} />
        <Route path="service-billing" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/billing" replace /> : <AdminGuard><ServiceBillingPage /></AdminGuard>} />
        <Route path="service-pricing" element={<AdminGuard><ServicePricingPage /></AdminGuard>} />
        
        {/* Service Rental Management */}
        <Route path="service-rentals" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/applications" replace /> : <AccessGuard path="/admin/service-rentals"><ServiceRentalsOverview /></AccessGuard>} />
        <Route path="service-rentals/subscriptions" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/subscriptions" replace /> : <AccessGuard path="/admin/service-rentals/subscriptions"><ServiceRentalsSubscriptions /></AccessGuard>} />
        <Route path="service-rentals/admins" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/organizations" replace /> : <AccessGuard path="/admin/service-rentals/admins"><ServiceRentalsAdmins /></AccessGuard>} />
        <Route path="service-rentals/reports" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/usage" replace /> : <AccessGuard path="/admin/service-rentals/reports"><ServiceRentalsReports /></AccessGuard>} />
        <Route path="service-rentals/:id" element={ENABLE_BILLING_ENGINE && ENABLE_WORKSPACE_ADMINISTRATION && ENABLE_PLATFORM_PREVIEW ? <Navigate to="/app/platform-preview/organizations" replace /> : <AccessGuard path="/admin/service-rentals/:id"><ServiceRentalDetails /></AccessGuard>} />
        
        <Route path="companies" element={ENABLE_PLATFORM_PREVIEW && ENABLE_WORKSPACE_PLATFORM ? <Navigate to="/app/platform/companies" replace /> : <AccessGuard path="/admin/companies"><AdminCompaniesPage /></AccessGuard>} />
        <Route path="logs" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_GOVERNANCE && ENABLE_AUDIT_ENGINE && ENABLE_ENTERPRISE_AUDIT_COVERAGE ? <Navigate to="/app/platform-preview/audit" replace /> : <AccessGuard path="/admin/logs"><SystemLogsPage /></AccessGuard>} />
        <Route path="delete-logs" element={<AccessGuard path="/admin/delete-logs"><DeleteLogsPage /></AccessGuard>} />
        <Route path="deleted-companies" element={<AccessGuard path="/admin/deleted-companies"><DeletedCompaniesPage /></AccessGuard>} />
        <Route path="deleted-subscriptions" element={<AccessGuard path="/admin/deleted-subscriptions"><DeletedSubscriptionsPage /></AccessGuard>} />
        <Route path="archives" element={<AccessGuard path="/admin/archives"><ArchiveEventsPage /></AccessGuard>} />
        <Route path="permissions" element={ENABLE_PLATFORM_PREVIEW && ENABLE_PLATFORM_GOVERNANCE && ENABLE_PERMISSION_ENGINE ? <Navigate to="/app/platform-preview/permissions" replace /> : <AccessGuard path="/admin/permissions"><ModulePermissionSummaryPage /></AccessGuard>} />
        <Route path="migration-health" element={<AccessGuard path="/admin/migration-health"><MigrationHealthPage /></AccessGuard>} />
        <Route path="debug" element={<AccessGuard path="/admin/debug"><SupabaseDebug /></AccessGuard>} />
        <Route path="notes" element={<AccessGuard path="/app/notes"><NotesPage /></AccessGuard>} />
        <Route path="page-visibility" element={<AccessGuard path="/admin/page-visibility"><PageVisibilityManagement /></AccessGuard>} />
        <Route path="mpesa-test-console" element={<AccessGuard path="/admin/mpesa-test-console"><MpesaAdminTestConsole /></AccessGuard>} />
        <Route path="invitations" element={<AccessGuard path="/admin/invitations"><GenericPage module="Invitations" /></AccessGuard>} />
        <Route path="tactical" element={<AccessGuard path="/app/security/tactical"><Dashboard /></AccessGuard>} />
        <Route path="messaging-test" element={<AccessGuard path="/admin/messaging-test"><MessagingTestPage /></AccessGuard>} />
        <Route path="communication-history" element={<AccessGuard path="/admin/communication-history"><CommunicationHistoryPage /></AccessGuard>} />
        <Route path="restore" element={<AccessGuard path="/admin/restore"><BackupRestoreAdmin /></AccessGuard>} />
        <Route path="profile-view/:id" element={<AccessGuard path="/admin/profile-view/:id"><AdminUserProfile /></AccessGuard>} />
        <Route path="overview" element={<AccessGuard path="/admin/overview"><AdminOverviewPage /></AccessGuard>} />
        <Route path="*" element={<Navigate to="/admin/dashboards" replace />} />
          </Routes>
        </RouteSuspense>
      </ShellRouteBoundary>
    </Layout>
  );
};

// Main App Logic (Protected)
const TenantAppContent: React.FC = () => {
  return (
    <ShellRouteBoundary fallbackHref="/app/tenant/dashboard">
      <RouteSuspense label="Loading tenant portal...">
        <Routes>
          <Route path="dashboard" element={<TenantDashboardPage />} />
          <Route path="profile" element={<TenantPortalProfilePage />} />
          <Route path="payments" element={<TenantPaymentsPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </RouteSuspense>
    </ShellRouteBoundary>
  );
};

const LandlordAppContent: React.FC = () => {
  return (
    <ShellRouteBoundary fallbackHref="/app/landlord/dashboard">
      <RouteSuspense label="Loading landlord portal...">
        <Routes>
          <Route path="dashboard" element={<LandlordDashboardPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </RouteSuspense>
    </ShellRouteBoundary>
  );
};

const AppContent: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, profile } = useAccessOrFallback();
  
  const [currentModule, setCurrentModule] = useState<ModuleType>(() => {
    const pathModule = resolveModuleFromPath(location.pathname);
    if (location.pathname === '/app/dashboard') {
      return resolveModuleFromProfile(profile?.module) || pathModule;
    }
    return pathModule;
  });

  useEffect(() => {
    const nextModule = resolveModuleFromPath(location.pathname);
    const profileModule = resolveModuleFromProfile(profile?.module);
    const derivedModule = location.pathname === '/app/dashboard'
      ? profileModule || resolveModuleFromProfile(localStorage.getItem('last_active_module'))
      : nextModule;

    if (derivedModule) {
      setCurrentModule(derivedModule);
    }

    if (nextModule !== 'ADMIN' && location.pathname !== '/app/dashboard') {
      localStorage.setItem('last_active_module', nextModule);
    } else if (location.pathname === '/app/dashboard' && profileModule && profileModule !== 'HR') {
      localStorage.setItem('last_active_module', profileModule);
    }
  }, [location.pathname, profile?.module, role]);

  const handleModuleChange = (module: ModuleType) => {
    setCurrentModule(module);
    if (module !== 'ADMIN') localStorage.setItem('last_active_module', module);
    navigate(getModuleLandingPath(module));
  };

  return (
    <Layout currentModule={currentModule} onModuleChange={handleModuleChange} onLogout={onLogout}>
      <ShellRouteBoundary fallbackHref={getModuleLandingPath(currentModule)}>
        <RouteSuspense label="Loading workspace...">
          <Routes>
        <Route path="/" element={<ModuleRedirector />} />
        <Route path="select-dashboard" element={<DashboardSelector />} />
        <Route path="device-limit-reached" element={<DeviceLimitReachedPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="profile/devices" element={<DeviceManagementPage />} />
        <Route path="dashboard" element={<ModuleRedirector />} />
        <Route path="account" element={<GenericPage module="My Account" />} />
        <Route path="account/billing" element={<ServiceBillingPage />} />
        <Route path="account/my-hr" element={<GenericPage module="My HR" />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="notes" element={<AccessGuard path="/app/notes"><NotesPage /></AccessGuard>} />
        <Route path="complaints" element={<AccessGuard path="/app/complaints"><ComplaintsPage /></AccessGuard>} />

        <Route path="admin/dashboards" element={<AdminGuard><Dashboard /></AdminGuard>} />
        <Route path="admin/management" element={<AccessGuard path="/admin/admins"><GenericPage module="Admin Management" /></AccessGuard>} />
        <Route path="admin/activity-log" element={<AccessGuard path="/admin/activity-log"><TenantActivityLogPage /></AccessGuard>} />

        <Route path="hr/dashboard" element={<AccessGuard path="/app/hr/dashboard"><Dashboard /></AccessGuard>} />
        <Route path="admin/reconciliation" element={<AccessGuard path="/admin/reconciliation"><GenericPage module="Reconciliation Placeholder" /></AccessGuard>} />

        <Route path="hr/payroll/process" element={<AccessGuard path="/app/hr/payroll/process"><PayrollOverview /></AccessGuard>} />
        <Route path="hr/payroll/payslips" element={<AccessGuard path="/app/hr/payroll/payslips"><MyPayroll /></AccessGuard>} />
        <Route path="hr/payroll/payroll" element={<AccessGuard path="/app/hr/payroll/payroll"><PayeCsvBuilder /></AccessGuard>} />
        <Route path="hr/payroll/paye-csv" element={<Navigate to="/app/hr/payroll/payroll" replace />} />
        <Route path="hr/payroll/p9a" element={<AccessGuard path="/app/hr/payroll/p9a"><P9AForm /></AccessGuard>} />
        <Route path="hr/payroll/statutory" element={<AccessGuard path="/app/hr/statutory-returns"><StatutoryReturns /></AccessGuard>} />
        <Route path="hr/payroll/loans-advances" element={<AccessGuard path="/app/hr/payroll/loans-advances"><SalaryAdvances /></AccessGuard>} />
        <Route path="hr/payroll/loans-advances/approvals" element={<AccessGuard path="/app/hr/payroll/loans-advances/approvals"><SalaryAdvanceApprovals /></AccessGuard>} />
        <Route path="hr/payroll/deductions-test" element={<AccessGuard path="/app/hr/payroll/deductions-test"><PayrollDeductionsTest /></AccessGuard>} />

        <Route path="hr/apply-for-leave" element={<AccessGuard path="/app/hr/apply-for-leave"><ApplyForLeave /></AccessGuard>} />
        <Route path="hr/my-leave-requests" element={<AccessGuard path="/app/hr/my-leave-requests"><MyLeaveRequests /></AccessGuard>} />
        <Route path="hr/leave-approvals" element={<AccessGuard path="/app/hr/leave-approvals"><LeaveApprovals /></AccessGuard>} />
        <Route path="hr/leave-types" element={<AccessGuard path="/app/hr/leave-types"><LeaveTypesManagement /></AccessGuard>} />
        <Route path="hr/my-leave/*" element={<AccessGuard path="/app/hr/my-leave"><MyLeave /></AccessGuard>} />
        <Route path="hr/leave/*" element={<AccessGuard path="/app/hr/leave"><LeaveManagement /></AccessGuard>} />
        <Route path="hr/sick-leave-requests" element={<AccessGuard path="/app/hr/sick-leave-requests"><GenericPage module="Sick Leave Requests" /></AccessGuard>} />
        <Route path="hr/disciplinary-cases" element={<AccessGuard path="/app/hr/disciplinary-cases"><DisciplinaryCases /></AccessGuard>} />
        <Route path="hr/document-expiry" element={<AccessGuard path="/app/hr/document-expiry"><DocumentExpiry /></AccessGuard>} />
        <Route path="hr/statutory-returns" element={<AccessGuard path="/app/hr/statutory-returns"><StatutoryReturns /></AccessGuard>} />
        <Route path="hr/p9a-form" element={<AccessGuard path="/app/hr/p9a-form"><P9AForm /></AccessGuard>} />
        <Route path="hr/expense-reports" element={<AccessGuard path="/app/hr/expense-reports"><ExpenseReports /></AccessGuard>} />
        <Route path="hr/employee-directory" element={<AccessGuard path="/app/hr/employee-directory"><TotalEmployees /></AccessGuard>} />
        <Route path="hr/edit-employee/:id" element={<AccessGuard path="/app/hr/employee-directory"><EditEmployee /></AccessGuard>} />

        <Route path="hr/add-employee" element={<AccessGuard path="/app/hr/add-employee"><AddEmployee /></AccessGuard>} />
        <Route path="hr/total-employees" element={<AccessGuard path="/app/hr/total-employees"><TotalEmployees /></AccessGuard>} />
        <Route path="hr/past-employees" element={<AccessGuard path="/app/hr/past-employees"><PastEmployees /></AccessGuard>} />
        <Route path="hr/departments" element={<AccessGuard path="/app/hr/departments"><Departments /></AccessGuard>} />
        <Route path="hr/designations" element={<AccessGuard path="/app/hr/designations"><Designations /></AccessGuard>} />
        <Route path="hr/modules" element={<AccessGuard path="/app/hr/modules"><Modules /></AccessGuard>} />
        <Route path="hr/biometric-logs" element={<AccessGuard path="/app/hr/biometric-logs"><GenericPage module="Biometric Logs" /></AccessGuard>} />
        <Route path="hr/site-deployment" element={<AccessGuard path="/app/hr/site-deployment"><GenericPage module="Site Deployment" /></AccessGuard>} />
        <Route path="hr/overtime-records" element={<AccessGuard path="/app/hr/overtime-records"><GenericPage module="Overtime Records" /></AccessGuard>} />
        <Route path="hr/recruitment" element={<AccessGuard path="/app/hr/recruitment"><Recruitment /></AccessGuard>} />
        <Route path="hr/add-asset" element={<AccessGuard path="/app/hr/add-asset"><HRAddAsset /></AccessGuard>} />
        <Route path="hr/companies" element={<AccessGuard path="/app/hr/companies"><Companies /></AccessGuard>} />
        <Route path="hr/asset-assignment" element={<AccessGuard path="/app/hr/asset-assignment"><AssetAssignment /></AccessGuard>} />
        <Route path="hr/asset-tracking" element={<AccessGuard path="/app/hr/asset-tracking"><HRAssetTracking /></AccessGuard>} />
        <Route path="hr/*" element={<Dashboard />} />

        <Route path="admin/admins" element={<AccessGuard path="/admin/admins"><AdminsPage /></AccessGuard>} />
        <Route path="admin/employee-credentials" element={<AccessGuard path="/admin/employee-credentials"><EmployeeCredentials /></AccessGuard>} />
        <Route path="admin/landlord-credentials" element={<AccessGuard path="/admin/landlord-credentials"><LandlordCredentials /></AccessGuard>} />
        <Route path="admin/directors" element={<AccessGuard path="/admin/directors"><DirectorsPage /></AccessGuard>} />
        <Route path="admin/roles" element={<AccessGuard path="/admin/roles"><RoleManagementPage /></AccessGuard>} />
        <Route path="admin/debug" element={<AccessGuard path="/admin/debug"><SupabaseDebug /></AccessGuard>} />
        <Route path="admin/ledger" element={<AccessGuard path="/admin/ledger"><GenericPage module="Central Ledger" /></AccessGuard>} />
        <Route path="admin/invoices" element={<AccessGuard path="/admin/invoices"><GenericPage module="Invoices" /></AccessGuard>} />
        <Route path="admin/payments" element={<AccessGuard path="/admin/payments"><GenericPage module="Payments" /></AccessGuard>} />
        <Route path="admin/notes" element={<AccessGuard path="/app/notes"><GenericPage module="Admin Notes" /></AccessGuard>} />
        <Route path="admin/intel" element={<AccessGuard path="/admin/intel"><GenericPage module="Admin Intel" /></AccessGuard>} />
        <Route path="admin/approvals" element={<AccessGuard path="/admin/approvals"><GenericPage module="Approvals" /></AccessGuard>} />

        <Route path="security/tactical" element={<AccessGuard path="/app/security/tactical"><TacticalConsole /></AccessGuard>} />
        <Route path="security/incident-analytics" element={<AccessGuard path="/app/security/incident-analytics"><IncidentAnalytics /></AccessGuard>} />
        <Route path="security/incidents" element={<AccessGuard path="/app/security/incidents"><IncidentReporting /></AccessGuard>} />
        <Route path="security/incidents/new" element={<AccessGuard path="/app/security/incidents/new"><LogIncident /></AccessGuard>} />
        <Route path="security/recommendations" element={<AccessGuard path="/app/security/recommendations"><SecurityRecommendations /></AccessGuard>} />
        <Route path="security/incident-types" element={<AccessGuard path="/app/security/incident-types"><IncidentTypes /></AccessGuard>} />
        <Route path="security/roster/workbench" element={<AccessGuard path="/app/security/roster/workbench"><RosterManagement /></AccessGuard>} />
        <Route path="security/roster" element={<AccessGuard path="/app/security/roster"><RosterManagement /></AccessGuard>} />
        <Route path="security/roster/:id/edit" element={<AccessGuard path="/app/security/roster/:id/edit"><EditRosterShiftPage /></AccessGuard>} />
        <Route path="security/roster/calendar" element={<AccessGuard path="/app/security/roster/calendar"><RosterCalendar /></AccessGuard>} />
        <Route path="security/sites/assign" element={<AccessGuard path="/app/security/sites/assign"><AssignGuardDutyPage /></AccessGuard>} />
        <Route path="security/workforce" element={<AccessGuard path="/app/security/workforce"><WorkforceHub /></AccessGuard>} />
        <Route path="security/activity" element={<AccessGuard path="/app/security/activity"><SecurityActivityLog /></AccessGuard>} />
        <Route path="security/resources" element={<AccessGuard path="/app/security/resources"><GenericPage module="Resources" /></AccessGuard>} />
        <Route path="security/clients" element={<AccessGuard path="/app/security/clients"><GenericPage module="Client Portals" /></AccessGuard>} />
        <Route path="security/cctv" element={<AccessGuard path="/app/security/cctv"><CctvSurveillance /></AccessGuard>} />
        <Route path="security/compliance" element={<AccessGuard path="/app/security/compliance"><ComplianceHub /></AccessGuard>} />
        <Route path="security/notes" element={<AccessGuard path="/app/notes"><GenericPage module="Findings & Recommendations" /></AccessGuard>} />
        <Route path="security/patrols" element={<AccessGuard path="/app/security/patrols"><PatrolTracking /></AccessGuard>} />
        <Route path="security/assets" element={<AccessGuard path="/app/security/assets"><AssetManagement /></AccessGuard>} />
        <Route path="security/assets/new" element={<AccessGuard path="/app/security/assets/new"><AddAsset /></AccessGuard>} />
        <Route path="security/assets/:id/edit" element={<AccessGuard path="/app/security/assets/:id/edit"><AddAsset /></AccessGuard>} />
        <Route path="security/assets/:id/assign" element={<AccessGuard path="/app/security/assets/:id/assign"><AssignAsset /></AccessGuard>} />
        <Route path="security/assets/issue" element={<AccessGuard path="/app/security/assets/issue"><AssetAssignment /></AccessGuard>} />
        <Route path="security/assets/dispose" element={<AccessGuard path="/app/security/assets/dispose"><AssetDisposal /></AccessGuard>} />
        <Route path="security/assets/transfer" element={<AccessGuard path="/app/security/assets/transfer"><AssetTransfer /></AccessGuard>} />
        <Route path="security/assets/transfer/:id" element={<AccessGuard path="/app/security/assets/transfer/:id"><AssetTransferForm /></AccessGuard>} />
        <Route path="security/assets/repair" element={<AccessGuard path="/app/security/assets/repair"><AssetRepair /></AccessGuard>} />
        <Route path="security/asset-catalog" element={<AccessGuard path="/app/security/asset-catalog"><AssetCatalog /></AccessGuard>} />
        <Route path="security/guards" element={<AccessGuard path="/app/security/guards"><GuardDatabase /></AccessGuard>} />
        <Route path="security/past-guards" element={<AccessGuard path="/app/security/past-guards"><PastGuards /></AccessGuard>} />
        <Route path="security/guards/new" element={<AccessGuard path="/app/security/guards/new"><AddGuard /></AccessGuard>} />
        <Route path="security/guards/:id/edit" element={<AccessGuard path="/app/security/guards/:id/edit"><AddGuard /></AccessGuard>} />
        <Route path="security/attendance" element={<AccessGuard path="/app/security/attendance"><AttendanceMaster /></AccessGuard>} />
        <Route path="security/attendance/:id" element={<AccessGuard path="/app/security/attendance/:id"><AttendanceShiftPage /></AccessGuard>} />
        <Route path="security/sites" element={<AccessGuard path="/app/security/sites"><LocationsManagement /></AccessGuard>} />
        <Route path="security/locations/new" element={<AccessGuard path="/app/security/locations/new"><AddLocation /></AccessGuard>} />
        <Route path="security/locations/:id/edit" element={<AccessGuard path="/app/security/locations/:id/edit"><AddLocation /></AccessGuard>} />
        <Route path="security/billing" element={<AccessGuard path="/app/security/billing"><SecurityBilling /></AccessGuard>} />
        <Route path="security/cctv" element={<AccessGuard path="/app/security/cctv"><CctvSurveillance /></AccessGuard>} />
        <Route path="security/cctv/wall" element={<AccessGuard path="/app/security/cctv/wall"><CctvWall /></AccessGuard>} />
        <Route path="security/cctv/live" element={<AccessGuard path="/app/security/cctv/live"><LiveCoverage /></AccessGuard>} />
        <Route path="security/cctv/devices" element={<AccessGuard path="/app/security/cctv/devices"><CctvDevicesPage /></AccessGuard>} />
        <Route path="security/cctv/connections" element={<AccessGuard path="/app/security/cctv/connections"><SmartPssConnections /></AccessGuard>} />
        <Route path="security/*" element={<Dashboard />} />

        <Route path="real-estate/dashboard" element={<AccessGuard path="/app/real-estate/dashboard"><DashboardRealEstate /></AccessGuard>} />
        <Route path="real-estate/ledger" element={<AccessGuard path="/app/real-estate/ledger"><HakikaLedger /></AccessGuard>} />
        <Route path="real-estate/total-employees" element={<Navigate to="/app/real-estate/dashboard" replace />} />
        <Route path="real-estate/properties" element={<AccessGuard path="/app/real-estate/properties"><Properties /></AccessGuard>} />
        <Route path="real-estate/properties/:id" element={<AccessGuard path="/app/real-estate/properties/:id"><PropertyDetails /></AccessGuard>} />
        <Route path="real-estate/houses" element={<AccessGuard path="/app/real-estate/houses"><HousesUnits /></AccessGuard>} />
        <Route path="real-estate/units/add" element={<AccessGuard path="/app/real-estate/units/add"><AddUnitPage /></AccessGuard>} />
        <Route path="real-estate/units" element={<AccessGuard path="/app/real-estate/units"><HousesUnits /></AccessGuard>} />
        <Route path="real-estate/notes" element={<AccessGuard path="/app/real-estate/notes"><NotesFindings /></AccessGuard>} />
        <Route path="real-estate/tenants" element={<AccessGuard path="/app/real-estate/tenants"><TenantManagement /></AccessGuard>} />
        <Route path="real-estate/tenants/:tenantId/profile" element={<AccessGuard path="/app/real-estate/tenants/:tenantId/profile"><TenantProfilePage /></AccessGuard>} />
        <Route path="real-estate/tenants/:tenantId/portal" element={<AccessGuard path="/app/real-estate/tenants/:tenantId/portal"><TenantPortalDetailsPage /></AccessGuard>} />
        <Route path="real-estate/management/landlords/:landlordId/portal" element={<AccessGuard path="/app/real-estate/management/landlords/:landlordId/portal"><LandlordPortalDetailsPage /></AccessGuard>} />
        <Route path="tenant/dashboard" element={<AccessGuard path="/app/tenant/dashboard"><TenantDashboardPage /></AccessGuard>} />
        <Route path="caretaker/dashboard" element={<AccessGuard path="/app/caretaker/dashboard"><CaretakerDashboardPage /></AccessGuard>} />
        <Route path="tenant/profile" element={<TenantPortalProfilePage />} />
        <Route path="real-estate/leases" element={<AccessGuard path="/app/real-estate/leases"><DigitalLeases /></AccessGuard>} />
        <Route path="real-estate/leases/:leaseId" element={<AccessGuard path="/app/real-estate/leases"><LeaseDetailPage /></AccessGuard>} />
        <Route path="real-estate/maintenance" element={<AccessGuard path="/app/real-estate/maintenance"><MaintenanceRequest /></AccessGuard>} />
        <Route path="real-estate/invoice" element={<AccessGuard path="/app/real-estate/invoice"><InvoiceOverview /></AccessGuard>} />
        <Route path="real-estate/invoice/types" element={<AccessGuard path="/app/real-estate/invoice/types"><InvoiceTypesPage /></AccessGuard>} />
        <Route path="real-estate/invoice/deleted" element={<AccessGuard path="/app/real-estate/invoice/deleted"><DeletedInvoicesPage /></AccessGuard>} />
        <Route path="real-estate/invoice/list" element={<AccessGuard path="/app/real-estate/invoice/list"><InvoiceList /></AccessGuard>} />
        <Route path="real-estate/invoice/auto-billing" element={<AccessGuard path="/app/real-estate/invoice/auto-billing"><AutoBilling /></AccessGuard>} />
        <Route path="real-estate/invoice/auto-billing/:id" element={<AccessGuard path="/app/real-estate/invoice/auto-billing/:id"><AutoBillingPropertyDetail /></AccessGuard>} />
        <Route path="/invoice/:token" element={<PublicInvoicePage />} />
        <Route path="real-estate/invoice/add-item" element={<AccessGuard path="/app/real-estate/invoice/add-item"><AddInvoiceItem /></AccessGuard>} />
        <Route path="real-estate/invoice/arrears" element={<AccessGuard path="/app/real-estate/invoice/arrears"><ArrearsManagement /></AccessGuard>} />
        <Route path="real-estate/invoice/penalties" element={<AccessGuard path="/app/real-estate/invoice/penalties"><PenaltiesManagement /></AccessGuard>} />
        <Route path="real-estate/invoice/kra" element={<AccessGuard path="/app/real-estate/invoice/kra"><KRAeTims /></AccessGuard>} />
        <Route path="real-estate/split-management" element={<AccessGuard path="/app/real-estate/split-management"><SplitPayment /></AccessGuard>} />
        <Route path="real-estate/split-management/queue" element={<AccessGuard path="/app/real-estate/split-management/queue"><HakikaPayoutQueue /></AccessGuard>} />
        <Route path="real-estate/split-management/history" element={<AccessGuard path="/app/real-estate/split-management/history"><HakikaPayoutHistory /></AccessGuard>} />
        <Route path="real-estate/split-management/split-audit" element={<AccessGuard path="/app/real-estate/split-management/split-audit"><HakikaSplitAudit /></AccessGuard>} />
        <Route path="real-estate/split-management/legacy" element={<AccessGuard path="/app/real-estate/split-management/legacy"><HakikaPayoutControl /></AccessGuard>} />
        <Route path="real-estate/split-management/bank-join" element={<AccessGuard path="/app/real-estate/split-management/bank-join"><HakikaBankJoin /></AccessGuard>} />
        <Route path="real-estate/payments/mpesa" element={<AccessGuard path="/app/real-estate/payments/mpesa"><MpesaTransactions /></AccessGuard>} />
        <Route path="real-estate/payments/manual" element={<AccessGuard path="/app/real-estate/payments/manual"><ManualPayments /></AccessGuard>} />
        <Route path="real-estate/payments/pesalink" element={<AccessGuard path="/app/real-estate/payments/pesalink"><PesalinkTransactions /></AccessGuard>} />
        <Route path="real-estate/reconciliation" element={<AccessGuard path="/app/real-estate/reconciliation"><HakikaReconciliation /></AccessGuard>} />
        <Route path="real-estate/bill-water/add-bill" element={<AccessGuard path="/app/real-estate/bill-water/add-bill"><AddWaterBill /></AccessGuard>} />
        <Route path="real-estate/bill-water/billing-summary" element={<AccessGuard path="/app/real-estate/bill-water/billing-summary"><WaterBillingSummary /></AccessGuard>} />
        <Route path="real-estate/bill-power/meter-recordings" element={<AccessGuard path="/app/real-estate/bill-power/meter-recordings"><MeterReadings /></AccessGuard>} />
        <Route path="real-estate/bill-power/postpaid-meters" element={<AccessGuard path="/app/real-estate/bill-power/postpaid-meters"><PostpaidMeters /></AccessGuard>} />
        <Route path="real-estate/bill-power/configure-houses" element={<AccessGuard path="/app/real-estate/bill-power/configure-houses"><ConfigureHouses /></AccessGuard>} />
        <Route path="real-estate/reports/statement-of-rent" element={<AccessGuard path="/app/real-estate/reports/statement-of-rent"><StatementOfRent /></AccessGuard>} />
        <Route path="real-estate/reports/tenant-ledger" element={<AccessGuard path="/app/real-estate/reports/tenant-ledger"><TenantLedgerPage /></AccessGuard>} />
        <Route path="real-estate/reports/payment-reference" element={<AccessGuard path="/app/real-estate/reports/payment-reference"><PaymentReference /></AccessGuard>} />
        <Route path="real-estate/reports/water-consumption" element={<AccessGuard path="/app/real-estate/reports/water-consumption"><WaterConsumptionReport /></AccessGuard>} />
        <Route path="real-estate/reports/arrears" element={<AccessGuard path="/app/real-estate/reports/arrears"><ArrearsReport /></AccessGuard>} />
        <Route path="real-estate/reports/expenses" element={<AccessGuard path="/app/real-estate/reports/expenses"><ExpenseReport /></AccessGuard>} />
        <Route path="real-estate/yield" element={<AccessGuard path="/app/real-estate/yield"><FinancialYield /></AccessGuard>} />
        <Route path="real-estate/communication/vacating-notices" element={<AccessGuard path="/app/real-estate/communication/vacating-notices"><VacatingNotices /></AccessGuard>} />
        <Route path="real-estate/communication/maintenance" element={<AccessGuard path="/app/real-estate/communication/maintenance"><MaintenanceCommunication /></AccessGuard>} />
        <Route path="real-estate/communication/lease-documents" element={<AccessGuard path="/app/real-estate/communication/lease-documents"><LeaseDocumentsComm /></AccessGuard>} />
        <Route path="real-estate/communication/hub" element={<AccessGuard path="/app/real-estate/communication/hub"><SmsCommunication /></AccessGuard>} />
        <Route path="real-estate/communication/email" element={<Navigate to="/app/real-estate/communication/hub" replace />} />
        <Route path="real-estate/communication/sms" element={<Navigate to="/app/real-estate/communication/hub" replace />} />
        <Route path="real-estate/management/caretakers" element={<AccessGuard path="/app/real-estate/management/caretakers"><CaretakersManagement /></AccessGuard>} />
        <Route path="real-estate/management/landlords" element={<AccessGuard path="/app/real-estate/management/landlords"><LandlordsManagement /></AccessGuard>} />
        <Route path="real-estate/deleted/:kind" element={<AccessGuard path="/app/real-estate/deleted/:kind"><DeletedRealEstateRecords /></AccessGuard>} />
        <Route path="real-estate/assets" element={<AccessGuard path="/app/real-estate/assets"><AssetInventory /></AccessGuard>} />
        <Route path="real-estate/assets/management" element={<AccessGuard path="/app/real-estate/assets/management"><AssetInventory /></AccessGuard>} />
        <Route path="real-estate/assets/tracking" element={<AccessGuard path="/app/real-estate/assets/tracking"><AssetTracking /></AccessGuard>} />
        <Route path="real-estate/units/:unitId/assets" element={<AccessGuard path="/app/real-estate/units/:unitId/assets"><UnitAssetInventory /></AccessGuard>} />
        <Route path="real-estate/tenant-assets/:propertyId" element={<AccessGuard path="/app/real-estate/tenant-assets/:propertyId"><TenantAssetAssignmentPage /></AccessGuard>} />
        <Route path="real-estate/tenant-asset-assign/:propertyId" element={<AccessGuard path="/app/real-estate/tenant-asset-assign/:propertyId"><AssignAssetToTenantPage /></AccessGuard>} />
        <Route path="real-estate/marketing" element={<Navigate to="/app/real-estate/dashboard" replace />} />
        <Route path="real-estate/inspections" element={<AccessGuard path="/app/real-estate/inspections"><InspectionReports /></AccessGuard>} />
        <Route path="real-estate/assets/add" element={<AccessGuard path="/app/real-estate/assets/add"><REAddAsset /></AccessGuard>} />
        <Route path="real-estate/add-asset" element={<Navigate to="/app/real-estate/assets/add" replace />} />
        <Route path="real-estate/*" element={<DashboardRealEstate />} />

        <Route path="rock-of-ages/dashboard" element={<AccessGuard path="/app/rock-of-ages/dashboard"><DashboardRockOfAges /></AccessGuard>} />
        <Route path="rock-of-ages/members" element={<AccessGuard path="/app/rock-of-ages/members"><RockOfAgesMembersPage /></AccessGuard>} />
        <Route path="rock-of-ages/finance" element={<AccessGuard path="/app/rock-of-ages/finance"><RockOfAgesFinancePage /></AccessGuard>} />
        <Route path="rock-of-ages/budget" element={<AccessGuard path="/app/rock-of-ages/budget"><RockOfAgesBudgetPage /></AccessGuard>} />
        <Route path="rock-of-ages/receipt" element={<AccessGuard path="/app/rock-of-ages/receipt"><RockOfAgesReceiptsPage /></AccessGuard>} />
        <Route path="rock-of-ages/payment" element={<AccessGuard path="/app/rock-of-ages/payment"><RockOfAgesPaymentsPage /></AccessGuard>} />
        <Route path="rock-of-ages/requisitions" element={<AccessGuard path="/app/rock-of-ages/requisitions"><RockOfAgesRequisitionsPage /></AccessGuard>} />
        <Route path="rock-of-ages/inventory" element={<AccessGuard path="/app/rock-of-ages/inventory"><RockOfAgesInventoryPage /></AccessGuard>} />
        <Route path="rock-of-ages/add-asset" element={<AccessGuard path="/app/rock-of-ages/add-asset"><ROAAddAsset /></AccessGuard>} />
        <Route path="rock-of-ages/events" element={<AccessGuard path="/app/rock-of-ages/events"><RockOfAgesEventsPage /></AccessGuard>} />
        <Route path="rock-of-ages/ministry-programs" element={<AccessGuard path="/app/rock-of-ages/ministry-programs"><RockOfAgesMinistryProgramsPage /></AccessGuard>} />
        <Route path="rock-of-ages/reports" element={<AccessGuard path="/app/rock-of-ages/reports"><RockOfAgesReportsPage /></AccessGuard>} />
        <Route path="rock-of-ages/user-management" element={<AccessGuard path="/app/rock-of-ages/user-management"><RockOfAgesUserManagementPage /></AccessGuard>} />
        <Route path="rock-of-ages/daily-devotion" element={<AccessGuard path="/app/rock-of-ages/daily-devotion"><RockOfAgesDailyDevotionPage /></AccessGuard>} />
        <Route path="rock-of-ages/profile" element={<AccessGuard path="/app/rock-of-ages/profile"><MyProfilePage /></AccessGuard>} />
        <Route path="rock-of-ages/*" element={<DashboardRockOfAges />} />
        <Route path="rock-of-ages/add-asset" element={<AccessGuard path="/app/rock-of-ages/add-asset"><ROAAddAsset /></AccessGuard>} />
        <Route path="rock-of-ages/profile" element={<AccessGuard path="/app/rock-of-ages/profile"><GenericPage module="Church Profile" /></AccessGuard>} />
        <Route path="rock-of-ages/*" element={<DashboardRockOfAges />} />

        <Route path="finance/dashboard" element={<AccessGuard path="/app/finance/dashboard"><FinanceDashboardAdmin /></AccessGuard>} />
        <Route path="finance/ledger" element={<AccessGuard path="/app/finance/ledger"><GlobalLedger /></AccessGuard>} />
        <Route path="finance/journal-entry" element={<AccessGuard path="/app/finance/journal-entry"><JournalEntryPage /></AccessGuard>} />
        <Route path="finance/bank-accounts" element={<AccessGuard path="/app/finance/bank-accounts"><BankAccounts /></AccessGuard>} />
        <Route path="finance/wallets" element={<AccessGuard path="/app/finance/wallets"><FinanceWallets /></AccessGuard>} />
        <Route path="finance/bank-connections" element={<AccessGuard path="/app/finance/bank-connections"><BankConnections /></AccessGuard>} />
        <Route path="finance/notes" element={<AccessGuard path="/app/finance/notes"><FinanceNotes /></AccessGuard>} />
        <Route path="finance/statements" element={<AccessGuard path="/app/finance/statements"><FinanceStatements /></AccessGuard>} />
        <Route path="finance/invoices" element={<AccessGuard path="/app/finance/invoices"><InvoicingCenter /></AccessGuard>} />
        <Route path="finance/payments" element={<AccessGuard path="/app/finance/payments"><FinancePayments /></AccessGuard>} />
        <Route path="finance/payments/manual-invoices/:invoiceId/edit" element={<AccessGuard path="/app/finance/payments/manual-invoices/:invoiceId/edit"><FinancePayments /></AccessGuard>} />
        <Route path="finance/payments/manual-deposits/:receiptId/edit" element={<AccessGuard path="/app/finance/payments/manual-deposits/:receiptId/edit"><FinancePayments /></AccessGuard>} />
        <Route path="finance/payee-manager" element={<AccessGuard path="/app/finance/payee-manager"><FinancePayeeManager /></AccessGuard>} />
        <Route path="finance/vendors" element={<AccessGuard path="/app/finance/vendors"><FinancePayeeManager /></AccessGuard>} />
        <Route path="finance/cost-centres" element={<AccessGuard path="/app/finance/cost-centres"><FinanceCostCentres /></AccessGuard>} />
        <Route path="finance/expense-groups" element={<AccessGuard path="/app/finance/expense-groups"><FinanceExpenseGroups /></AccessGuard>} />
        <Route path="finance/payment-vouchers" element={<AccessGuard path="/app/finance/payment-vouchers"><FinancePaymentVouchers /></AccessGuard>} />
        <Route path="finance/payment-options" element={<AccessGuard path="/app/finance/payment-options"><FinancePaymentOptions /></AccessGuard>} />
        <Route path="finance/expenses" element={<AccessGuard path="/app/finance/expenses"><FinanceRequisitions /></AccessGuard>} />
        <Route path="finance/expenses/bulk" element={<AccessGuard path="/app/finance/expenses/bulk"><FinanceRequisitions /></AccessGuard>} />
        <Route path="finance/reports/expense-receipts-arrears" element={<Navigate to="/app/finance/reports/expenses" replace />} />
        <Route path="finance/reports/expenses" element={<AccessGuard path="/app/finance/reports/expenses"><FinanceExpenseReport /></AccessGuard>} />
        <Route path="finance/reports/receipts" element={<AccessGuard path="/app/finance/reports/receipts"><FinanceReceiptsReport /></AccessGuard>} />
        <Route path="finance/reports/arrears" element={<AccessGuard path="/app/finance/reports/arrears"><FinanceArrearsReport /></AccessGuard>} />
        <Route path="finance/requisition-approvals" element={<AccessGuard path="/app/finance/requisition-approvals"><FinanceRequisitionApprovals /></AccessGuard>} />
        <Route path="finance/deleted-requisitions" element={<AccessGuard path="/app/finance/deleted-requisitions"><FinanceDeletedRequisitions /></AccessGuard>} />
        <Route path="finance/requisitions" element={<Navigate to="/app/finance/expenses" replace />} />
        <Route path="finance/reconciliation" element={<AccessGuard path="/app/finance/reconciliation"><Reconciliation /></AccessGuard>} />
        <Route path="finance/tax" element={<AccessGuard path="/app/finance/tax"><TaxReturns /></AccessGuard>} />
        <Route path="finance/audit" element={<AccessGuard path="/app/finance/audit"><FinanceAlerts /></AccessGuard>} />
        <Route path="finance/*" element={<FinanceDashboardAdmin />} />
          </Routes>
        </RouteSuspense>
      </ShellRouteBoundary>
    </Layout>
  );
};

const PlatformPreviewShell: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isApplication = location.pathname.includes('/app/platform-preview/apps/');
  return <PlatformLayout onLogout={onLogout}>
    <RouteSuspense label="Loading platform preview...">{isApplication ? <PlatformApplicationPreviewPage /> : location.pathname === '/app/platform-preview/applications' ? <PlatformApplicationsPage /> : location.pathname === '/app/platform-preview' && ENABLE_PLATFORM_OPERATIONS ? <PlatformOperationsPage /> : location.pathname.includes('/support-center') ? <SupportCenterPage /> : ['billing', 'subscriptions', 'plans', 'invoices', 'usage'].some((part) => location.pathname.endsWith(`/${part}`)) ? <PlatformBillingPage /> : location.pathname.endsWith('/platform-validation') ? <PlatformValidationPage /> : location.pathname.endsWith('/workflow-orchestrator') ? <WorkflowOrchestratorPage /> : location.pathname.endsWith('/platform-bus') ? <PlatformBusPage /> : <PlatformPreviewPage />}</RouteSuspense>
  </PlatformLayout>;
};

const PlatformWorkspaceShell: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const identitySections = ['identity', 'users', 'roles', 'permissions', 'access-groups', 'application-access', 'dashboard-access', 'credentials', 'security', 'sessions'];
  const isIdentity = identitySections.some((section) => location.pathname.includes(`/platform/${section}`));
  const isHealth = location.pathname.endsWith('/platform-preview/health');
  const isAnalytics = location.pathname.endsWith('/platform-preview/analytics');
  const isApplications = location.pathname.endsWith('/platform-preview/applications');
  const isWorkflows = location.pathname.includes('/platform-preview/workflows');
  const isNotifications = location.pathname.includes('/platform-preview/notifications');
  const isIntegrations = location.pathname.includes('/platform-preview/integrations');
  const isApplication = location.pathname.includes('/platform-preview/apps/');
  const hostedPage = location.pathname === '/app/platform/overview' ? <AdminOverviewPage />
    : location.pathname === '/app/platform/companies' ? <AdminCompaniesPage />
    : location.pathname === '/app/platform/subscriptions' ? <ServiceSubscriptionsPage />
    : location.pathname === '/app/platform/billing' ? <ServiceBillingPage />
    : location.pathname === '/app/platform/payments' ? <ServicePaymentsPage />
    : location.pathname === '/app/platform/roles' ? <RoleManagementPage />
    : location.pathname === '/app/platform/permissions' ? <ModulePermissionSummaryPage />
    : location.pathname === '/app/platform/admins' ? <AdminsPage />
    : location.pathname === '/app/platform/directors' ? <DirectorsPage />
    : location.pathname === '/app/platform/logs' ? <SystemLogsPage />
    : location.pathname === '/app/platform/support' ? <ContactInboxPage />
    : location.pathname === '/app/platform/messaging' ? <MessagingTestPage />
    : location.pathname === '/app/platform/communication-history' ? <CommunicationHistoryPage />
    : location.pathname === '/app/platform/debug' ? <SupabaseDebug />
    : location.pathname === '/app/platform/restore' ? <BackupRestoreAdmin />
    : location.pathname === '/app/platform/migration-health' ? <MigrationHealthPage />
    : location.pathname === '/app/platform/page-visibility' ? <PageVisibilityManagement />
    : location.pathname === '/app/platform/pricing' ? <ServicePricingPage />
    : location.pathname === '/app/platform/service-overview' ? <ServiceOverviewPage />
    : null;
  return <PlatformLayout onLogout={onLogout}>
    <RouteSuspense label="Loading platform administration...">{hostedPage || (isHealth ? <PlatformHealthPage /> : isAnalytics ? <PlatformAnalyticsPage /> : isApplications ? <PlatformApplicationsPage /> : isWorkflows ? <PlatformWorkflowsPage /> : isNotifications ? <PlatformNotificationsPage /> : isIntegrations ? <PlatformIntegrationsPage /> : isApplication ? <PlatformApplicationPreviewPage /> : isIdentity ? <PlatformIdentityPage /> : <PlatformWorkspacePage />)}</RouteSuspense>
  </PlatformLayout>;
};

const PlatformHostedApplicationShell: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTail = location.pathname.includes('/apps/') ? location.pathname.split('/apps/')[1] : location.pathname.split('/app/')[1];
  const rawSlug = routeTail?.split('/')[0] || '';
  const slug = rawSlug === 'security' ? 'toughforce' : rawSlug;
  const appPath = routeTail?.split('/').slice(1).join('/') || 'dashboard';
  const section = appPath.split('/')[0] || 'dashboard';
  const existingPage = slug === 'real-estate' && appPath === 'dashboard' ? <DashboardRealEstate />
    : slug === 'real-estate' && appPath === 'invoice/list' ? <InvoiceList />
    : slug === 'real-estate' && appPath === 'invoice/types' ? <InvoiceTypesPage />
    : slug === 'real-estate' && appPath === 'invoice/deleted' ? <DeletedInvoicesPage />
    : slug === 'real-estate' && appPath === 'invoice/auto-billing' ? <AutoBilling />
    : slug === 'real-estate' && appPath === 'split-management/queue' ? <HakikaPayoutQueue />
    : slug === 'real-estate' && appPath === 'split-management/history' ? <HakikaPayoutHistory />
    : slug === 'real-estate' && appPath === 'split-management/split-audit' ? <HakikaSplitAudit />
    : slug === 'real-estate' && appPath === 'payments/mpesa' ? <MpesaTransactions />
    : slug === 'real-estate' && appPath === 'payments/pesalink' ? <PesalinkTransactions />
    : slug === 'real-estate' && appPath === 'bill-water/billing-summary' ? <WaterBillingSummary />
    : slug === 'real-estate' && appPath === 'bill-power/meter-recordings' ? <MeterReadings />
    : slug === 'real-estate' && appPath === 'bill-power/postpaid-meters' ? <PostpaidMeters />
    : slug === 'real-estate' && appPath === 'reports/tenant-ledger' ? <TenantLedgerPage />
    : slug === 'real-estate' && appPath === 'reports/water-consumption' ? <WaterConsumptionReport />
    : slug === 'real-estate' && appPath === 'reports/arrears' ? <ArrearsReport />
    : slug === 'real-estate' && appPath === 'reports/expenses' ? <ExpenseReport />
    : slug === 'real-estate' && appPath === 'communication/hub' ? <SmsCommunication />
    : slug === 'real-estate' && appPath === 'management/caretakers' ? <CaretakersManagement />
    : slug === 'real-estate' && appPath === 'management/landlords' ? <LandlordsManagement />
    : slug === 'real-estate' && section === 'dashboard' ? <DashboardRealEstate />
    : slug === 'real-estate' && section === 'properties' ? <Properties />
    : slug === 'real-estate' && section === 'houses' ? <HousesUnits />
    : slug === 'real-estate' && section === 'units' ? <HousesUnits />
    : slug === 'real-estate' && section === 'tenants' ? <TenantManagement />
    : slug === 'real-estate' && section === 'leases' ? <DigitalLeases />
    : slug === 'real-estate' && section === 'maintenance' ? <MaintenanceRequest />
    : slug === 'real-estate' && section === 'ledger' ? <HakikaLedger />
    : slug === 'real-estate' && section === 'invoice' ? <InvoiceOverview />
    : slug === 'real-estate' && section === 'payments' ? <ManualPayments />
    : slug === 'real-estate' && section === 'reconciliation' ? <HakikaReconciliation />
    : slug === 'real-estate' && section === 'reports' ? <StatementOfRent />
    : slug === 'real-estate' && section === 'assets' ? <AssetInventory />
    : slug === 'finance' && appPath === 'dashboard' ? <FinanceDashboardAdmin />
    : slug === 'finance' && appPath === 'bank-connections' ? <BankConnections />
    : slug === 'finance' && appPath === 'notes' ? <FinanceNotes />
    : slug === 'finance' && appPath === 'statements' ? <FinanceStatements />
    : slug === 'finance' && appPath === 'payee-manager' ? <FinancePayeeManager />
    : slug === 'finance' && appPath === 'cost-centres' ? <FinanceCostCentres />
    : slug === 'finance' && appPath === 'expense-groups' ? <FinanceExpenseGroups />
    : slug === 'finance' && appPath === 'payment-vouchers' ? <FinancePaymentVouchers />
    : slug === 'finance' && appPath === 'payment-options' ? <FinancePaymentOptions />
    : slug === 'finance' && appPath === 'reports/expenses' ? <FinanceExpenseReport />
    : slug === 'finance' && appPath === 'reports/receipts' ? <FinanceReceiptsReport />
    : slug === 'finance' && appPath === 'reports/arrears' ? <FinanceArrearsReport />
    : slug === 'finance' && appPath === 'requisition-approvals' ? <FinanceRequisitionApprovals />
    : slug === 'finance' && appPath === 'deleted-requisitions' ? <FinanceDeletedRequisitions />
    : slug === 'finance' && section === 'dashboard' ? <FinanceDashboardAdmin />
    : slug === 'finance' && section === 'ledger' ? <GlobalLedger />
    : slug === 'finance' && section === 'journal-entry' ? <JournalEntryPage />
    : slug === 'finance' && section === 'bank-accounts' ? <BankAccounts />
    : slug === 'finance' && section === 'wallets' ? <FinanceWallets />
    : slug === 'finance' && section === 'invoices' ? <InvoicingCenter />
    : slug === 'finance' && section === 'payments' ? <FinancePayments />
    : slug === 'finance' && section === 'expenses' ? <FinanceRequisitions />
    : slug === 'finance' && section === 'reconciliation' ? <Reconciliation />
    : slug === 'hr' && section === 'dashboard' ? <Dashboard />
    : slug === 'hr' && section === 'employee-directory' ? <TotalEmployees />
    : slug === 'hr' && section === 'add-employee' ? <AddEmployee />
    : slug === 'hr' && section === 'payroll' ? <PayrollOverview />
    : slug === 'hr' && section === 'recruitment' ? <Recruitment />
    : slug === 'hr' && section === 'leave' ? <LeaveManagement />
    : slug === 'toughforce' && section === 'dashboard' ? <Dashboard />
    : slug === 'toughforce' && section === 'guards' ? <GuardDatabase />
    : slug === 'toughforce' && section === 'workforce' ? <WorkforceHub />
    : slug === 'toughforce' && section === 'incidents' ? <IncidentReporting />
    : slug === 'toughforce' && section === 'patrols' ? <PatrolTracking />
    : slug === 'toughforce' && section === 'assets' ? <AssetManagement />
    : slug === 'toughforce' && section === 'cctv' ? <CctvSurveillance />
    : null;
  const applicationModule: ModuleType = slug === 'finance' ? 'FINANCE' : slug === 'hr' ? 'HR' : slug === 'toughforce' ? 'SECURITY' : 'REAL_ESTATE';
  if (existingPage) {
    return <Layout currentModule={applicationModule} onModuleChange={(module) => navigate(getModuleLandingPath(module))} onLogout={onLogout}>
      <RouteSuspense label="Loading application page...">{existingPage}</RouteSuspense>
    </Layout>;
  }
  return <PlatformLayout onLogout={onLogout}><RouteSuspense label="Loading application page..."><PlatformApplicationPreviewPage /></RouteSuspense></PlatformLayout>;
};

// Top Level Router Structure
const PublicServiceRedirect: React.FC<{ moduleSlug: 'hr' | 'security' | 'real-estate' }> = ({ moduleSlug }) => (
  <Navigate to={`/services/${moduleSlug}`} replace />
);

const PlatformPreviewEntry: React.FC = () => {
  return <LandingPage />;
};

const PlatformPortApplicationGate: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  return <AppContent onLogout={onLogout} />;
};

const AppBootstrapper: React.FC<{
  onLogout: () => void;
}> = ({ onLogout }) => {
  return (
    <Router>
      <AnalyticsProvider>
        <Routes>
          <Route path="/" element={<PlatformPreviewEntry />} />
          <Route path="/services" element={<PublicLayout onLogout={onLogout}><ServiceMarketplace /></PublicLayout>} />
          <Route path="/services-old" element={<PublicLayout onLogout={onLogout}><ServicesPage /></PublicLayout>} />
          <Route path="/services/:moduleSlug" element={<PublicLayout onLogout={onLogout}><ServiceDetailPage /></PublicLayout>} />
          <Route path="/hr" element={<PublicServiceRedirect moduleSlug="hr" />} />
          <Route path="/security" element={<PublicServiceRedirect moduleSlug="security" />} />
          <Route path="/real-estate" element={<PublicServiceRedirect moduleSlug="real-estate" />} />
          <Route path="/pricing" element={<PublicLayout onLogout={onLogout}><PricingPage /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout onLogout={onLogout}><ContactPage /></PublicLayout>} />
          <Route path="/request-rental" element={<PublicLayout onLogout={onLogout}><RequestRentalPage /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout onLogout={onLogout}><AboutPage /></PublicLayout>} />
          <Route path="/careers" element={<PublicLayout onLogout={onLogout}><CareersPage /></PublicLayout>} />
          <Route path="/press" element={<PublicLayout onLogout={onLogout}><PressPage /></PublicLayout>} />
          <Route path="/contact-developer" element={<ContactDeveloperPage />} />
          <Route path="/privacy" element={<PublicLayout onLogout={onLogout}><PrivacyPolicy /></PublicLayout>} />
          <Route path="/terms" element={<PublicLayout onLogout={onLogout}><TermsOfService /></PublicLayout>} />
          <Route path="/cookies" element={<PublicLayout onLogout={onLogout}><CookiePolicy /></PublicLayout>} />
          <Route path="/security-audit" element={<PublicLayout onLogout={onLogout}><SecurityAudit /></PublicLayout>} />

          <Route path="/verify-invoice" element={<ETimsVerification />} />
          <Route path="/resources" element={<PublicLayout onLogout={onLogout}><ResourcesPage /></PublicLayout>} />
          <Route path="/resources/:slug" element={<PublicLayout onLogout={onLogout}><BlogPost /></PublicLayout>} />

          <Route path="/portal" element={<PortalLogin />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-2fa" element={<TwoFactorVerification />} />

          <Route path="/app/tenant/*" element={
            <ProtectedRoute>
              <TenantAppContent />
            </ProtectedRoute>
          } />

          <Route path="/app/landlord/*" element={
            <ProtectedRoute>
              <LandlordAppContent />
            </ProtectedRoute>
          } />

          <Route path="/admin/*" element={
            <ProtectedRoute>
              <AdminContent onLogout={onLogout} />
            </ProtectedRoute>
          } />

          <Route path="/app/platform-preview/organizations/:id" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/platform-validation" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/workflow-orchestrator" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/platform-bus" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/:section?" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/workflows/:section?" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/notifications/:section?" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/integrations/:section?" element={<PlatformPreviewShell onLogout={onLogout} />} />
          <Route path="/app/platform-preview/apps/:slug/:section?" element={<PlatformHostedApplicationShell onLogout={onLogout} />} />
          <Route path="/app/platform/:section?/:id?" element={<PlatformWorkspaceShell onLogout={onLogout} />} />

          <Route path="/app/real-estate/*" element={<PlatformPortApplicationGate onLogout={onLogout} />} />
          <Route path="/app/finance/*" element={<PlatformPortApplicationGate onLogout={onLogout} />} />
          <Route path="/app/hr/*" element={<PlatformPortApplicationGate onLogout={onLogout} />} />
          <Route path="/app/security/*" element={<PlatformPortApplicationGate onLogout={onLogout} />} />

          <Route path="/app/*" element={
            <ProtectedRoute>
              <AppContent onLogout={onLogout} />
            </ProtectedRoute>
          } />

          {/* Guard Mobile App Routes */}
          <Route path="/guard/dashboard" element={
            <ProtectedRoute>
              <RouteSuspense label="Loading dashboard...">
                <GuardDashboardPage />
              </RouteSuspense>
            </ProtectedRoute>
          } />

          <Route path="/guard/shift/:shiftId" element={
            <ProtectedRoute>
              <RouteSuspense label="Loading shift details...">
                <GenericPage module="guard" />
              </RouteSuspense>
            </ProtectedRoute>
          } />

          <Route path="/guard/shift/:shiftId/check-in" element={
            <ProtectedRoute>
              <RouteSuspense label="Loading check-in...">
                <GuardCheckInPage />
              </RouteSuspense>
            </ProtectedRoute>
          } />

          <Route path="/guard/shift/:shiftId/check-out" element={
            <ProtectedRoute>
              <RouteSuspense label="Loading check-out...">
                <GuardCheckOutPage />
              </RouteSuspense>
            </ProtectedRoute>
          } />

          <Route path="/guard/shifts" element={
            <ProtectedRoute>
              <RouteSuspense label="Loading shifts...">
                <GuardShiftsPage />
              </RouteSuspense>
            </ProtectedRoute>
          } />

          <Route path="/guard/attendance" element={
            <ProtectedRoute>
              <RouteSuspense label="Loading attendance...">
                <GuardAttendancePage />
              </RouteSuspense>
            </ProtectedRoute>
          } />

          <Route path="/guard/notifications" element={
            <ProtectedRoute>
              <RouteSuspense label="Loading notifications...">
                <GuardNotificationsPage />
              </RouteSuspense>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnalyticsProvider>
    </Router>
  );
};

const App: React.FC = () => {
  const handleLogout = useCallback(async () => {
    console.log("App: handleLogout triggered");
    activityLogger.logAuth('logout');
    await supabase.auth.signOut();
    localStorage.removeItem('hakika_remember_identifier');
    localStorage.removeItem('hakika_remember_me');

    window.location.href = '/';
  }, []);

  return (
    <WorkspaceProvider>
      <AccessProvider>
        <AppBootstrapper onLogout={handleLogout} />
      </AccessProvider>
    </WorkspaceProvider>
  );
};

export default App;
