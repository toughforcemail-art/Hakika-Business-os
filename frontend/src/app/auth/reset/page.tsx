import { redirect } from "next/navigation";

export default function LegacyCompletePasswordReset() {
  redirect("/auth/update-password");
}
