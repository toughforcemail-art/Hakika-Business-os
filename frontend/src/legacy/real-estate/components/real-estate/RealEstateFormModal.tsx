import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../utils/supabase';

// ─── Table map ───────────────────────────────────────────────────────────────
const TABLE_MAP: Record<string, string> = {
  'Property':            're_properties',
  'House / Unit':        're_units',
  'Tenant':              're_tenants',
  'Lease':               're_leases',
  'Payment':             're_payments',
  'Maintenance Request': 're_maintenance',
  'Power Bill':          're_bills_power',
  'Water Bill':          're_bills_water',
  'Yield Record':        're_financial_yield',
  'Reconciliation':      're_reconciliation',
  'Invoice':             're_invoices',
  'Report':              're_reports',
  'Campaign':            're_marketing_campaigns',
  'Staff Member':        're_personnel',
  'Message':             're_communication',
  'Onboarding':          're_self_onboarding',
};

// ─── Field definitions per entity type ──────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

const FIELDS: Record<string, FieldDef[]> = {
  'Property': [
    { key: 'name',          label: 'Property Name',  type: 'text',   required: true, placeholder: 'e.g. Riverside Apartments' },
    { key: 'address',       label: 'Address',         type: 'text',   placeholder: 'Full physical address' },
    { key: 'lra_number',    label: 'LRA Number (Plot No.)', type: 'text', placeholder: 'e.g. LRA 12345' },
    { key: 'county',        label: 'County',          type: 'text', placeholder: 'e.g. Nairobi' },
    { key: 'location',      label: 'Location',        type: 'text', placeholder: '' },
    { key: 'sublocation',   label: 'Sublocation',     type: 'text', placeholder: '' },
    { key: 'village',       label: 'Village',         type: 'text', placeholder: '' },
    { key: 'water_config',  label: 'Water Billing',   type: 'select', options: [
      { value: 'not_charged', label: 'Not Charged' }, { value: 'metered', label: 'Read from Meter' }, { value: 'fixed', label: 'Fixed Amount' }
    ]},
    { key: 'electricity_config', label: 'Electricity Billing', type: 'select', options: [
      { value: 'not_charged', label: 'Not Charged' }, { value: 'metered', label: 'Read from Meter' }, { value: 'fixed', label: 'Fixed Amount' }
    ]},
    { key: 'service_charge_garbage', label: 'Garbage Collection', type: 'select', options: [
      { value: 'not_charged', label: 'Not Charged' }, { value: 'fixed', label: 'Fixed Amount' }, { value: 'variable_per_unit', label: 'Different per unit' }
    ]},
    { key: 'service_charge_internet', label: 'Internet', type: 'select', options: [
      { value: 'not_charged', label: 'Not Charged' }, { value: 'fixed', label: 'Fixed Amount' }
    ]},
    { key: 'late_penalty_percentage', label: 'Late Penalty (%)', type: 'number', placeholder: '10' },
    { key: 'deposit_paid_to', label: 'Deposit Paid To', type: 'select', options: [
      { value: 'agent', label: 'Agent' }, { value: 'landlord', label: 'Landlord' }
    ]},
    { key: 'rent_paid_to', label: 'Rent Paid To', type: 'select', options: [
      { value: 'agent', label: 'Agent' }, { value: 'landlord', label: 'Landlord' }
    ]},
    { key: 'property_type', label: 'Type',            type: 'select', options: [
      { value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' },
      { value: 'mixed', label: 'Mixed Use' },
    ]},
    { key: 'total_bedrooms', label: 'Total Bedrooms', type: 'number', placeholder: '0' },
    { key: 'components', label: 'Property Components (Features)', type: 'textarea', placeholder: 'e.g. Swimming Pool, Gym, Garden (comma separated)' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
      { value: 'under_maintenance', label: 'Under Maintenance' },
    ]},
  ],
  'House / Unit': [
    { key: 'unit_number',  label: 'Unit Number',  type: 'text',   required: true, placeholder: 'e.g. A101' },
    { key: 'type',         label: 'Unit Type',    type: 'select', options: [
      { value: 'studio', label: 'Studio' }, { value: '1BR', label: '1 Bedroom' },
      { value: '2BR', label: '2 Bedrooms' }, { value: '3BR', label: '3 Bedrooms' },
      { value: 'penthouse', label: 'Penthouse' },
    ]},
    { key: 'rent_amount',  label: 'Rent (KES)',   type: 'number', required: true, placeholder: '0.00' },
    { key: 'status',       label: 'Status',       type: 'select', options: [
      { value: 'vacant', label: 'Vacant' }, { value: 'occupied', label: 'Occupied' },
      { value: 'under_maintenance', label: 'Under Maintenance' },
    ]},
    { key: 'bedrooms',     label: 'Bedrooms',     type: 'number', placeholder: '1' },
    { key: 'floor_number', label: 'Floor Number', type: 'number', placeholder: '0' },
    { key: 'size_sqft',    label: 'Size (sqft)',  type: 'number', placeholder: '0' },
  ],
  'Tenant': [
    { key: 'full_name',         label: 'Full Name',         type: 'text',   required: true, placeholder: 'John Doe' },
    { key: 'email',             label: 'Email Address',     type: 'text',   placeholder: 'john@example.com' },
    { key: 'phone',             label: 'Phone Number',      type: 'text',   placeholder: '+254 7XX XXX XXX' },
    { key: 'national_id',       label: 'National ID',       type: 'text',   placeholder: '12345678' },
    { key: 'emergency_contact', label: 'Emergency Contact', type: 'text',   placeholder: 'Name & phone' },
  ],
  'Lease': [
    { key: 'rent_amount',    label: 'Monthly Rent (KES)',  type: 'number', required: true, placeholder: '0.00' },
    { key: 'deposit_amount', label: 'Deposit (KES)',       type: 'number', placeholder: '0.00' },
    { key: 'start_date',     label: 'Lease Start Date',    type: 'date',   required: true },
    { key: 'end_date',       label: 'Lease End Date',      type: 'date',   required: false },

    { key: 'payment_day',    label: 'Payment Day of Month',type: 'number', placeholder: '1' },
    { key: 'status',         label: 'Status',              type: 'select', options: [
      { value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' },
      { value: 'expired', label: 'Expired' }, { value: 'terminated', label: 'Terminated' },
    ]},
    { key: 'terms', label: 'Terms & Notes', type: 'textarea', placeholder: 'Lease terms and special conditions...' },
  ],
  'Payment': [
    { key: 'amount',           label: 'Amount (KES)',     type: 'number', required: true, placeholder: '0.00' },
    { key: 'payment_type',     label: 'Payment Type',     type: 'select', options: [
      { value: 'rent', label: 'Rent' }, { value: 'deposit', label: 'Deposit' },
      { value: 'penalty', label: 'Penalty' }, { value: 'utility', label: 'Utility' },
    ]},
    { key: 'payment_method',   label: 'Payment Method',   type: 'select', options: [
      { value: 'mpesa', label: 'M-Pesa' }, { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' },
    ]},
    { key: 'reference_number', label: 'Reference Number', type: 'text', placeholder: 'e.g. QH3XKZJ12' },
    { key: 'payment_date',     label: 'Payment Date',     type: 'date', required: true },
    { key: 'notes',            label: 'Notes',            type: 'textarea', placeholder: 'Additional payment notes...' },
  ],
  'Maintenance Request': [
    { key: 'title',       label: 'Issue Title',  type: 'text',     required: true, placeholder: 'e.g. Leaking pipe in bathroom' },
    { key: 'description', label: 'Description',  type: 'textarea', placeholder: 'Describe the issue in detail...' },
    { key: 'priority',    label: 'Priority',     type: 'select',   options: [
      { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }, { value: 'emergency', label: 'Emergency' },
    ]},
    { key: 'status',         label: 'Status',        type: 'select', options: [
      { value: 'open', label: 'Open' }, { value: 'approved', label: 'Approved' },
      { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' },
    ]},
    { key: 'cost_estimate',   label: 'Cost Estimate (KES)', type: 'number', placeholder: '0.00' },
    { key: 'scheduled_date',  label: 'Scheduled Date',      type: 'date' },
  ],
  'Power Bill': [
    { key: 'bill_month',           label: 'Bill Month',          type: 'date',   required: true },
    { key: 'meter_reading_open',   label: 'Opening Meter (kWh)', type: 'number', placeholder: '0.00' },
    { key: 'meter_reading_close',  label: 'Closing Meter (kWh)', type: 'number', placeholder: '0.00' },
    { key: 'units_consumed',       label: 'Units Consumed',      type: 'number', placeholder: '0.00' },
    { key: 'rate_per_unit',        label: 'Rate per Unit (KES)', type: 'number', placeholder: '0.00' },
    { key: 'amount_due',           label: 'Amount Due (KES)',    type: 'number', required: true, placeholder: '0.00' },
    { key: 'due_date',             label: 'Due Date',            type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Partial' },
      { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' },
    ]},
  ],
  'Water Bill': [
    { key: 'bill_month',           label: 'Bill Month',            type: 'date',   required: true },
    { key: 'meter_reading_open',   label: 'Opening Meter (m³)',    type: 'number', placeholder: '0.00' },
    { key: 'meter_reading_close',  label: 'Closing Meter (m³)',    type: 'number', placeholder: '0.00' },
    { key: 'units_consumed',       label: 'Units Consumed',        type: 'number', placeholder: '0.00' },
    { key: 'rate_per_unit',        label: 'Rate per Unit (KES)',   type: 'number', placeholder: '0.00' },
    { key: 'amount_due',           label: 'Amount Due (KES)',      type: 'number', required: true, placeholder: '0.00' },
    { key: 'due_date',             label: 'Due Date',              type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Partial' },
      { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' },
    ]},
  ],
  'Yield Record': [
    { key: 'period_label',   label: 'Period Label',       type: 'text',   required: true, placeholder: 'e.g. Q1 2026' },
    { key: 'period_start',   label: 'Period Start',       type: 'date',   required: true },
    { key: 'period_end',     label: 'Period End',         type: 'date',   required: true },
    { key: 'gross_income',   label: 'Gross Income (KES)', type: 'number', placeholder: '0.00' },
    { key: 'total_expenses', label: 'Total Expenses (KES)',type: 'number', placeholder: '0.00' },
    { key: 'property_value', label: 'Property Value (KES)',type: 'number', placeholder: '0.00' },
    { key: 'roi_percentage', label: 'ROI (%)',            type: 'number', placeholder: '0.00' },
    { key: 'notes',          label: 'Notes',              type: 'textarea', placeholder: 'Analysis notes...' },
  ],
  'Reconciliation': [
    { key: 'reference_number', label: 'Reference Number',   type: 'text', placeholder: 'REF-001' },
    { key: 'period_start',     label: 'Period Start',       type: 'date', required: true },
    { key: 'period_end',       label: 'Period End',         type: 'date', required: true },
    { key: 'expected_amount',  label: 'Expected (KES)',     type: 'number', placeholder: '0.00' },
    { key: 'actual_amount',    label: 'Actual (KES)',       type: 'number', placeholder: '0.00' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'pending', label: 'Pending' }, { value: 'matched', label: 'Matched' },
      { value: 'discrepancy', label: 'Discrepancy' }, { value: 'resolved', label: 'Resolved' },
    ]},
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Reconciliation notes...' },
  ],
  'Invoice': [
    { key: 'invoice_number', label: 'Invoice Number',    type: 'text',   placeholder: 'INV-001' },
    { key: 'amount_due',     label: 'Amount Due (KES)',  type: 'number', required: true, placeholder: '0.00' },
    { key: 'due_date',       label: 'Due Date',          type: 'date',   required: true },
    { key: 'invoice_date',   label: 'Invoice Date',      type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'draft', label: 'Draft' }, { value: 'unpaid', label: 'Unpaid' },
      { value: 'partial', label: 'Partial' }, { value: 'paid', label: 'Paid' },
      { value: 'overdue', label: 'Overdue' },
    ]},
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Invoice notes...' },
  ],
  'Report': [
    { key: 'title',        label: 'Report Title',  type: 'text',   required: true, placeholder: 'e.g. Monthly Occupancy Report' },
    { key: 'report_type',  label: 'Report Type',   type: 'select', options: [
      { value: 'summary', label: 'Summary' }, { value: 'financial', label: 'Financial' },
      { value: 'occupancy', label: 'Occupancy' }, { value: 'maintenance', label: 'Maintenance' },
      { value: 'custom', label: 'Custom' },
    ]},
    { key: 'period_start', label: 'Period Start',  type: 'date' },
    { key: 'period_end',   label: 'Period End',    type: 'date' },
    { key: 'description',  label: 'Description',   type: 'textarea', placeholder: 'Report details...' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' },
    ]},
  ],
  'Campaign': [
    { key: 'campaign_name',    label: 'Campaign Name',     type: 'text',   required: true, placeholder: 'e.g. January Listings Drive' },
    { key: 'campaign_type',    label: 'Campaign Type',     type: 'select', options: [
      { value: 'listing', label: 'Property Listing' }, { value: 'promotion', label: 'Promotion' },
      { value: 'social', label: 'Social Media' }, { value: 'email', label: 'Email Campaign' },
    ]},
    { key: 'target_audience',  label: 'Target Audience',   type: 'text',   placeholder: 'e.g. Young professionals, families' },
    { key: 'budget',           label: 'Budget (KES)',       type: 'number', placeholder: '0.00' },
    { key: 'start_date',       label: 'Start Date',        type: 'date' },
    { key: 'end_date',         label: 'End Date',          type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' }, { value: 'completed', label: 'Completed' },
    ]},
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Campaign details and goals...' },
  ],
  'Staff Member': [
    { key: 'full_name',   label: 'Full Name',   type: 'text',   required: true, placeholder: 'e.g. James Mwangi' },
    { key: 'role',        label: 'Role',        type: 'select', options: [
      { value: 'caretaker', label: 'Caretaker' }, { value: 'manager', label: 'Property Manager' },
      { value: 'security', label: 'Security Guard' }, { value: 'cleaner', label: 'Cleaner' },
      { value: 'accountant', label: 'Accountant' },
    ]},
    { key: 'email',       label: 'Email',       type: 'text',   placeholder: 'james@example.com' },
    { key: 'phone',       label: 'Phone',       type: 'text',   placeholder: '+254 7XX XXX XXX' },
    { key: 'start_date',  label: 'Start Date',  type: 'date' },
    { key: 'status',      label: 'Status',      type: 'select', options: [
      { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
    ]},
  ],
  'Message': [
    { key: 'subject',        label: 'Subject',          type: 'text',     required: true, placeholder: 'e.g. Rent Reminder' },
    { key: 'recipient_type', label: 'Send To',          type: 'select',   options: [
      { value: 'all_tenants',          label: 'All Tenants' },
      { value: 'specific_property',    label: 'Specific Property' },
      { value: 'specific_unit',        label: 'Specific Unit' },
      { value: 'individual',           label: 'Individual Tenant' },
    ]},
    { key: 'channel', label: 'Channel', type: 'select', options: [
      { value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' },
      { value: 'both', label: 'SMS + Email' }, { value: 'in_app', label: 'In-App' },
    ]},
    { key: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Type your message here...' },
  ],
  'Onboarding': [
    { key: 'full_name',     label: 'Full Name',       type: 'text',   required: true, placeholder: 'New Tenant Name' },
    { key: 'email',         label: 'Email Address',   type: 'text',   required: true, placeholder: 'tenant@example.com' },
    { key: 'phone',         label: 'Phone Number',    type: 'text',   placeholder: '+254 7XX XXX XXX' },
    { key: 'national_id',   label: 'National ID',     type: 'text',   placeholder: '12345678' },
    { key: 'move_in_date',  label: 'Move-in Date',    type: 'date' },
    { key: 'notes',         label: 'Notes',           type: 'textarea', placeholder: 'Additional notes for the new tenant...' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'pending', label: 'Pending Review' }, { value: 'reviewing', label: 'Reviewing' },
      { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
    ]},
  ],
};

// ─── Props ───────────────────────────────────────────────────────────────────
interface RealEstateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  onSuccess?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
const RealEstateFormModal: React.FC<RealEstateFormModalProps> = ({
  isOpen,
  onClose,
  entityType,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const fields = FIELDS[entityType] ?? [];
  const tableName = TABLE_MAP[entityType];

  // Default values for selects
  useEffect(() => {
    if (!isOpen) return;
    const defaults: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.type === 'select' && f.options && f.options.length > 0) {
        defaults[f.key] = f.options[0].value;
      }
    });
    setFormData(defaults);
    setSaved(false);
    setError(null);
  }, [isOpen, entityType]);

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setError(null);
    // Validate required
    const missing = fields.filter((f) => f.required && !formData[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Please fill required fields: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      fields.forEach((f) => {
        const val = formData[f.key];
        if (val === undefined || val === '') return;
        if (f.type === 'number') payload[f.key] = parseFloat(val) || 0;
        else payload[f.key] = val;
      });

      const { error: dbError } = await supabase.from(tableName).insert(payload);
      if (dbError) throw dbError;

      setSaved(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-800 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Add {entityType}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Fill in the details below to create a new record.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {saved ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="w-14 h-14 text-green-500 mb-3" aria-hidden="true" />
              <p className="text-xl font-bold text-gray-900 dark:text-white">Saved!</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {entityType} has been created successfully.
              </p>
            </div>
          ) : (
            <>
              {fields.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`field-${field.key}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
                  </label>

                  {field.type === 'select' ? (
                    <select
                      id={`field-${field.key}`}
                      title={field.label}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={`field-${field.key}`}
                      title={field.label}
                      rows={3}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                    />
                  ) : (
                    <input
                      id={`field-${field.key}`}
                      title={field.label}
                      type={field.type}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    />
                  )}
                </div>
              ))}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2.5">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-50"
              title="Cancel and close"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
              title="Save Record"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Saving...</>
              ) : (
                'Save Record'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealEstateFormModal;
