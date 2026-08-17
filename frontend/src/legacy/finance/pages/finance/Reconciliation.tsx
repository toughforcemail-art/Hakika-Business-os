// @ts-nocheck
import React from 'react';
import { Landmark, TrendingUp } from 'lucide-react';

const Reconciliation: React.FC = () => (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingUp className="text-brand-purple" /> Bank & M-Pesa Reconciliation
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text"> Smart matching for statement entries and group accounts. </p>
        </div>
      </div>
      <div className="glass-card p-12 text-center text-gray-400 italic font-bold uppercase tracking-widest text-xs"> Reconciliation Hub - Coming Soon </div>
    </div>
);
export default Reconciliation;
