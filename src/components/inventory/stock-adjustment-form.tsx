"use client";

import { useState, useTransition } from "react";
import { adjustStock } from "@/app/actions/products";

export function StockAdjustmentForm({ productId }: { productId: string }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  return <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("request_key", crypto.randomUUID());
    startTransition(async () => setMessage(await adjustStock(formData)));
  }}>
    <input type="hidden" name="product_id" value={productId} />
    <label className="text-xs font-medium text-slate-600">Quantity change<input required name="quantity_delta" type="number" step="0.001" className="mt-1 block w-36 rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label>
    <label className="min-w-56 flex-1 text-xs font-medium text-slate-600">Reason<input required minLength={3} maxLength={240} name="reason" className="mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm" placeholder="Count correction, damage, etc." /></label>
    <button disabled={pending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Adjust stock"}</button>
    {message.error && <p role="alert" className="w-full text-sm text-red-700">{message.error}</p>}{message.success && <p role="status" className="w-full text-sm text-green-700">{message.success}</p>}
  </form>;
}
