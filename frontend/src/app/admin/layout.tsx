import { AdminShell } from "@/components/AdminPage";

export default function CustomerAdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell kind="customer">{children}</AdminShell>;
}
