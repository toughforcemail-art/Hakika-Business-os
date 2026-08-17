"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import Link from "next/link";
const RouterContext = createContext({ pathname: "/", navigate: (_path: string) => {} });
export function MemoryRouter({ children }: { children: ReactNode; initialEntries?: string[] }) { return <RouterContext.Provider value={useMemo(() => ({ pathname: typeof window === "undefined" ? "/" : window.location.pathname, navigate: (path: string) => { window.location.href = path; } }), [])}>{children}</RouterContext.Provider>; }
export const BrowserRouter = MemoryRouter;
export function useNavigate() { return useContext(RouterContext).navigate; }
export function useLocation() { const { pathname } = useContext(RouterContext); return { pathname, search: "", hash: "", state: null, key: "default" }; }
export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() { return {} as T; }
export function useSearchParams() { return [new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), () => {}] as const; }
export function NavLink({ to, children, ...props }: any) { return <Link href={to} {...props}>{typeof children === "function" ? children({ isActive: false }) : children}</Link>; }
export { Link };
export function Navigate({ to }: { to: string }) { if (typeof window !== "undefined") window.location.href = to; return null; }
export function Routes({ children }: { children: ReactNode }) { return <>{children}</>; }
export function Route({ element }: { element?: ReactNode }) { return <>{element}</>; }
