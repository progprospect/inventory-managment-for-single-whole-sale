import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  if (!supabase) return <main className="p-8"><h1 className="text-2xl font-bold">Products</h1><p className="mt-3 text-slate-600">Configure Supabase and apply the migrations to load products.</p></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const search = q.trim().replace(/[%_]/g, "");
  const selection = "id,sku,barcode,name,purchase_price,wholesale_price,gst_rate,category_id,unit_id";
  const [byName, bySku, byBarcode, { data: categories }, { data: units }] = await Promise.all([
    supabase.from("products").select(selection).eq("is_archived", false).ilike("name", search ? `%${search}%` : "%").order("name").limit(100),
    supabase.from("products").select(selection).eq("is_archived", false).ilike("sku", search).limit(100),
    supabase.from("products").select(selection).eq("is_archived", false).ilike("barcode", search).limit(100),
    supabase.from("categories").select("id,name"),
    supabase.from("units").select("id,name,abbreviation"),
  ]);
  const productMapRows = new Map([...(byName.data ?? []), ...(bySku.data ?? []), ...(byBarcode.data ?? [])].map((product) => [product.id, product]));
  const products = [...productMapRows.values()];
  const error = byName.error ?? bySku.error ?? byBarcode.error;
  const categoryMap = new Map((categories ?? []).map((row) => [row.id, row.name]));
  const unitMap = new Map((units ?? []).map((row) => [row.id, `${row.name}`]));
  return <main className="mx-auto max-w-7xl p-6 md:p-10"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Products</h1><p className="mt-1 text-sm text-slate-500">Catalogue, prices, units, and GST rates.</p></div><Link href="/products/new" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">Add product</Link></div>
    <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Search name, SKU, or barcode" className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" /><button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium">Search</button></form>
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load products. Apply the products migration and retry.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">SKU / barcode</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Unit</th><th className="px-5 py-3 text-right">Purchase</th><th className="px-5 py-3 text-right">Wholesale</th><th className="px-5 py-3 text-right">GST</th></tr></thead><tbody className="divide-y divide-slate-100">{(products ?? []).map((product) => <tr key={product.id} className="hover:bg-slate-50"><td className="px-5 py-4"><Link className="font-semibold text-slate-800 hover:text-blue-700" href={`/products/${product.id}`}>{product.name}</Link></td><td className="px-5 py-4 text-slate-500">{product.sku}<span className="block text-xs">{product.barcode ?? "—"}</span></td><td className="px-5 py-4 text-slate-600">{categoryMap.get(product.category_id ?? "") ?? "—"}</td><td className="px-5 py-4 text-slate-600">{unitMap.get(product.unit_id) ?? "—"}</td><td className="px-5 py-4 text-right">₹{Number(product.purchase_price).toFixed(2)}</td><td className="px-5 py-4 text-right">₹{Number(product.wholesale_price).toFixed(2)}</td><td className="px-5 py-4 text-right">{Number(product.gst_rate)}%</td></tr>)}</tbody></table>}{!error && products?.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No products found. Add your first product to begin inventory tracking.</p>}</section>
  </main>;
}
