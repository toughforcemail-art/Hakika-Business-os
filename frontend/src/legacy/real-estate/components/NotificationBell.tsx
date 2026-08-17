// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, CheckCheck, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_read: boolean;
  link?: string;
  created_at: string;
}

const typeStyles = {
  info:    { bg: 'bg-blue-50 dark:bg-blue-900/20',  icon: <Info size={14} className="text-blue-500" /> },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: <AlertTriangle size={14} className="text-yellow-500" /> },
  success: { bg: 'bg-green-50 dark:bg-green-900/20',  icon: <CheckCircle size={14} className="text-green-500" /> },
  error:   { bg: 'bg-red-50 dark:bg-red-900/20',    icon: <XCircle size={14} className="text-red-500" /> },
};

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── Fetch initial notifications ──────────────────────────
  const fetchNotifications = async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  // ── Request browser notification permission ───────────────
  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // ── Show a browser native notification ───────────────────
  const showBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    }
  };

  useEffect(() => {
    requestPermission();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchNotifications(user.id);

      // ── Realtime subscription ────────────────────────────
      const channel = supabase
        .channel('notifications-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
            showBrowserNotification(newNotif.title, newNotif.body);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  // ── Close panel on outside click ─────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-gray-100 dark:border-dark-border z-50 overflow-hidden animate-slide-down">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-brand-purple hover:underline flex items-center gap-1"
                  title="Mark all notifications as read"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck size={12} aria-hidden="true" /> Mark all read
                </button>
              )}
              <button 
                onClick={() => setOpen(false)} 
                className="text-gray-400 hover:text-gray-600"
                title="Close notifications"
                aria-label="Close notifications"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                <Bell size={28} className="mx-auto mb-2 opacity-20" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
                    !n.is_read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${typeStyles[n.type]?.bg}`}>
                    {typeStyles[n.type]?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
