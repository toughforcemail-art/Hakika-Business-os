"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile, type ProfileActionState } from "./actions";

function SaveButton() { const { pending } = useFormStatus(); return <button className="re-button primary" type="submit" disabled={pending}>{pending ? "Saving..." : "Save profile"}</button>; }

export function ProfileForm({ initial }: { initial: { displayName: string; email: string; phone: string; locale: string } }) {
  const [state, action] = useActionState<ProfileActionState, FormData>(updateProfile, {});
  const [displayName, setDisplayName] = useState(initial.displayName); const [phone, setPhone] = useState(initial.phone); const [locale, setLocale] = useState(initial.locale);
  return <form action={action} className="card panel profile-form"><label>Display name<input name="display_name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label><label>Email address<input value={initial.email} readOnly /></label><label>Phone number<input name="phone_e164" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254 712 345 678" /></label><label>Language and region<select name="locale" value={locale} onChange={(event) => setLocale(event.target.value)}><option value="en-KE">English (Kenya)</option><option value="en-US">English (United States)</option></select></label>{state.error && <p className="re-form-error" role="alert">{state.error}</p>}{state.success && <p className="profile-form-success" role="status">{state.success}</p>}<div className="profile-form-actions"><SaveButton/><Link className="re-button secondary" href="/apps">Cancel</Link></div></form>;
}
