"use server";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/server";
export async function markNotificationRead(id: string) { const { supabase, context } = await requireAuthenticatedUser(); await supabase.schema("platform").from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("recipient_user_id", context.userId); revalidatePath("/notifications"); }
export async function markAllNotificationsRead() { const { supabase, context } = await requireAuthenticatedUser(); await supabase.schema("platform").from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_user_id", context.userId).is("read_at", null); revalidatePath("/notifications"); }
