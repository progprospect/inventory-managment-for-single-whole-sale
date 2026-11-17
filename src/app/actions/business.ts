"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { businessSettingsSchema } from "@/lib/validation/business";

export async function updateBusinessSettings(formData: FormData): Promise<{ error?: string; success?: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update business settings." };
  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleRow?.role !== "owner_admin") return { error: "Only an owner/admin can change business settings." };

  const parseOptional = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const parsed = businessSettingsSchema.safeParse({
    shop_name: formData.get("shop_name"), address: parseOptional("address"), phone: parseOptional("phone"),
    email: parseOptional("email"), gstin: parseOptional("gstin"), state: parseOptional("state"), state_code: parseOptional("state_code"),
    invoice_prefix: formData.get("invoice_prefix"), default_gst_rate: Number(formData.get("default_gst_rate")),
    prices_include_tax: formData.get("prices_include_tax") === "on", invoice_footer: parseOptional("invoice_footer"), invoice_terms: parseOptional("invoice_terms"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the business settings." };
  const { error } = await supabase.from("business_settings").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: "Could not save business settings. Check the database migration and field values." };
  revalidatePath("/settings/business");
  revalidatePath("/");
  return { success: "Business profile saved." };
}
