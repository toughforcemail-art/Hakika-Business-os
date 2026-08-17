// @ts-nocheck
import React from 'react';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', hours: 8 },
  { name: 'Tue', hours: 7.5 },
  { name: 'Wed', hours: 8.2 },
  { name: 'Thu', hours: 8 },
  { name: 'Fri', hours: 7.8 },
];

const WidgetAttendanceChart: React.FC = () => {
  return (
    <div className="stat-card h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="text-green-500" size={18} />
          Attendance Trends
        </h3>
        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 rounded-full">
          98% On Time
        </span>
      </div>
      <div className="flex-1 min-h-[150px] w-full relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={150} aspect={2} debounce={50}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" hide />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="hours" stroke="#10B981" fillOpacity={1} fill="url(#colorHours)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WidgetAttendanceChart;
