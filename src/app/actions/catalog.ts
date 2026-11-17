"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const categorySchema = z.object({ id: z.uuid().optional(), name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional() });
const unitSchema = z.object({ name: z.string().trim().min(1).max(60), abbreviation: z.string().trim().min(1).max(12), base_unit_id: z.union([z.uuid(), z.literal("")]), factor_to_base: z.coerce.number().positive().max(1000000) });

async function inventoryAccess() {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." } as const;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to manage the catalogue." } as const;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!["owner_admin", "manager", "inventory_staff"].includes(data?.role ?? "")) return { error: "Your role cannot manage the catalogue." } as const;
  return { supabase } as const;
}

export async function saveCategory(formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = categorySchema.safeParse({ id: formData.get("id") || undefined, name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review category details." };
  const access = await inventoryAccess();
  if ("error" in access) return { error: access.error };
  const { id, ...values } = parsed.data;
  const query = id ? access.supabase.from("categories").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id) : access.supabase.from("categories").insert(values);
  const { error } = await query;
  if (error) return { error: error.code === "23505" ? "That category name already exists." : "Could not save category." };
  revalidatePath("/categories");
  revalidatePath("/products");
  return { success: "Category saved." };
}

export async function archiveCategory(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const access = await inventoryAccess();
  if ("error" in access) return;
  await access.supabase.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", id.data);
  revalidatePath("/categories");
  revalidatePath("/products");
}

export async function saveUnit(formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = unitSchema.safeParse({ name: formData.get("name"), abbreviation: formData.get("abbreviation"), base_unit_id: formData.get("base_unit_id") ?? "", factor_to_base: formData.get("factor_to_base") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review unit details." };
  const access = await inventoryAccess();
  if ("error" in access) return { error: access.error };
  const { name, abbreviation, base_unit_id, factor_to_base } = parsed.data;
  if (!base_unit_id && factor_to_base !== 1) return { error: "A base unit must have a conversion factor of 1." };
  const { error } = await access.supabase.from("units").insert({ name, abbreviation, base_unit_id: base_unit_id || null, factor_to_base });
  if (error) return { error: error.code === "23505" ? "That unit name or abbreviation already exists." : "Could not save unit." };
  revalidatePath("/units");
  revalidatePath("/products/new");
  return { success: "Unit saved." };
}
