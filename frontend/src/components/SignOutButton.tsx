"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  return <button className="button sign-out-button" type="button" onClick={async () => { await fetch("/api/auth/sms-step-up/logout", { method: "POST" }); await createSupabaseBrowserClient().auth.signOut(); window.location.assign("/login"); }}>Log out</button>;
}
