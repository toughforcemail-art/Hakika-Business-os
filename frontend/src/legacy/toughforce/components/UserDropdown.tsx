// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserDropdownProps {
  userData: {
    name: string;
    role: string;
    profileImage: string | null;
    isOnline?: boolean;
  };
  onLogout: () => void;
}

const UserDropdown: React.FC<UserDropdownProps> = ({ userData, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative pl-2" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 group focus:outline-none"
      >
        <div className="text-right hidden md:block">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-widest leading-none mb-1">{userData.role}</p>
          <p className="text-sm font-semibold text-[#333] dark:text-white leading-none group-hover:text-[#ff6a00] transition-colors">{userData.name}</p>
        </div>
        <div className="relative h-10 w-10 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-[#c89f5e]/50 group-hover:shadow-[0_0_15px_rgba(200,159,94,0.1)]">
          {userData.profileImage ? (
            <img src={userData.profileImage} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#c89f5e] to-[#b8945a] text-white">
              <User size={20} />
            </div>
          )}
          <div
            className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white dark:border-dark-bg rounded-full ${
              userData.isOnline ? 'bg-green-500' : 'bg-amber-500'
            }`}
            title={userData.isOnline ? 'Internet connected' : 'Internet unavailable'}
          ></div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border shadow-xl overflow-hidden z-50 animate-fade-in-up origin-top-right">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{userData.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userData.role}</p>
              <span className={`flex items-center gap-1 text-xs ${
                userData.isOnline ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${userData.isOnline ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                {userData.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="p-2 space-y-1">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/app/profile');
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors font-medium"
            >
              <Settings size={16} className="text-gray-400" />
              Profile Settings
            </button>
            
            <div className="h-px bg-gray-100 dark:bg-white/10 my-2 mx-2"></div>
            
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-medium"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
