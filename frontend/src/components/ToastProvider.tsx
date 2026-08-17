"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Toast = { id: string; kind: "success" | "error" | "warning" | "info" | "loading"; title: string; message?: string; action?: { label: string; href: string } };
type ToastContextValue = { push: (toast: Omit<Toast, "id">) => void; dismiss: (id: string) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() { const value = useContext(ToastContext); if (!value) throw new Error("ToastProvider is missing"); return value; }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${toast.kind}:${toast.title}:${toast.message ?? ""}`;
    setToasts((items) => [...items.filter((item) => item.id !== id), { ...toast, id }].slice(-4));
    if (toast.kind !== "error" && toast.kind !== "loading") window.setTimeout(() => dismiss(id), toast.kind === "success" ? 4000 : 5000);
  }, [dismiss]);
  useEffect(() => { const listener = (event: Event) => { const detail = (event as CustomEvent<Omit<Toast, "id">>).detail; if (detail) push(detail); }; window.addEventListener("hakika:toast", listener); return () => window.removeEventListener("hakika:toast", listener); }, [push]);
  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-stack" aria-live="polite" aria-atomic="false">{toasts.map((toast) => <div className={`toast toast-${toast.kind}`} key={toast.id} role={toast.kind === "error" ? "alert" : "status"} tabIndex={0}><div><strong>{toast.title}</strong>{toast.message && <p>{toast.message}</p>}{toast.action && <a href={toast.action.href}>{toast.action.label}</a>}</div>{toast.kind !== "loading" && <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">×</button>}</div>)}</div></ToastContext.Provider>;
}
