// @ts-nocheck
import React from 'react';
import { Activity, Server, Database, Globe } from 'lucide-react';

const WidgetSystemHealth: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl text-white h-full border border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold flex items-center gap-2">
          <Activity className="text-green-500" size={18} />
          System Health
        </h3>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 rounded text-xs font-bold text-green-400">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          Operational
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server size={16} className="text-gray-400" />
            <span className="text-sm">API Server</span>
          </div>
          <span className="text-xs font-mono text-green-400">99.9%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div className="bg-green-500 h-1.5 rounded-full w-[99%]"></div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database size={16} className="text-gray-400" />
            <span className="text-sm">Database</span>
          </div>
          <span className="text-xs font-mono text-green-400">45ms</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div className="bg-blue-500 h-1.5 rounded-full w-[85%]"></div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe size={16} className="text-gray-400" />
            <span className="text-sm">Edge Functions</span>
          </div>
          <span className="text-xs font-mono text-green-400">OK</span>
        </div>
      </div>
    </div>
  );
};

export default WidgetSystemHealth;
