"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { createSaleDraft } from "@/app/actions/sales";
import { CustomerForm } from "@/components/customers/customer-form";
import { saleDraftSchema } from "@/lib/validation/sales";
import type { z } from "zod";

type Values = z.infer<typeof saleDraftSchema>;
type FormValues = z.input<typeof saleDraftSchema>;
type Product = { id: string; name: string; sku: string; barcode: string | null; wholesale_price: number | string; alternate_price: number | string | null; gst_rate: number | string; current_stock: number | string; unit_name: string };
type Customer = { id: string; name: string; phone: string | null; gstin: string | null; state: string | null };

export function BillingForm({ products, customers, pricesIncludeTax }: { products: Product[]; customers: Customer[]; pricesIncludeTax: boolean }) {
  const [search, setSearch] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const { register, control, setValue, getValues, handleSubmit, formState: { errors } } = useForm<FormValues, unknown, Values>({
    resolver: zodResolver(saleDraftSchema),
    defaultValues: { customer_id: "", invoice_discount_amount: 0, payment_amount: 0, payment_method: "cash", items: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });
  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return [];
    return products.filter((p) => `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLocaleLowerCase().includes(term)).slice(0, 8);
  }, [products, search]);
  const subtotal = (watched.items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0) * (1 - Number(item.discount_percent || 0) / 100), 0);
  const invoiceDiscount = Number(watched.invoice_discount_amount || 0);
  const previewTotal = Math.max(subtotal - invoiceDiscount, 0);
  const addProduct = (product: Product) => {
    const existing = getValues("items").findIndex((item) => item.product_id === product.id);
    if (existing >= 0) setValue(`items.${existing}.quantity`, Number(getValues(`items.${existing}.quantity`) || 0) + 1);
    else append({ product_id: product.id, quantity: 1, unit_price: Number(product.wholesale_price), discount_percent: 0 });
    setSearch("");
    searchRef.current?.focus();
  };
  const submit = handleSubmit((values) => {
    const data = new FormData();
    data.set("customer_id", values.customer_id);
    data.set("invoice_discount_amount", String(values.invoice_discount_amount));
    data.set("payment_amount", String(values.payment_amount));
    data.set("payment_method", values.payment_method);
    data.set("items", JSON.stringify(values.items));
    startTransition(async () => {
      const result = await createSaleDraft(data);
      if (result.error) setMessage(result.error);
    });
  });
  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
      <div><label className="text-sm font-medium text-slate-700">Customer<select {...register("customer_id")} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Walk-in customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select>{errors.customer_id && <span className="text-xs text-red-600">{errors.customer_id.message}</span>}</label><button type="button" onClick={() => setShowCustomerForm((show) => !show)} className="mt-2 text-xs font-semibold text-blue-700">+ Create customer</button></div>
      <div className="flex items-end"><label className="text-sm font-medium text-slate-700">Payment method<select {...register("payment_method")} className="mt-1.5 block min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="credit">Credit</option></select></label></div>
    </div>
    {showCustomerForm && <section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Add customer</h2><button type="button" onClick={() => setShowCustomerForm(false)} className="text-sm text-slate-600">Close</button></div><CustomerForm onCreated={(id) => { setValue("customer_id", id); setShowCustomerForm(false); }} /></section>}
    <section className="relative"><label className="text-sm font-medium text-slate-700">Scan barcode or search product<input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { event.preventDefault(); addProduct(results[0]); } }} autoComplete="off" autoFocus placeholder="Type name, SKU, or scan barcode then press Enter" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-600" /></label>
      {results.length > 0 && <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">{results.map((product) => <button type="button" key={product.id} disabled={Number(product.current_stock) <= 0} onClick={() => addProduct(product)} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"><span><span className="block text-sm font-semibold">{product.name}</span><span className="text-xs text-slate-500">{product.sku} · {product.barcode ?? "no barcode"}</span></span><span className="text-right text-sm font-semibold">₹{Number(product.wholesale_price).toFixed(2)}<span className="block text-xs font-normal text-slate-500">Stock {Number(product.current_stock)} {product.unit_name}</span></span></button>)}</div>}
    </section>
    <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Product</th><th className="p-3 text-right">Available</th><th className="p-3">Quantity</th><th className="p-3">Rate</th><th className="p-3">Discount %</th><th className="p-3 text-right">Amount</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{fields.map((field, index) => { const item = watched.items?.[index]; const product = products.find((candidate) => candidate.id === item?.product_id); const amount = Number(item?.quantity || 0) * Number(item?.unit_price || 0) * (1 - Number(item?.discount_percent || 0) / 100); return <tr key={field.id}><td className="p-3 font-semibold">{product?.name}<span className="block text-xs font-normal text-slate-500">{product?.sku} · {product?.unit_name} · GST {Number(product?.gst_rate ?? 0)}%</span>{product?.alternate_price != null && <button type="button" onClick={() => setValue(`items.${index}.unit_price`, Number(product.alternate_price))} className="mt-1 text-xs font-medium text-blue-700">Use alternate price ₹{Number(product.alternate_price).toFixed(2)}</button>}</td><td className="p-3 text-right text-slate-600">{Number(product?.current_stock ?? 0)}</td><td className="p-3"><input {...register(`items.${index}.quantity`, { valueAsNumber: true })} type="number" min="0.001" step="0.001" className="w-24 rounded-md border border-slate-300 px-2 py-2" /></td><td className="p-3"><input {...register(`items.${index}.unit_price`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="w-28 rounded-md border border-slate-300 px-2 py-2" /></td><td className="p-3"><input {...register(`items.${index}.discount_percent`, { valueAsNumber: true })} type="number" min="0" max="100" step="0.01" className="w-24 rounded-md border border-slate-300 px-2 py-2" /></td><td className="p-3 text-right font-semibold">₹{amount.toFixed(2)}</td><td className="p-3"><button type="button" onClick={() => remove(index)} className="text-xs font-medium text-red-700">Remove</button></td></tr>; })}</tbody></table>{fields.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Scan or search a product to add it to the bill.</p>}</section>
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="rounded-xl border border-slate-200 bg-white p-4"><label className="text-sm font-medium text-slate-700">Invoice discount (taxable value)<input {...register("invoice_discount_amount", { valueAsNumber: true })} type="number" min="0" step="0.01" className="mt-1.5 block w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2.5" /></label><p className="mt-2 text-xs text-slate-500">Pricing mode: {pricesIncludeTax ? "GST-inclusive" : "GST-exclusive"}. Discount and GST totals are recalculated when the invoice is posted.</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="flex justify-between text-sm text-slate-600"><span>Subtotal preview</span><span>₹{subtotal.toFixed(2)}</span></p><p className="mt-2 flex justify-between text-sm text-slate-600"><span>Invoice discount</span><span>−₹{invoiceDiscount.toFixed(2)}</span></p><p className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-lg font-bold"><span>Estimated total*</span><span>₹{previewTotal.toFixed(2)}</span></p><label className="mt-4 block text-sm font-medium text-slate-700">Amount received<input {...register("payment_amount", { valueAsNumber: true })} type="number" min="0" step="0.01" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label></div></div>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}<button disabled={pending} className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving invoice…" : "Save invoice draft"}</button><p className="text-xs text-slate-500">*GST is not included in this preview. The database calculates final amounts and checks available stock before posting.</p>
  </form>;
}
