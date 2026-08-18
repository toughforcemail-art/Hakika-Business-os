import { AdminShell } from "@/components/AdminPage";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell kind="platform">{children}</AdminShell>;
}
