import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form";

export default async function StockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to view stock history.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: product }, { data: movements, error }] = await Promise.all([
    supabase.from("products").select("id,name,sku").eq("id", id).single(),
    supabase.from("stock_movements").select("id,quantity_delta,movement_type,reason,source_type,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(200),
  ]);
  if (!product) notFound();
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><Link href={`/products/${id}`} className="text-sm text-blue-700">← {product.name}</Link><h1 className="mt-3 text-2xl font-bold">Stock history</h1><p className="mb-6 mt-1 text-sm text-slate-500">{product.name} · {product.sku}</p><section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold">Manual adjustment</h2><StockAdjustmentForm productId={id} /></section><section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load stock history.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date / time</th><th className="px-5 py-3">Movement</th><th className="px-5 py-3">Reason / source</th><th className="px-5 py-3 text-right">Change</th></tr></thead><tbody className="divide-y divide-slate-100">{(movements ?? []).map((movement) => <tr key={movement.id}><td className="px-5 py-4 text-slate-600">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(movement.created_at))}</td><td className="px-5 py-4 font-medium">{movement.movement_type.replaceAll("_", " ")}</td><td className="px-5 py-4 text-slate-600">{movement.reason ?? movement.source_type ?? "—"}</td><td className={`px-5 py-4 text-right font-semibold ${Number(movement.quantity_delta) < 0 ? "text-red-700" : "text-green-700"}`}>{Number(movement.quantity_delta) > 0 ? "+" : ""}{Number(movement.quantity_delta).toLocaleString("en-IN")}</td></tr>)}</tbody></table>}{!error && movements?.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No stock movements for this product yet.</p>}</section></main>;
}
