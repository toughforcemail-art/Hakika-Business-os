// @ts-nocheck
import React from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';

const WidgetTeamStatus: React.FC = () => {
  return (
    <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-dark-border h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="text-blue-500" size={18} />
          Team Status
        </h3>
        <span className="text-xs text-gray-500">Today</span>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 text-center">
          <UserCheck size={20} className="mx-auto text-green-500 mb-1" />
          <p className="text-xl font-bold text-gray-900 dark:text-white">24</p>
          <p className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">Present</p>
        </div>
        
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-center">
          <UserX size={20} className="mx-auto text-red-500 mb-1" />
          <p className="text-xl font-bold text-gray-900 dark:text-white">2</p>
          <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Absent</p>
        </div>
        
        <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 text-center">
          <Clock size={20} className="mx-auto text-orange-500 mb-1" />
          <p className="text-xl font-bold text-gray-900 dark:text-white">3</p>
          <p className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400">Late</p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs font-medium text-gray-500 mb-2">Who's Away</p>
        <div className="flex -space-x-2 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-dark-surface bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
              {String.fromCharCode(64 + i)}
            </div>
          ))}
          <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-dark-surface bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
            +1
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetTeamStatus;
