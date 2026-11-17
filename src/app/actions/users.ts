"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["owner_admin", "manager", "billing_staff", "inventory_staff"]),
});

export async function changeUserRole(formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = roleSchema.safeParse({ userId: formData.get("user_id"), role: formData.get("role") });
  if (!parsed.success) return { error: "Select a valid user and role." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to manage roles." };
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (role?.role !== "owner_admin") return { error: "Only an owner/admin can manage roles." };
  const { error } = await supabase.rpc("change_user_role", { target_user_id: parsed.data.userId, new_role: parsed.data.role });
  if (error) return { error: error.message.includes("last owner/admin") ? error.message : "Could not update that role. Refresh and try again." };
  revalidatePath("/settings/users");
  return { success: "Role updated." };
}
