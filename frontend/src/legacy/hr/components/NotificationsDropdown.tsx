// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, Info, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { NotificationService, Notification } from '../services/NotificationService';

const NotificationsDropdown: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Request browser notification permission on mount
  useEffect(() => { NotificationService.requestBrowserPermission(); }, []);

  // Initial Fetch & Subscription
  useEffect(() => {
    fetchNotifications();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newNote = payload.new as Notification;
                    setNotifications(prev => [newNote, ...prev]);
                    setUnreadCount(prev => prev + 1);
                    NotificationService.playNotificationSound();
                    NotificationService.showBrowserNotification(newNote.title, newNote.message, newNote.link);
                }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                // console.log('Ready to receive notifications');
              }
            });
    };

    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const count = notifications.filter(n => !n.is_read).length;
    setUnreadCount(count);
  }, [notifications]);

  const fetchNotifications = async () => {
    const data = await NotificationService.getMyNotifications();
    setNotifications(data);
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await NotificationService.markAllAsRead(user.id);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const markAsRead = async (id: string) => {
    await NotificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const deleteNotification = async (id: string) => {
      // Opt UI update, assuming we might add delete endpoint later or just hide
      // setNotifications(notifications.filter(n => n.id !== id));
      // For now, just mark read effectively hides it from "unread" view usually
      markAsRead(id);
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
        await markAsRead(n.id);
    }
    setIsOpen(false);
    
    if (n.link) {
        navigate(n.link);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={16} className="text-green-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'error': return <X size={16} className="text-red-500" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 transition-colors relative group rounded-full hover:bg-white/10 ${isOpen ? 'text-pink-500' : 'text-gray-500 hover:text-pink-500'}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-dark-surface font-bold animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-2xl shadow-2xl z-50 overflow-hidden transform origin-top-right animate-scale-in">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/2">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Notifications
              <span className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded-full">{unreadCount} New</span>
            </h3>
            <button 
              onClick={markAllAsRead}
              className="text-xs text-pink-500 hover:text-pink-600 font-semibold"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto scrollbar-hide py-2">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div 
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`group px-5 py-4 flex gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors relative cursor-pointer ${!n.is_read ? 'bg-pink-50/20 dark:bg-pink-500/5' : ''}`}
                >
                  <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${n.is_read ? 'bg-gray-100 dark:bg-white/5' : 'bg-pink-100 dark:bg-pink-600/20'}`}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate pr-4">{n.title}</span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    {(n.action_label || n.link) && (
                        <div className="mt-2 flex items-center gap-2">
                             <span className="text-[10px] flex items-center gap-1 text-pink-500 font-bold hover:underline">
                                {n.action_label || 'View Details'} <ExternalLink size={10} />
                             </span>
                        </div>
                    )}
                  </div>
                  {!n.is_read && (
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-pink-500"></div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={24} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-500">You're all caught up!</p>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/2">
            <button 
                onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                className="w-full text-center text-xs text-gray-500 hover:text-pink-500 font-bold uppercase tracking-widest transition-colors py-1"
            >
              View All Activity Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
