import type { ReactNode } from "react";
export const motion = new Proxy({}, { get: () => (props: any) => <div {...props}>{props.children}</div> }) as any;
export function AnimatePresence({ children }: { children: ReactNode }) { return <>{children}</>; }
export function useMotionValue(value: any) { return { get: () => value, set: () => {} }; }
export function useTransform(value: any) { return value; }
