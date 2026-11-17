"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useState, useTransition } from "react";
import { createPurchaseDraft } from "@/app/actions/purchasing";
import { purchaseDraftSchema } from "@/lib/validation/purchasing";
import type { z } from "zod";

type Values = z.infer<typeof purchaseDraftSchema>;
type FormValues = z.input<typeof purchaseDraftSchema>;
type ProductOption = { id: string; name: string; sku: string; purchase_price: number | string; gst_rate: number | string };
type SupplierOption = { id: string; name: string };
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export function PurchaseForm({ suppliers, products }: { suppliers: SupplierOption[]; products: ProductOption[] }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const { register, control, setValue, handleSubmit, formState: { errors } } = useForm<FormValues, unknown, Values>({
    resolver: zodResolver(purchaseDraftSchema),
    defaultValues: { supplier_id: "", supplier_invoice_number: "", supplier_invoice_date: today, items: [{ product_id: "", quantity: 1, purchase_rate: 0, discount_percent: 0, gst_rate: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });
  const preview = (watched.items ?? []).reduce((total, item) => {
    const gross = Number(item.quantity || 0) * Number(item.purchase_rate || 0);
    const taxable = gross * (1 - Number(item.discount_percent || 0) / 100);
    return total + taxable * (1 + Number(item.gst_rate || 0) / 100);
  }, 0);
  const submit = handleSubmit((values) => {
    const data = new FormData();
    data.set("supplier_id", values.supplier_id);
    data.set("supplier_invoice_number", values.supplier_invoice_number);
    data.set("supplier_invoice_date", values.supplier_invoice_date);
    data.set("items", JSON.stringify(values.items));
    startTransition(async () => {
      const result = await createPurchaseDraft(data);
      if (result.error) setMessage(result.error);
    });
  });
  return <form onSubmit={submit} className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Supplier<select {...register("supplier_id")} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>{errors.supplier_id && <span className="text-xs text-red-600">{errors.supplier_id.message}</span>}</label><label className="text-sm font-medium">Supplier invoice number<input {...register("supplier_invoice_number")} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-medium">Invoice date<input {...register("supplier_invoice_date")} type="date" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label></div>
    <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Product</th><th className="p-3">Quantity</th><th className="p-3">Rate</th><th className="p-3">Discount %</th><th className="p-3">GST %</th><th className="p-3">Line total*</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{fields.map((field, index) => { const line = watched.items?.[index]; const gross = Number(line?.quantity || 0) * Number(line?.purchase_rate || 0); const taxable = gross * (1 - Number(line?.discount_percent || 0) / 100); const total = taxable * (1 + Number(line?.gst_rate || 0) / 100); return <tr key={field.id}><td className="p-2"><select {...register(`items.${index}.product_id`, { onChange: (event) => { const product = products.find((item) => item.id === event.target.value); if (product) { setValue(`items.${index}.purchase_rate`, Number(product.purchase_price)); setValue(`items.${index}.gst_rate`, Number(product.gst_rate)); } } })} className="w-full rounded-md border border-slate-300 bg-white px-2 py-2"><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></td><td className="p-2"><input {...register(`items.${index}.quantity`, { valueAsNumber: true })} type="number" min="0.001" step="0.001" className="w-28 rounded-md border border-slate-300 px-2 py-2" /></td><td className="p-2"><input {...register(`items.${index}.purchase_rate`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="w-28 rounded-md border border-slate-300 px-2 py-2" /></td><td className="p-2"><input {...register(`items.${index}.discount_percent`, { valueAsNumber: true })} type="number" min="0" max="100" step="0.01" className="w-24 rounded-md border border-slate-300 px-2 py-2" /></td><td className="p-2"><input {...register(`items.${index}.gst_rate`, { valueAsNumber: true })} type="number" min="0" max="100" step="0.01" className="w-24 rounded-md border border-slate-300 px-2 py-2" /></td><td className="p-2 text-right font-medium">₹{total.toFixed(2)}</td><td className="p-2"><button type="button" onClick={() => remove(index)} disabled={fields.length === 1} className="text-xs font-medium text-red-700 disabled:opacity-40">Remove</button></td></tr>; })}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => append({ product_id: "", quantity: 1, purchase_rate: 0, discount_percent: 0, gst_rate: 0 })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium">+ Add item</button><div className="text-right"><p className="text-xs text-slate-500">Preview total* (server-calculated on save)</p><p className="text-xl font-bold">₹{preview.toFixed(2)}</p></div></div>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}<button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving draft…" : "Save purchase draft"}</button>
    <p className="text-xs text-slate-500">*The preview is for review only. PostgreSQL recalculates and stores the final tax amounts.</p>
  </form>;
}
