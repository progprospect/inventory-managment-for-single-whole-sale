import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReturnForm } from "@/components/returns/return-form";

type SourceItem = { id: string; product_name: string; sku: string; quantity: number | string; unit_name: string; line_total: number | string };

export default async function NewReturnPage({ searchParams }: { searchParams: Promise<{ kind?: string; source?: string }> }) {
  const { kind, source } = await searchParams;
  if ((kind !== "sales" && kind !== "purchase") || !source) notFound();
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to process returns.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sale = kind === "sales";
  let sourceLabel = "";
  let originalItems: SourceItem[] = [];
  if (sale) {
    const [{ data: sourceDoc }, { data: rows }] = await Promise.all([
      supabase.from("sales_invoices").select("id,invoice_number,customer_name").eq("id", source).eq("status", "posted").single(),
      supabase.from("sales_items").select("id,product_name,sku,quantity,unit_name,line_total").eq("invoice_id", source).order("created_at"),
    ]);
    if (!sourceDoc) notFound();
    sourceLabel = `${sourceDoc.invoice_number} · ${sourceDoc.customer_name}`;
    originalItems = rows ?? [];
  } else {
    const [{ data: sourceDoc }, { data: rows }] = await Promise.all([
      supabase.from("purchase_receipts").select("id,receipt_number,supplier_invoice_number").eq("id", source).eq("status", "posted").single(),
      supabase.from("purchase_items").select("id,product_name,sku,quantity,unit_name,line_total").eq("purchase_id", source).order("created_at"),
    ]);
    if (!sourceDoc) notFound();
    sourceLabel = `PUR-${sourceDoc.receipt_number} · Supplier invoice ${sourceDoc.supplier_invoice_number}`;
    originalItems = rows ?? [];
  }
  const { data: priorReturns } = await supabase.from("returns").select("id").eq(sale ? "sales_invoice_id" : "purchase_receipt_id", source).eq("status", "posted");
  const priorIds = (priorReturns ?? []).map((row) => row.id);
  const { data: returnedItems } = priorIds.length ? await supabase.from("return_items").select("sales_item_id,purchase_item_id,quantity").in("return_id", priorIds) : { data: [] };
  const returnedQty = new Map<string, number>();
  for (const row of returnedItems ?? []) {
    const key = sale ? row.sales_item_id : row.purchase_item_id;
    if (key) returnedQty.set(key, (returnedQty.get(key) ?? 0) + Number(row.quantity));
  }
  const lines = originalItems.map((item) => ({
    lineId: item.id, productName: item.product_name, sku: item.sku, quantity: Number(item.quantity), unit: item.unit_name,
    amount: Number(item.line_total), eligible: Math.max(0, Number(item.quantity) - (returnedQty.get(item.id) ?? 0)),
  }));
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><Link href="/returns" className="text-sm text-blue-700">&larr; Returns</Link><h1 className="mt-3 text-2xl font-bold">{sale ? "Sales return" : "Purchase return"}</h1><p className="mb-6 mt-1 text-sm text-slate-500">Original document: {sourceLabel}</p>{lines.every((line) => line.eligible <= 0) ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">All quantities from this document have already been returned.</p> : <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><ReturnForm kind={sale ? "sales_return" : "purchase_return"} sourceId={source} items={lines} /></section>}</main>;
}
