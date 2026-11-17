"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { saleDraftSchema } from "@/lib/validation/sales";

async function salesAccess() {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." } as const;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to use billing." } as const;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!["owner_admin", "manager", "billing_staff"].includes(data?.role ?? "")) return { error: "Your role cannot create sales invoices." } as const;
  return { supabase, user } as const;
}

export async function createSaleDraft(formData: FormData): Promise<{ error?: string; id?: string }> {
  let items: unknown;
  try { items = JSON.parse(String(formData.get("items") ?? "")); } catch { return { error: "Sale items are invalid." }; }
  const parsed = saleDraftSchema.safeParse({
    customer_id: formData.get("customer_id") ?? "", invoice_discount_amount: formData.get("invoice_discount_amount"),
    payment_amount: formData.get("payment_amount"), payment_method: formData.get("payment_method"), items,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the invoice details." };
  const access = await salesAccess();
  if ("error" in access) return { error: access.error };
  const { data, error } = await access.supabase.rpc("create_sale_draft", { sale_data: parsed.data });
  if (error) return { error: "Could not save invoice draft. Review products, quantities, and migration state." };
  revalidatePath("/invoices");
  redirect(`/invoices/${data}`);
}

export async function postSale(formData: FormData): Promise<{ error?: string; success?: string; invoiceNumber?: string }> {
  const parsed = z.object({ invoice_id: z.uuid(), request_key: z.uuid() }).safeParse({ invoice_id: formData.get("invoice_id"), request_key: formData.get("request_key") });
  if (!parsed.success) return { error: "Invalid invoice posting request." };
  const access = await salesAccess();
  if ("error" in access) return { error: access.error };
  const { data, error } = await access.supabase.rpc("post_sale", { target_invoice_id: parsed.data.invoice_id, request_key: parsed.data.request_key });
  if (error) {
    if (error.message.includes("Insufficient stock")) return { error: "Stock is not sufficient for one or more invoice items." };
    if (error.message.includes("state code")) return { error: "Add your shop state code in Business Profile before posting taxable invoices." };
    return { error: error.message.includes("already posted") ? "This invoice is already posted." : "Could not post invoice. Refresh and retry." };
  }
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${parsed.data.invoice_id}`);
  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: "Invoice posted and stock updated.", invoiceNumber: data };
}
