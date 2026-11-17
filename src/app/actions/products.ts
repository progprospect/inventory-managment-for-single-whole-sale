"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { productSchema, stockAdjustmentSchema } from "@/lib/validation/product";

const inventoryRoles = ["owner_admin", "manager", "inventory_staff"];

async function authorizedInventoryClient() {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." } as const;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to manage products and stock." } as const;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!inventoryRoles.includes(data?.role ?? "")) return { error: "Your role cannot make this inventory change." } as const;
  return { supabase, user } as const;
}

function productFromForm(formData: FormData) {
  return productSchema.safeParse({
    id: formData.get("id") || undefined, sku: formData.get("sku") ?? "", barcode: formData.get("barcode") ?? "",
    name: formData.get("name"), description: formData.get("description") ?? "", category_id: formData.get("category_id") ?? "",
    unit_id: formData.get("unit_id"), purchase_price: formData.get("purchase_price"), wholesale_price: formData.get("wholesale_price"),
    alternate_price: formData.get("alternate_price"), gst_rate: formData.get("gst_rate"), hsn_code: formData.get("hsn_code") ?? "",
    opening_stock: formData.get("opening_stock") ?? 0, minimum_stock: formData.get("minimum_stock") ?? 0,
  });
}

export async function createProduct(formData: FormData): Promise<{ error?: string; id?: string }> {
  const access = await authorizedInventoryClient();
  if ("error" in access) return { error: access.error };
  const parsed = productFromForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the product fields." };
  const value = parsed.data;
  const { data, error } = await access.supabase.rpc("create_product", { product_data: {
    sku: value.sku, barcode: value.barcode, name: value.name, description: value.description,
    category_id: value.category_id, unit_id: value.unit_id, purchase_price: value.purchase_price,
    wholesale_price: value.wholesale_price, alternate_price: value.alternate_price ?? null,
    gst_rate: value.gst_rate, hsn_code: value.hsn_code, opening_stock: value.opening_stock, minimum_stock: value.minimum_stock,
  } });
  if (error) return { error: error.code === "23505" ? "That SKU or barcode is already in use." : "Could not create product. Check the fields and migration state." };
  revalidatePath("/products");
  revalidatePath("/inventory");
  return { id: data };
}

export async function updateProduct(formData: FormData): Promise<{ error?: string; success?: string }> {
  const access = await authorizedInventoryClient();
  if ("error" in access) return { error: access.error };
  const parsed = productFromForm(formData);
  if (!parsed.success || !parsed.data.id) return { error: parsed.success ? "Product ID is required." : parsed.error.issues[0]?.message ?? "Review the product fields." };
  const value = parsed.data;
  if (!value.sku) return { error: "SKU is required when editing a product." };
  const { error } = await access.supabase.from("products").update({
    sku: value.sku, barcode: value.barcode || null, name: value.name, description: value.description || null,
    category_id: value.category_id || null, unit_id: value.unit_id, purchase_price: value.purchase_price,
    wholesale_price: value.wholesale_price, alternate_price: value.alternate_price ?? null, gst_rate: value.gst_rate,
    hsn_code: value.hsn_code || null, minimum_stock: value.minimum_stock, updated_at: new Date().toISOString(),
  }).eq("id", value.id);
  if (error) return { error: error.code === "23505" ? "That SKU or barcode is already in use." : "Could not update product." };
  revalidatePath("/products");
  revalidatePath(`/products/${value.id}`);
  revalidatePath("/inventory");
  return { success: "Product saved." };
}

export async function archiveProduct(formData: FormData): Promise<{ error?: string; success?: string }> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Select a valid product." };
  const access = await authorizedInventoryClient();
  if ("error" in access) return { error: access.error };
  const { error } = await access.supabase.from("products").update({ is_archived: true, updated_at: new Date().toISOString() }).eq("id", id.data);
  if (error) return { error: "Could not archive the product." };
  revalidatePath("/products");
  revalidatePath("/inventory");
  return { success: "Product archived." };
}

export async function archiveProductForm(formData: FormData): Promise<void> {
  await archiveProduct(formData);
}

export async function adjustStock(formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = stockAdjustmentSchema.safeParse({
    product_id: formData.get("product_id"), quantity_delta: formData.get("quantity_delta"),
    reason: formData.get("reason"), request_key: formData.get("request_key"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the stock adjustment." };
  const access = await authorizedInventoryClient();
  if ("error" in access) return { error: access.error };
  const { error } = await access.supabase.rpc("adjust_stock", {
    target_product_id: parsed.data.product_id, quantity_change: parsed.data.quantity_delta,
    adjustment_reason: parsed.data.reason, request_key: parsed.data.request_key,
  });
  if (error) return { error: error.message.includes("negative") ? "This adjustment would make stock negative." : "Could not record stock adjustment." };
  revalidatePath("/inventory");
  revalidatePath(`/products/${parsed.data.product_id}/history`);
  return { success: "Stock movement recorded." };
}
