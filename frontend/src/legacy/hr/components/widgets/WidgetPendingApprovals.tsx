// @ts-nocheck
import React from 'react';
import { FileText, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';

const mocks = [
  { id: 1, title: 'Leave Request - John Doe', time: '2 hrs ago', status: 'urgent' },
  { id: 2, title: 'Expense Report #402', time: '5 hrs ago', status: 'normal' },
  { id: 3, title: 'Shift Swap Request', time: '1 day ago', status: 'normal' },
];

const WidgetPendingApprovals: React.FC = () => {
  return (
    <div className="stat-card h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="text-pink-500" size={18} />
          Pending Approvals
        </h3>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
          3
        </span>
      </div>
      <div className="flex-1 space-y-3">
        {mocks.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-neutral-700 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                {item.status === 'urgent' ? (
                  <AlertCircle size={14} className="text-amber-500" />
                ) : (
                  <CheckCircle size={14} className="text-gray-500 dark:text-dark-text" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-dark-text">{item.time}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-500 dark:text-dark-text group-hover:translate-x-0.5 transition-transform" />
            </div>
        ))}
      </div>
      <button className="w-full mt-4 py-2 text-xs font-medium text-gray-500 dark:text-dark-text hover:text-black dark:hover:text-white transition-colors">
        View All Approvals
      </button>
    </div>
  );
};

export default WidgetPendingApprovals;
