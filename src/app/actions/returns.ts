"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { returnSchema } from "@/lib/validation/returns";

export async function postReturn(formData: FormData): Promise<{ error?: string; id?: string }> {
  let items: unknown;
  try { items = JSON.parse(String(formData.get("items") ?? "")); } catch { return { error: "Return items are invalid." }; }
  const parsed = returnSchema.safeParse({
    return_type: formData.get("return_type"), source_id: formData.get("source_id"), reason: formData.get("reason"),
    disposition: formData.get("disposition"), items,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the return details." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to process a return." };
  const { data, error } = await supabase.rpc("post_return", { return_data: { ...parsed.data, request_key: crypto.randomUUID() } });
  if (error) {
    if (error.message.includes("exceeds the eligible")) return { error: "Returned quantity is greater than the remaining returnable quantity." };
    if (error.message.includes("Insufficient stock")) return { error: "There is not enough stock available to return these goods to the supplier." };
    return { error: "Could not post this return. Refresh the source document and retry." };
  }
  revalidatePath("/returns");
  revalidatePath("/inventory");
  revalidatePath(`/returns/${data}`);
  redirect(`/returns/${data}`);
}
