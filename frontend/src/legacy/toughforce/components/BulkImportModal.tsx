// @ts-nocheck
import React, { useState } from 'react';
import { Upload, Download, X, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { getEmployeeNoDateStr, normalizeEmployeeNo } from '../utils/employeeNo';
import CustomLoader from './CustomLoader';
import { invokeEdgeFunction } from '../utils/edgeFunctions';

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const downloadTemplate = () => {
    const headers = ['first_name', 'last_name', 'email', 'phone_number', 'id_number', 'gender', 'department', 'designation', 'employment_type', 'employment_start_date', 'salary', 'bank_name', 'account_number'];
    const sample = ['John', 'Doe', 'john.doe@example.com', '+254712345678', '12345678', 'Male', 'HR', 'Manager', 'Permanent', '2024-01-01', '50000', 'Equity Bank', '1234567890'];
    
    const csv = [headers, sample].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const employees = parseCSV(text);
        
        let success = 0;
        let failed = 0;
        const errors: string[] = [];
        const dateStr = getEmployeeNoDateStr();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Authentication required for bulk import');

        for (const emp of employees) {
          try {
            const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
            const username = `${emp.first_name?.toLowerCase()}.${emp.last_name?.toLowerCase()}`;

            const funcData = await invokeEdgeFunction('admin-create-user', {
              email: emp.email,
              password: tempPassword,
              userData: {
                full_name: `${emp.first_name} ${emp.last_name}`,
                role: 'Employee',
                is_approved: true
              }
            }, {
              accessToken: session.access_token
            });

            // Using optional chaining or defaulting just in case funcData/user isn't well-formed
            const newUserId = funcData?.user?.id;
            if (!newUserId) throw new Error('User creation failed, ID missing');

            const { error: empError } = await supabase.from('profiles').insert({
              id: newUserId,
              full_name: `${emp.first_name} ${emp.last_name}`,
              email: emp.email,
              phone_number: emp.phone_number,
              id_number: emp.id_number,
              gender: emp.gender,
              department: emp.department,
              designation: emp.designation,
              employment_type: emp.employment_type,
              employment_start_date: emp.employment_start_date,
              salary: parseFloat(emp.salary) || 0,
              bank_name: emp.bank_name,
              account_number: emp.account_number
            });

            if (empError) throw empError;
            success++;
          } catch (error: any) {
            failed++;
            errors.push(`${emp.email}: ${error.message}`);
          }
        }

        setResults({ success, failed, errors });
        if (success > 0) onSuccess();
      } catch (error) {
        console.error('Import error:', error);
        setResults({ success: 0, failed: 0, errors: ['Failed to parse CSV file'] });
      } finally {
        setImporting(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Import Employees</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {!results ? (
          <>
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Upload a CSV file with employee data. Download the template below to see the required format.
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] text-sm"
                title="Download Template"
                aria-label="Download Template"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Download Template
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-[#1e293b] rounded-lg p-8 text-center mb-6">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
              >
                Choose CSV file
              </label>
              {file && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] disabled:opacity-50"
                title="Cancel"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                title="Import Employees"
                aria-label="Import Employees"
              >
                {importing ? (
                  <>
                    <CustomLoader size={16} />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    Import
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-6 h-6 text-green-500" aria-hidden="true" />
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Import Complete</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{results.success}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Successful</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Failed</p>
                </div>
              </div>
              {results.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Errors:</p>
                  {results.errors.map((error, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-red-600 mb-1">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                title="Close Results"
                aria-label="Close Results"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkImportModal;
