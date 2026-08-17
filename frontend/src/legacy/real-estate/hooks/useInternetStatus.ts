import { useEffect, useMemo, useRef, useState } from 'react';

const CONNECTION_CHECK_INTERVAL_MS = 30000;

export const useInternetStatus = () => {
  const [isConnected, setIsConnected] = useState(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let isDisposed = false;

    const markOnline = () => {
      if (!isDisposed) setIsConnected(true);
    };

    const markOffline = () => {
      if (!isDisposed) setIsConnected(false);
    };

    const checkConnection = async () => {
      if (!window.navigator.onLine) {
        markOffline();
        return;
      }

      markOnline();
    };

    const handleOnline = () => {
      if (!isDisposed) setIsConnected(true);
      void checkConnection();
    };
    const handleOffline = () => {
      markOffline();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkConnection();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      void checkConnection();
    }, CONNECTION_CHECK_INTERVAL_MS);

    void checkConnection();

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isConnected;
};
