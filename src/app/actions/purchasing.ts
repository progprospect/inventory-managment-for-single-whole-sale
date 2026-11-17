"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { purchaseDraftSchema, supplierSchema } from "@/lib/validation/purchasing";

async function purchasingAccess() {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." } as const;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to use purchasing." } as const;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!["owner_admin", "manager", "inventory_staff"].includes(data?.role ?? "")) return { error: "Your role cannot manage purchases." } as const;
  return { supabase, user } as const;
}

export async function createSupplier(formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review supplier details." };
  const access = await purchasingAccess();
  if ("error" in access) return { error: access.error };
  const value = parsed.data;
  const { error } = await access.supabase.from("suppliers").insert({
    name: value.name, contact_person: value.contact_person || null, phone: value.phone || null,
    email: value.email || null, address: value.address || null, gstin: value.gstin || null,
    state: value.state || null, state_code: value.state_code || null, opening_balance: value.opening_balance,
  });
  if (error) return { error: "Could not add supplier. Check the values and migration state." };
  revalidatePath("/suppliers");
  revalidatePath("/purchases/new");
  return { success: "Supplier added." };
}

export async function createPurchaseDraft(formData: FormData): Promise<{ error?: string; id?: string }> {
  const rawItems = formData.get("items");
  let items: unknown;
  try { items = JSON.parse(typeof rawItems === "string" ? rawItems : ""); } catch { return { error: "Purchase items are invalid." }; }
  const parsed = purchaseDraftSchema.safeParse({
    supplier_id: formData.get("supplier_id"), supplier_invoice_number: formData.get("supplier_invoice_number"),
    supplier_invoice_date: formData.get("supplier_invoice_date"), items,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the purchase details." };
  const access = await purchasingAccess();
  if ("error" in access) return { error: access.error };
  const { data, error } = await access.supabase.rpc("create_purchase_draft", { purchase_data: parsed.data });
  if (error) return { error: error.code === "23505" ? "That supplier invoice number is already recorded." : error.message.includes("supplier") ? error.message : "Could not save purchase draft. Check the database migration and item values." };
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  redirect(`/purchases/${data}`);
}

export async function postPurchase(formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = z.object({ purchase_id: z.uuid(), request_key: z.uuid() }).safeParse({ purchase_id: formData.get("purchase_id"), request_key: formData.get("request_key") });
  if (!parsed.success) return { error: "Invalid purchase posting request." };
  const access = await purchasingAccess();
  if ("error" in access) return { error: access.error };
  const { error } = await access.supabase.rpc("post_purchase", { target_purchase_id: parsed.data.purchase_id, request_key: parsed.data.request_key });
  if (error) return { error: error.message.includes("already posted") ? "This receipt is already posted." : "Could not post this purchase. Refresh and retry." };
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${parsed.data.purchase_id}`);
  revalidatePath("/inventory");
  return { success: "Purchase posted. Stock was updated from this receipt." };
}
