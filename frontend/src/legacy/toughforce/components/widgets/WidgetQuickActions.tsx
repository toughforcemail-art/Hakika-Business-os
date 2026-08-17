// @ts-nocheck
import React from 'react';
import { Zap, Clock, FileText, Calendar, DollarSign, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const actions = [
  { icon: Clock, label: 'Clock In', path: '/app/hr/attendance', color: 'blue' },
  { icon: FileText, label: 'Payslip', path: '/app/account/my-hr', color: 'green' },
  { icon: Calendar, label: 'Leave', path: '/app/hr/apply-leave', color: 'purple' },
  { icon: Shield, label: 'Report', path: '/app/security/night-report', color: 'orange' },
];

const WidgetQuickActions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-dark-border h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Zap className="text-yellow-500" size={18} />
          Quick Actions
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
          >
            <div className={`p-2 rounded-lg bg-${action.color}-500/10 text-${action.color}-500 mb-2 group-hover:scale-110 transition-transform`}>
              <action.icon size={20} />
            </div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default WidgetQuickActions;
