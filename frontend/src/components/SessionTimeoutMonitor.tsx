"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const WARNING_SECONDS = 5 * 60;

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.max(0, seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function SessionTimeoutMonitor() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session?.expires_at) setExpiresAt(data.session.expires_at);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setExpiresAt(session?.expires_at ?? null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (!expiresAt) { setRemaining(null); return; }
    const update = () => setRemaining(Math.max(0, expiresAt - Math.floor(Date.now() / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (remaining !== 0) return;
    void supabase.auth.signOut().finally(() => { window.location.assign("/login?reason=session-expired"); });
  }, [remaining, supabase]);

  if (remaining === null || remaining > WARNING_SECONDS) return null;

  async function extendSession() {
    setExtending(true);
    const { data, error } = await supabase.auth.refreshSession();
    setExtending(false);
    if (error || !data.session?.expires_at) {
      window.location.assign("/login?reason=session-refresh-failed");
      return;
    }
    setExpiresAt(data.session.expires_at);
  }

  return <div className="session-timeout-banner" role="alertdialog" aria-labelledby="session-timeout-title" aria-describedby="session-timeout-description">
    <div><strong id="session-timeout-title">Your session is about to expire</strong><p id="session-timeout-description">To protect your account, you will be signed out in <strong aria-live="polite">{formatRemaining(remaining)}</strong>.</p></div>
    <div className="session-timeout-actions"><button type="button" className="session-timeout-extend" onClick={() => void extendSession()} disabled={extending}>{extending ? "Extending…" : "Extend session"}</button><button type="button" className="session-timeout-signout" onClick={() => void supabase.auth.signOut().finally(() => window.location.assign("/login"))}>Sign out</button></div>
  </div>;
}
