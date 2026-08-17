// @ts-nocheck
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { activityLogger } from '../utils/activityLogger';

export const useActivityTracking = (pageName?: string) => {
  const location = useLocation();

  useEffect(() => {
    const page = pageName || location.pathname;
    activityLogger.logPageView(page);
  }, [location.pathname, pageName]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      const link = target.closest('a');
      
      if (button) {
        const text = button.textContent?.trim() || button.getAttribute('aria-label') || 'Unknown Button';
        activityLogger.logClick(text, 'button');
      } else if (link) {
        const text = link.textContent?.trim() || link.getAttribute('href') || 'Unknown Link';
        activityLogger.logClick(text, 'link');
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);
};
