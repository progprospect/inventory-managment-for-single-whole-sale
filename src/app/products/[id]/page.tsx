import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/products/product-form";
import { archiveProductForm } from "@/app/actions/products";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to view products.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: product }, { data: units }, { data: categories }, { data: stock }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("units").select("id,name,abbreviation").is("archived_at", null).order("name"),
    supabase.from("categories").select("id,name").is("archived_at", null).order("name"),
    supabase.from("product_stock").select("current_stock,stock_status").eq("product_id", id).maybeSingle(),
  ]);
  if (!product) notFound();
  const initial = {
    id: product.id, sku: product.sku, barcode: product.barcode ?? "", name: product.name, description: product.description ?? "",
    category_id: product.category_id ?? "", unit_id: product.unit_id, purchase_price: Number(product.purchase_price),
    wholesale_price: Number(product.wholesale_price), alternate_price: product.alternate_price == null ? undefined : Number(product.alternate_price),
    gst_rate: Number(product.gst_rate), hsn_code: product.hsn_code ?? "", opening_stock: 0, minimum_stock: Number(product.minimum_stock),
  };
  return <main className="mx-auto max-w-4xl p-6 md:p-10"><Link href="/products" className="text-sm text-blue-700">← Products</Link><div className="mb-6 mt-3 flex items-start justify-between"><div><h1 className="text-2xl font-bold">{product.name}</h1><p className="mt-1 text-sm text-slate-500">SKU {product.sku} · Stock {Number(stock?.current_stock ?? 0).toLocaleString("en-IN")}</p></div><Link href={`/products/${id}/history`} className="text-sm font-semibold text-blue-700">Stock history</Link></div><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><ProductForm units={units ?? []} categories={categories ?? []} initial={initial} /></section><form action={archiveProductForm} className="mt-5"><input type="hidden" name="id" value={id} /><button className="text-sm font-medium text-red-700">Archive product</button></form></main>;
}
