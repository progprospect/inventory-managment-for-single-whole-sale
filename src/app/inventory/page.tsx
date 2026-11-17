import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8"><h1 className="text-2xl font-bold">Inventory</h1><p className="mt-3 text-slate-600">Configure Supabase and apply the migrations to load stock.</p></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: balances, error } = await supabase.from("product_stock").select("product_id,current_stock,stock_status").order("stock_status").limit(500);
  const ids = (balances ?? []).map((row) => row.product_id);
  const [{ data: products }, { data: units }] = await Promise.all([
    ids.length ? supabase.from("products").select("id,name,sku,minimum_stock,unit_id").in("id", ids).eq("is_archived", false) : Promise.resolve({ data: [] }),
    supabase.from("units").select("id,abbreviation"),
  ]);
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const unitMap = new Map((units ?? []).map((unit) => [unit.id, unit.abbreviation]));
  const stockStatus = (status: string) => status === "out_of_stock" ? "bg-red-50 text-red-700" : status === "low_stock" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700";
  return <main className="mx-auto max-w-7xl p-6 md:p-10"><div className="mb-6"><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Inventory</h1><p className="mt-1 text-sm text-slate-500">Current balances calculated from the stock movement ledger.</p></div>
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load inventory. Apply the inventory migration and retry.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3 text-right">On hand</th><th className="px-5 py-3 text-right">Minimum</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">History</th></tr></thead><tbody className="divide-y divide-slate-100">{(balances ?? []).map((balance) => { const product = productMap.get(balance.product_id); if (!product) return null; return <tr key={product.id}><td className="px-5 py-4 font-semibold text-slate-800">{product.name}</td><td className="px-5 py-4 text-slate-500">{product.sku}</td><td className="px-5 py-4 text-right font-semibold">{Number(balance.current_stock).toLocaleString("en-IN")} {unitMap.get(product.unit_id)}</td><td className="px-5 py-4 text-right text-slate-600">{Number(product.minimum_stock).toLocaleString("en-IN")}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stockStatus(balance.stock_status)}`}>{balance.stock_status.replaceAll("_", " ")}</span></td><td className="px-5 py-4"><Link href={`/products/${product.id}/history`} className="text-sm font-medium text-blue-700">View</Link></td></tr>; })}</tbody></table>}{!error && balances?.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No stock records yet. Create products and enter opening quantities to get started.</p>}</section>
  </main>;
}
