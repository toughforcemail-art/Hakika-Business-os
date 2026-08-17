// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Shield, ChevronRight, Sun, Moon, User, LogOut, LayoutDashboard, Settings, ArrowRight } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { isAbortError } from '../utils/abortErrors';
import Newsletter from './Newsletter';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useInternetStatus } from '../hooks/useInternetStatus';

interface PublicLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isInternetConnected = useInternetStatus();

  // Track online status
  useOnlineStatus(user?.id);

  // Initialize theme from localStorage or default to light (false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  // Toggle Dark Mode and persist
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Fetch User & Profile
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await supabase.auth.signOut();
      navigate('/');
    }
    setDropdownOpen(false);
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Services', path: '/services' },
    { name: 'Pricing', path: '/pricing' },
    { name: 'Resources', path: '/resources' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <div className="min-h-screen bg-transparent dark:bg-dark-bg text-slate-100 font-sans flex flex-col transition-colors duration-300 pb-[env(safe-area-inset-bottom)]">
      <header className="fixed top-3 left-1/2 z-50 w-[96%] max-w-[1720px] -translate-x-1/2 px-2 sm:top-4 sm:px-3">
        <div className={`flex h-[64px] sm:h-[74px] items-center justify-between gap-3 sm:gap-4 rounded-[18px] sm:rounded-[20px] border px-3 sm:px-4 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-2xl ring-1 ${isDark ? 'border-white/16 bg-white/10 ring-white/10' : 'border-black/5 bg-white/92 ring-white/70'}`}>
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 text-left" aria-label="Hakika home">
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-white shadow-[0_6px_14px_rgba(0,0,0,0.08)]">
              <img
                src="/tough_force_logo.webp"
                alt="Hakika Logo"
                className="h-[36px] w-[36px] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-xs">HK</div>
            </div>
            <div className="hidden sm:block leading-none">
              <div className={`text-[22px] font-black tracking-[-0.06em] ${isDark ? 'text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)]' : 'text-slate-900'}`}>HAKIKA</div>
              <div className={`mt-0.5 text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-[#ff6bb8] drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)]' : 'text-[#ff6bb8]'}`}>Operations Hub</div>
            </div>
          </button>

          <nav className="hidden items-center gap-5 xl:gap-7 lg:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `text-[14px] xl:text-[16px] font-semibold transition-colors hover:text-[#ff6bb8] ${isActive ? 'text-[#ff6bb8]' : isDark ? 'text-white/88' : 'text-slate-700'}`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_10px_20px_rgba(0,0,0,0.12)] backdrop-blur-md transition ${isDark ? 'border-white/15 bg-white/10 text-white/90 hover:bg-white/18 hover:text-white' : 'border-black/5 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-pressed={isDark}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex items-center gap-2 pl-2 pr-1 py-1 rounded-2xl border transition-all shadow-sm backdrop-blur-md ${isDark ? 'bg-white/10 border-white/15 hover:border-[#ff6bb8]/50' : 'bg-white border-black/5 hover:border-[#ff6bb8]/50'}`}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-9 h-9 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6bb8] to-pink-600 flex items-center justify-center text-white font-bold text-xs shadow-lg">
                      {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                    </div>
                  )}
                  <div className="hidden lg:block text-left mr-2 ml-1">
                      <p className={`text-[10px] uppercase font-black tracking-widest leading-none mb-1 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>User Portal</p>
                      <p className={`text-xs font-bold leading-none truncate max-w-[80px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {profile?.first_name || 'Account'}
                    </p>
                  </div>
                  <ChevronRight size={14} className={`transition-transform duration-300 ${isDark ? 'text-white/60' : 'text-slate-400'} ${dropdownOpen ? 'rotate-90' : ''}`} />
                </button>

                {dropdownOpen && (
                    <div className="absolute right-0 mt-3 w-64 bg-white/95 dark:bg-dark-surface/95 backdrop-blur-xl rounded-[24px] shadow-2xl border border-gray-100 dark:border-white/5 py-3 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 mb-2">
                       <p className="text-sm font-black text-gray-900 dark:text-white">
                        {profile?.first_name} {profile?.last_name}
                       </p>
                       <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 tracking-wider truncate mb-2">{user.email}</p>
                       <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                         isInternetConnected
                           ? 'bg-green-500/10 text-green-500'
                           : 'bg-amber-500/10 text-amber-500'
                       }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isInternetConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                          {isInternetConnected ? 'Online' : 'Offline'}
                       </div>
                    </div>
                    
                    <button onClick={() => navigate('/app/dashboard')} className="w-full text-left px-5 py-3 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                       <div className="w-8 h-8 rounded-lg bg-[#ff6bb8]/10 text-[#ff6bb8] flex items-center justify-center"><LayoutDashboard size={14} /></div>
                       Dashboard
                    </button>
                    <button onClick={() => navigate('/app/profile')} className="w-full text-left px-5 py-3 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors">
                       <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center"><Settings size={14} /></div>
                       Profile Settings
                    </button>
                    
                    <div className="border-t border-gray-100 dark:border-white/5 my-2"></div>
                    
                    <button onClick={handleLogout} className="w-full text-left px-5 py-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition-colors">
                       <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center"><LogOut size={14} /></div>
                       Log Out System
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/portal')}
                className="group relative inline-flex items-center gap-2 rounded-[16px] bg-white px-4 py-2.5 text-[13px] lg:px-5 lg:py-3 lg:text-[14px] font-black text-slate-950 shadow-[0_12px_24px_rgba(0,0,0,0.16)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Access Portal <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )} 
          </div>
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_10px_20px_rgba(0,0,0,0.12)] backdrop-blur-md transition ${isDark ? 'border-white/15 bg-white/10 text-white/90 hover:bg-white/18 hover:text-white' : 'border-black/5 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_10px_20px_rgba(0,0,0,0.12)] backdrop-blur-md transition ${isDark ? 'border-white/15 bg-white/10 text-white/90 hover:bg-white/18 hover:text-white' : 'border-black/5 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
           <div className={`absolute right-4 top-20 w-[min(18rem,calc(100vw-2rem))] rounded-3xl shadow-2xl border p-4 space-y-4 animate-in slide-in-from-right-4 duration-300 ${isDark ? 'bg-white dark:bg-dark-surface border-gray-100 dark:border-white/10' : 'bg-white border-black/5'}`}>
              {navLinks.map((link) => (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2 text-sm font-bold text-gray-900 dark:text-gray-300 hover:text-brand-purple"
                >
                  {link.name}
                </NavLink>
              ))}
              
              {user ? (
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-3 px-4">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Profile" className="w-10 h-10 rounded-xl" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-purple to-pink-600 flex items-center justify-center text-white font-bold">
                        {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold dark:text-white">{profile?.first_name || 'User'}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{profile?.role || 'Portal User'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        navigate('/app/dashboard');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 flex items-center gap-3"
                    >
                      <LayoutDashboard size={16} /> Dashboard
                    </button>
                    <button
                      onClick={() => {
                        navigate('/app/profile');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 flex items-center gap-3"
                    >
                      <Settings size={16} /> Profile Settings
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-bold text-red-500 flex items-center gap-3"
                    >
                      <LogOut size={16} /> Log Out System
                    </button>
                  </div>
                </div>
              ) : (
                  <button
                    onClick={() => {
                      navigate('/portal');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-3 rounded-xl bg-brand-purple text-white font-black text-xs uppercase tracking-widest"
                  >
                    Access Portal
                  </button>
              )}
           </div>
        </div>
      )}

      <main className="flex-1">
        {children}
      </main>

      <Newsletter />

      {/* Footer */}
      <footer className="bg-white dark:bg-dark-surface border-t border-gray-100 dark:border-white/10 pt-16 pb-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4 text-left">
                <img src="/tough_force_logo.webp" alt="Hakika Logo" className="h-10 w-auto object-contain" />
                <div>
                   <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-none">HAKIKA</h1>
                   <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 block">Kenya Group</span>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                The Hakika Kenya platform for HR, Security, and Real Estate management. Automation at its finest.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest mb-6">Platform</h4>
              <ul className="space-y-3 text-xs font-bold text-gray-600 dark:text-gray-300">
                <li><NavLink to="/services" className="hover:text-brand-purple transition-colors">HR Master</NavLink></li>
                <li><NavLink to="/services" className="hover:text-brand-purple transition-colors">Tough Force Security</NavLink></li>
                <li><NavLink to="/services" className="hover:text-brand-purple transition-colors">Hakika Real Estate</NavLink></li>
                <li><NavLink to="/services" className="hover:text-brand-purple transition-colors">Marketing Studio</NavLink></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest mb-6">Company</h4>
              <ul className="space-y-3 text-xs font-bold text-gray-600 dark:text-gray-300">
                <li><NavLink to="/about" className="hover:text-brand-purple transition-colors">About Us</NavLink></li>
                <li><NavLink to="/careers" className="hover:text-brand-purple transition-colors">Careers</NavLink></li>
                <li><NavLink to="/press" className="hover:text-brand-purple transition-colors">Press</NavLink></li>
                <li><NavLink to="/contact" className="hover:text-brand-purple transition-colors">Contact</NavLink></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-widest mb-6">Legal</h4>
              <ul className="space-y-3 text-xs font-bold text-gray-600 dark:text-gray-300">
                <li><NavLink to="/privacy" className="hover:text-brand-purple transition-colors">Privacy Policy</NavLink></li>
                <li><NavLink to="/terms" className="hover:text-brand-purple transition-colors">Terms of Service</NavLink></li>
                <li><NavLink to="/cookies" className="hover:text-brand-purple transition-colors">Cookie Policy</NavLink></li>
                <li><NavLink to="/security-audit" className="hover:text-brand-purple transition-colors">Security Audit</NavLink></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-white/5 pt-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest">
            <p>Copyright © 2026 Hakika Kenya Group. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
