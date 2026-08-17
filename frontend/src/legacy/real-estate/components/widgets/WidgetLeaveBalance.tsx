// @ts-nocheck
import React from 'react';
import { Calendar } from 'lucide-react';

const WidgetLeaveBalance: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 rounded-2xl text-white h-full">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium opacity-90">Annual Leave</p>
          <h3 className="text-3xl font-bold mt-1">21 Days</h3>
          <p className="text-xs opacity-75 mt-2">Expiring: Dec 31st</p>
        </div>
        <div className="p-2 bg-white/20 rounded-lg">
          <Calendar size={24} />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/20">
        <button className="text-xs font-bold uppercase tracking-wider hover:text-blue-100 transition-colors">
          Request Leave &rarr;
        </button>
      </div>
    </div>
  );
};

export default WidgetLeaveBalance;
