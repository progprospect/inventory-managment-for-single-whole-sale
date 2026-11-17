import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BillingForm } from "@/components/sales/billing-form";

export default async function BillingPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to use sales billing.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: stock }, { data: customers }, { data: settings }] = await Promise.all([
    supabase.from("product_stock").select("product_id,current_stock").limit(1000),
    supabase.from("customers").select("id,name,phone,gstin,state").eq("is_archived", false).order("name").limit(500),
    supabase.from("business_settings").select("prices_include_tax").eq("id", 1).single(),
  ]);
  const ids = (stock ?? []).map((row) => row.product_id);
  const [{ data: products }, { data: units }] = await Promise.all([
    supabase.from("products").select("id,name,sku,barcode,wholesale_price,alternate_price,gst_rate,unit_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).eq("is_archived", false).order("name"),
    supabase.from("units").select("id,abbreviation"),
  ]);
  const stockMap = new Map((stock ?? []).map((row) => [row.product_id, row.current_stock]));
  const unitMap = new Map((units ?? []).map((row) => [row.id, row.abbreviation]));
  const billingProducts = (products ?? []).map((product) => ({ ...product, current_stock: stockMap.get(product.id) ?? 0, unit_name: unitMap.get(product.unit_id) ?? "unit" }));
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><div className="mb-6 flex items-end justify-between gap-4"><div><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Sales & billing</h1><p className="mt-1 text-sm text-slate-500">Scan or search, set quantities, take payment, and save the bill.</p></div><Link href="/invoices" className="text-sm font-semibold text-blue-700">Previous invoices</Link></div><section className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-6"><BillingForm products={billingProducts} customers={customers ?? []} pricesIncludeTax={settings?.prices_include_tax ?? false} /></section></main>;
}
