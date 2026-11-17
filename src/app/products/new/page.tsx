import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/products/product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8"><h1 className="text-2xl font-bold">Add product</h1><p className="mt-3 text-slate-600">Configure Supabase to add products.</p></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: units }, { data: categories }] = await Promise.all([
    supabase.from("units").select("id,name,abbreviation").is("archived_at", null).order("name"),
    supabase.from("categories").select("id,name").is("archived_at", null).order("name"),
  ]);
  return <main className="mx-auto max-w-4xl p-6 md:p-10"><Link href="/products" className="text-sm text-blue-700">← Products</Link><h1 className="mb-6 mt-3 text-2xl font-bold">Add product</h1>{!units?.length ? <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">No units are configured. Apply the inventory migration and add a unit before creating products.</p> : <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><ProductForm units={units} categories={categories ?? []} /></section>}</main>;
}
