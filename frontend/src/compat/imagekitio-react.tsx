import type { ReactNode } from "react";
export function ImageKitProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export function IKContext({ children }: { children: ReactNode }) { return <>{children}</>; }
export function IKImage(props: any) { return <img {...props} alt={props.alt ?? ""} />; }
export function IKUpload(props: any) { return <input type="file" {...props} />; }
