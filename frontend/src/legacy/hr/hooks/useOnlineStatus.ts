// @ts-nocheck
import { useEffect } from 'react';
import { supabase } from '../utils/supabase';

export const useOnlineStatus = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;

    const markPresence = async (isOnline: boolean) => {
      await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);
    };

    void markPresence(true);

    const interval = setInterval(() => {
      void markPresence(true);
    }, 30000);

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        JSON.stringify({ is_online: false, last_seen: new Date().toISOString() })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void markPresence(false);
    };
  }, [userId]);
};
