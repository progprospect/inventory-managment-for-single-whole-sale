"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createProduct, updateProduct } from "@/app/actions/products";
import { productSchema, type ProductInput } from "@/lib/validation/product";
import type { z } from "zod";

type Option = { id: string; name: string; abbreviation?: string };
type ProductFormInput = z.input<typeof productSchema>;
export function ProductForm({ units, categories, initial }: { units: Option[]; categories: Option[]; initial?: ProductInput }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormInput, unknown, ProductInput>({ resolver: zodResolver(productSchema), defaultValues: initial ?? { sku: "", barcode: "", name: "", description: "", category_id: "", unit_id: "", purchase_price: 0, wholesale_price: 0, alternate_price: undefined, gst_rate: 0, hsn_code: "", opening_stock: 0, minimum_stock: 0 } });
  const submit = handleSubmit((values) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined) formData.set(key, String(value));
    startTransition(async () => {
      const result = initial?.id ? await updateProduct(formData) : await createProduct(formData);
      if ("id" in result && result.id) window.location.assign(`/products/${result.id}`);
      else setMessage(result);
    });
  });
  const field = (name: keyof ProductInput, label: string, type = "text", step?: string) => <label className="block text-sm font-medium text-slate-700">{label}<input {...register(name, type === "number" ? { valueAsNumber: true } : {})} type={type} step={step} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />{errors[name] && <span className="mt-1 block text-xs text-red-600">{String(errors[name]?.message)}</span>}</label>;
  return <form onSubmit={submit} className="space-y-5">
    {initial?.id && <input type="hidden" {...register("id")} />}
    <div className="grid gap-4 md:grid-cols-2">{field("name", "Product name")}{field("sku", "SKU (leave blank to generate)")}{field("barcode", "Barcode")}
      <label className="block text-sm font-medium text-slate-700">Unit<select {...register("unit_id")} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Select unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select>{errors.unit_id && <span className="mt-1 block text-xs text-red-600">{errors.unit_id.message}</span>}</label>
      <label className="block text-sm font-medium text-slate-700">Category<select {...register("category_id")} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      {field("purchase_price", "Purchase price", "number", "0.01")}{field("wholesale_price", "Wholesale price", "number", "0.01")}{field("alternate_price", "Alternate price", "number", "0.01")}{field("gst_rate", "GST rate (%)", "number", "0.01")}{field("hsn_code", "HSN/SAC code")}{field("minimum_stock", "Minimum stock", "number", "0.001")}{!initial?.id && field("opening_stock", "Opening stock", "number", "0.001")}</div>
    {field("description", "Description")}
    {message.error && <p role="alert" className="text-sm text-red-700">{message.error}</p>}{message.success && <p role="status" className="text-sm text-green-700">{message.success}</p>}
    <button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : initial?.id ? "Save product" : "Create product"}</button>
  </form>;
}
