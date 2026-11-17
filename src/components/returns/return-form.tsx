"use client";

import { useState, useTransition } from "react";
import { postReturn } from "@/app/actions/returns";

type ReturnableItem = { lineId: string; productName: string; sku: string; quantity: number; unit: string; amount: number; eligible: number };
export function ReturnForm({ kind, sourceId, items }: { kind: "sales_return" | "purchase_return"; sourceId: string; items: ReturnableItem[] }) {
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState(kind === "sales_return" ? "cash" : "supplier_credit");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const sale = kind === "sales_return";
  const submit = () => {
    const selected = items.filter((item) => Number(quantities[item.lineId] ?? 0) > 0).map((item) => ({
      ...(sale ? { sales_item_id: item.lineId } : { purchase_item_id: item.lineId }), quantity: Number(quantities[item.lineId]),
    }));
    const formData = new FormData();
    formData.set("return_type", kind);
    formData.set("source_id", sourceId);
    formData.set("reason", reason);
    formData.set("disposition", disposition);
    formData.set("items", JSON.stringify(selected));
    startTransition(async () => {
      const result = await postReturn(formData);
      if (result.error) setMessage(result.error);
    });
  };
  return <div className="space-y-5"><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Product</th><th className="p-3 text-right">Original qty</th><th className="p-3 text-right">Eligible</th><th className="p-3 text-right">Return qty</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.lineId}><td className="p-3 font-semibold">{item.productName}<span className="block text-xs font-normal text-slate-500">{item.sku} · {item.amount.toFixed(2)} total</span></td><td className="p-3 text-right">{item.quantity} {item.unit}</td><td className="p-3 text-right">{item.eligible} {item.unit}</td><td className="p-3 text-right"><input aria-label={`Return quantity for ${item.productName}`} disabled={item.eligible <= 0} type="number" min="0" max={item.eligible} step="0.001" value={quantities[item.lineId] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [item.lineId]: Number(event.target.value) }))} className="w-28 rounded-md border border-slate-300 px-2 py-2 text-right" /></td></tr>)}</tbody></table></div>
    <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Reason<textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><div><label className="text-sm font-medium">{sale ? "Refund / adjustment" : "Supplier adjustment"}<select value={disposition} onChange={(event) => setDisposition(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">{sale ? <><option value="cash">Cash refund</option><option value="upi">UPI refund</option><option value="card">Card refund</option><option value="bank_transfer">Bank transfer refund</option><option value="credit_adjustment">Customer credit adjustment</option></> : <><option value="supplier_credit">Supplier credit</option><option value="credit_adjustment">Supplier balance adjustment</option></>}</select></label><p className="mt-2 text-xs leading-5 text-slate-500">Return value and tax reversal are calculated from the original posted document. The database rejects quantities already returned.</p></div></div>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}<button onClick={submit} disabled={pending || !items.some((item) => Number(quantities[item.lineId] ?? 0) > 0)} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Posting return…" : "Confirm and post return"}</button>
  </div>;
}
