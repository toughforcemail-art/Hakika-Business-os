import { redirect } from "next/navigation";

export default function LegacyPasswordReset() {
  redirect("/auth/forgot-password");
}
