// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../hooks/useAccess';
import CustomToast, { ToastType } from '../../components/CustomToast';
import GlobalLedger from './GlobalLedger';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  module?: string;
  entity?: string;
}

const GlobalLedgerWithBankAccounts: React.FC = () => {
  const { profile } = useAccess();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showBankForm, setShowBankForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [bankFormData, setBankFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    account_type: 'checking',
    current_balance: 0,
    module: '',
    entity: ''
  });

  const fetchBankAccounts = async () => {
    if (!profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('re_bank_accounts')
        .select()
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    }
  };

  const handleAddBankAccount = async () => {
    if (!profile?.company_id || !bankFormData.bank_name || !bankFormData.account_number || !bankFormData.account_holder_name || !bankFormData.module || !bankFormData.entity) {
      setToast({ message: 'Please fill in all required fields', type: 'warning' });
      return;
    }

    try {
      const { error } = await supabase.from('re_bank_accounts').insert([{
        company_id: profile.company_id,
        bank_name: bankFormData.bank_name,
        account_number: bankFormData.account_number,
        account_holder_name: bankFormData.account_holder_name,
        account_type: bankFormData.account_type,
        current_balance: Number(bankFormData.current_balance),
        module: bankFormData.module,
        entity: bankFormData.entity
      }]);

      if (error) throw error;
      setToast({ message: 'Bank account added successfully', type: 'success' });
      setBankFormData({
        bank_name: '',
        account_number: '',
        account_holder_name: '',
        account_type: 'checking',
        current_balance: 0,
        module: '',
        entity: ''
      });
      setShowBankForm(false);
      fetchBankAccounts();
    } catch (err: any) {
      setToast({ message: err.message || 'Error adding account', type: 'error' });
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      const { error } = await supabase.from('re_bank_accounts').delete().eq('id', id);
      if (error) throw error;
      setToast({ message: 'Account deleted successfully', type: 'success' });
      fetchBankAccounts();
    } catch (err: any) {
      setToast({ message: err.message || 'Error deleting account', type: 'error' });
    }
  };

  useEffect(() => {
    if (profile) {
      fetchBankAccounts();
    }
  }, [profile]);

  return (
    <div className="space-y-8">
      <GlobalLedger />

      {/* Bank Accounts Section */}
      <div className="min-h-full w-full space-y-4 bg-white p-6 text-gray-900 dark:bg-dark-bg dark:text-white lg:p-10 border-t border-gray-200 dark:border-dark-border">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bank Accounts</h2>
          <button
            onClick={() => setShowBankForm(!showBankForm)}
            className="flex items-center gap-2 bg-brand-purple text-white px-4 py-2 rounded-lg hover:bg-brand-purple/90"
          >
            <Plus size={20} /> Add Account
          </button>
        </div>

        {showBankForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">* Required fields</p>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Bank Name *"
                value={bankFormData.bank_name}
                onChange={(e) => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <input
                type="text"
                placeholder="Account Number *"
                value={bankFormData.account_number}
                onChange={(e) => setBankFormData({ ...bankFormData, account_number: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <input
                type="text"
                placeholder="Account Holder Name *"
                value={bankFormData.account_holder_name}
                onChange={(e) => setBankFormData({ ...bankFormData, account_holder_name: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <select
                value={bankFormData.account_type}
                onChange={(e) => setBankFormData({ ...bankFormData, account_type: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="business">Business</option>
              </select>
              <input
                type="number"
                placeholder="Current Balance"
                value={bankFormData.current_balance}
                onChange={(e) => setBankFormData({ ...bankFormData, current_balance: parseFloat(e.target.value) || 0 })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <select
                value={bankFormData.module}
                onChange={(e) => setBankFormData({ ...bankFormData, module: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select Module *</option>
                <option value="real_estate">Real Estate</option>
                <option value="hr">HR</option>
                <option value="security">Security</option>
                <option value="finance">Finance</option>
              </select>
              <input
                type="text"
                placeholder="Entity Debited / Credited *"
                value={bankFormData.entity}
                onChange={(e) => setBankFormData({ ...bankFormData, entity: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddBankAccount}
                className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90"
              >
                Save Account
              </button>
              <button
                onClick={() => setShowBankForm(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((account) => (
            <div key={account.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{account.bank_name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{account.account_number}</p>
                </div>
                <button
                  onClick={() => handleDeleteBankAccount(account.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{account.account_holder_name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Type: {account.account_type}</p>
              {account.module && <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Module: {account.module}</p>}
              {account.entity && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Entity: {account.entity}</p>}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">Current Balance</p>
                <p className="text-2xl font-bold text-brand-purple">KES {account.current_balance.toLocaleString()}</p>
              </div>
              <div className="mt-3">
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default GlobalLedgerWithBankAccounts;
