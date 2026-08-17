// @ts-nocheck
/**
 * Inquiry Code Manager
 * 
 * Displays, edits, and resets contact inquiry codes in the admin inbox.
 * Auto-generated from module and intent, but can be customized by admins.
 * 
 * Features:
 * - View current inquiry code with copy-to-clipboard
 * - Edit code with validation and uniqueness check
 * - Reset to auto-generated default
 * - Full audit trail of changes
 * - Disabled for non-admin users
 */

import React, { useState } from 'react';
import { Copy, Edit2, RotateCcw, Check, X, AlertCircle } from 'lucide-react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import toast from 'react-hot-toast';

interface InquiryCodeManagerProps {
  inquiryCode: string;
  inquiryEmail: string;
  inquirySubject: string;
  moduleSlug: string;
  intent: string;
  userRole: string;
  onCodeUpdated?: (newCode: string) => void;
}

export function InquiryCodeManager({
  inquiryCode,
  inquiryEmail,
  inquirySubject,
  moduleSlug,
  intent,
  userRole,
  onCodeUpdated,
}: InquiryCodeManagerProps) {
  const supabaseClient = useSupabaseClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newCode, setNewCode] = useState(inquiryCode);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const isAdmin = ['super_admin', 'Super Admin', 'Director', 'Admin'].includes(
    userRole
  );

  const canEdit = isAdmin && inquiryCode;

  // Copy code to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inquiryCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast.success('Inquiry code copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  // Update inquiry code
  const handleSaveNewCode = async () => {
    setError(null);

    // Validation
    const codeToSave = newCode.toUpperCase().trim();

    if (!codeToSave) {
      setError('Inquiry code cannot be empty');
      return;
    }

    if (codeToSave === inquiryCode) {
      setError('New code must be different from current code');
      return;
    }

    if (!/^[A-Z0-9\-]+$/.test(codeToSave)) {
      setError('Code must contain only uppercase letters, numbers, and hyphens');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: rpcError } = await supabaseClient.rpc(
        'update_contact_inquiry_code',
        {
          p_inquiry_id: inquiryCode, // Will be passed as part of inquiry lookup
          p_new_code: codeToSave,
          p_reason: reason || 'Updated via admin inbox',
        }
      );

      if (rpcError) {
        setError(rpcError.message || 'Failed to update inquiry code');
        console.error('Update error:', rpcError);
        return;
      }

      if (data?.success) {
        toast.success(`Inquiry code updated: ${codeToSave}`);
        setIsEditing(false);
        setReason('');
        onCodeUpdated?.(codeToSave);
      } else {
        setError('Failed to update inquiry code');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset code to auto-generated default
  const handleResetToDefault = async () => {
    if (
      !window.confirm(
        `Reset inquiry code back to auto-generated format from "${moduleSlug}" and "${intent}"?`
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabaseClient.rpc(
        'reset_contact_inquiry_code_to_default',
        {
          p_inquiry_id: inquiryCode,
          p_reason: 'Reset to default via admin inbox',
        }
      );

      if (rpcError) {
        setError(rpcError.message || 'Failed to reset inquiry code');
        console.error('Reset error:', rpcError);
        return;
      }

      if (data?.success) {
        const newCode = data.new_code;
        toast.success(`Inquiry code reset to: ${newCode}`);
        setIsEditing(false);
        onCodeUpdated?.(newCode);
      } else {
        setError('Failed to reset inquiry code');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewCode(inquiryCode);
    setReason('');
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Inquiry Code</h3>
          <p className="text-sm text-gray-600">
            Unique reference number for tracking
          </p>
        </div>
        {!isEditing && canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit inquiry code"
          >
            <Edit2 size={16} />
            Edit
          </button>
        )}
      </div>

      {/* Inquiry Context */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div>
            <strong>From:</strong>{' '}
            <span className="font-mono text-gray-900">{inquiryEmail}</span>
          </div>
          {inquirySubject && (
            <div>
              <strong>Subject:</strong>{' '}
              <span className="text-gray-900 line-clamp-1">{inquirySubject}</span>
            </div>
          )}
          <div>
            <strong>Module:</strong> {moduleSlug} | <strong>Intent:</strong> {intent}
          </div>
        </div>
      </div>

      {!isEditing ? (
        // Display mode
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <code className="flex-1 font-mono font-semibold text-blue-900 text-lg">
              {inquiryCode}
            </code>
            <button
              onClick={handleCopy}
              className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-200 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {isCopied ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Copy size={18} />
              )}
            </button>
          </div>

          {canEdit && (
            <button
              onClick={handleResetToDefault}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={16} />
              Reset to Default
            </button>
          )}

          {!canEdit && !isAdmin && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Only admins and directors can edit inquiry codes.
              </p>
            </div>
          )}
        </div>
      ) : (
        // Edit mode
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Inquiry Code
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="e.g., HR-SALES-20260613"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: [MODULE]-[INTENT]-[TIME]. Use uppercase, numbers, and hyphens.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Change (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Standardizing inquiry reference format"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSaveNewCode}
              disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} />
              {isLoading ? 'Updating...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={16} />
              Cancel
            </button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              💡 <strong>Tip:</strong> Inquiry codes are tracked in the audit log.
              Code changes are recorded for compliance and tracking purposes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
