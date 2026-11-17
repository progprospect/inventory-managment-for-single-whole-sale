import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseForm } from "@/components/purchasing/purchase-form";

export default async function NewPurchasePage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to create purchase drafts.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase.from("suppliers").select("id,name").eq("is_archived", false).order("name"),
    supabase.from("products").select("id,name,sku,purchase_price,gst_rate").eq("is_archived", false).order("name").limit(500),
  ]);
  return <main className="mx-auto max-w-7xl p-6 md:p-10"><Link href="/purchases" className="text-sm text-blue-700">← Purchases</Link><h1 className="mb-6 mt-3 text-2xl font-bold">New purchase receipt</h1>{!suppliers?.length ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm text-amber-900">Add a supplier before recording a purchase.</p><Link href="/suppliers" className="mt-3 inline-block font-semibold text-amber-900 underline">Add supplier</Link></section> : !products?.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Add products before recording a purchase.</p> : <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><PurchaseForm suppliers={suppliers} products={products} /></section>}</main>;
}
