"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const WARNING_SECONDS = 30 * 60;
const REFRESH_BUFFER_SECONDS = 15 * 60;

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
  const [notice, setNotice] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const refreshing = useRef(false);

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
    if (remaining === null || remaining > REFRESH_BUFFER_SECONDS || refreshing.current) return;
    refreshing.current = true;
    let cancelled = false;
    void supabase.auth.refreshSession().then(({ data, error }) => {
      if (cancelled) return;
      if (!error && data.session?.expires_at) {
        setRefreshError("");
        setExpiresAt(data.session.expires_at);
      } else {
        // Do not sign the user out while the warning is visible. A transient
        // network failure must not destroy a usable refresh-token session.
        setRefreshError("Session refresh is waiting for a connection. Select Extend session to try again.");
      }
    }).finally(() => { refreshing.current = false; });
    return () => { cancelled = true; };
  }, [remaining, supabase]);

  if (remaining === null || remaining > WARNING_SECONDS) return null;

  async function extendSession() {
    setExtending(true);
    setNotice("");
    try {
      let { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.expires_at) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        ({ data, error } = await supabase.auth.refreshSession());
      }
      if (error || !data.session?.expires_at) {
        setRefreshError("We could not extend the session yet. Check your connection and try again.");
        return;
      }
      setExpiresAt(data.session.expires_at);
      setRefreshError("");
      setNotice(`Session extended until ${new Date(data.session.expires_at * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
    } catch {
      setRefreshError("We could not extend the session yet. Check your connection and try again.");
    } finally {
      setExtending(false);
    }
  }

  return <div className="session-timeout-banner" role="alertdialog" aria-labelledby="session-timeout-title" aria-describedby="session-timeout-description">
    <div><strong id="session-timeout-title">Your session is about to expire</strong><p id="session-timeout-description">To protect your account, you will be signed out in <strong aria-live="polite">{remaining === 0 ? "a moment" : formatRemaining(remaining)}</strong>.</p>{notice && <small role="status">{notice}</small>}{refreshError && <small role="status">{refreshError}</small>}</div>
    <div className="session-timeout-actions"><button type="button" className="session-timeout-extend" onClick={() => void extendSession()} disabled={extending}>{extending ? "Extending…" : "Extend session"}</button><button type="button" className="session-timeout-signout" onClick={() => void supabase.auth.signOut().finally(() => window.location.assign("/login"))}>Sign out</button></div>
  </div>;
}
