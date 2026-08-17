// @ts-nocheck
import React, { useEffect, useId, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type Props = {
  siteKey: string;
  onToken: (token: string | null) => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  resetKey?: number;
};

const scriptId = 'cloudflare-turnstile-script';

const loadScript = () =>
  new Promise<void>((resolve, reject) => {
    if (document.getElementById(scriptId)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile'));
    document.head.appendChild(script);
  });

const TurnstileWidget: React.FC<Props> = ({ siteKey, onToken, onError, theme = 'auto', resetKey }) => {
  const containerId = useId().replace(/:/g, '_');
  const [ready, setReady] = useState(false);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;

    if (!siteKey) return;

    void loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId = window.turnstile.render(`#${containerId}`, {
          sitekey: siteKey,
          theme,
          callback: (token: string) => onTokenRef.current(token),
          'error-callback': () => {
            onTokenRef.current(null);
            onErrorRef.current?.();
          },
          'expired-callback': () => onTokenRef.current(null),
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // ignore cleanup failures
        }
      }
    };
  }, [containerId, siteKey, theme, resetKey]);

  if (!siteKey) return null;

  return (
    <div className={ready ? 'opacity-100' : 'opacity-80'} aria-label="Security verification">
      <div id={containerId} />
    </div>
  );
};

export default TurnstileWidget;
