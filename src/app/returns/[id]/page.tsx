import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to view returns.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: record }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("returns").select("*").eq("id", id).single(),
    supabase.from("return_items").select("*").eq("return_id", id).order("created_at"),
    supabase.from("return_payments").select("amount,disposition,created_at").eq("return_id", id),
  ]);
  if (!record) notFound();
  const sourceHref = record.sales_invoice_id ? `/invoices/${record.sales_invoice_id}` : `/purchases/${record.purchase_receipt_id}`;
  return <main className="mx-auto max-w-5xl p-6 md:p-10"><Link href="/returns" className="text-sm text-blue-700">← Returns</Link><h1 className="mt-3 text-2xl font-bold">Return RET-{record.return_number}</h1><p className="mt-1 text-sm text-slate-500 capitalize">{record.return_type.replaceAll("_", " ")} · {record.reason}</p><p className="mb-6 mt-2 text-sm">Original document: <Link href={sourceHref} className="text-blue-700">View source</Link></p><section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-right">Tax adjustment</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{(items ?? []).map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold">{item.product_name}<span className="block text-xs font-normal text-slate-500">{item.sku}</span></td><td className="px-5 py-4 text-right">{Number(item.quantity)}</td><td className="px-5 py-4 text-right">₹{(Number(item.cgst_amount)+Number(item.sgst_amount)+Number(item.igst_amount)).toFixed(2)}</td><td className="px-5 py-4 text-right font-semibold">₹{Number(item.line_amount).toFixed(2)}</td></tr>)}</tbody></table><div className="flex justify-end border-t border-slate-200 p-5 text-lg font-bold">Total: ₹{Number(record.amount).toFixed(2)}</div></section><p className="mt-4 text-sm text-slate-600">Adjustment: <span className="capitalize">{record.disposition.replaceAll("_", " ")}</span></p>{(payments ?? []).map((payment, index) => <p key={index} className="mt-1 text-sm text-slate-500">₹{Number(payment.amount).toFixed(2)} recorded as {payment.disposition.replaceAll("_", " ")}</p>)}</main>;
}
