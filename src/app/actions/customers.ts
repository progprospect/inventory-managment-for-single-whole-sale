"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation/customer";

export async function createCustomer(formData: FormData): Promise<{ error?: string; success?: string; id?: string }> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review customer details." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to add customers." };
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!["owner_admin", "manager", "billing_staff"].includes(role?.role ?? "")) return { error: "Your role cannot manage customers." };
  const customer = parsed.data;
  const { data, error } = await supabase.from("customers").insert({
    name: customer.name, phone: customer.phone || null, email: customer.email || null,
    billing_address: customer.billing_address || null, state: customer.state || null,
    state_code: customer.state_code || null, gstin: customer.gstin || null,
    customer_type: customer.customer_type, opening_balance: customer.opening_balance,
  }).select("id").single();
  if (error || !data) return { error: "Could not add customer." };
  revalidatePath("/customers");
  revalidatePath("/billing");
  return { success: "Customer added.", id: data.id };
}
