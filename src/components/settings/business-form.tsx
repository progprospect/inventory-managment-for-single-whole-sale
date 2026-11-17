"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { updateBusinessSettings } from "@/app/actions/business";
import { businessSettingsSchema, type BusinessSettingsInput } from "@/lib/validation/business";

type FormValues = BusinessSettingsInput;
const textFields: { name: keyof FormValues; label: string; type?: string }[] = [
  { name: "shop_name", label: "Shop name" }, { name: "phone", label: "Phone" }, { name: "email", label: "Email", type: "email" },
  { name: "gstin", label: "GSTIN" }, { name: "state", label: "State" }, { name: "state_code", label: "State code" },
  { name: "invoice_prefix", label: "Invoice prefix" }, { name: "default_gst_rate", label: "Default GST rate (%)", type: "number" },
];

export function BusinessForm({ initial }: { initial: FormValues }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(businessSettingsSchema), defaultValues: initial });
  const submit = handleSubmit((values) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "boolean") { if (value) formData.set(key, "on"); }
      else if (value !== null && value !== undefined) formData.set(key, String(value));
    }
    startTransition(async () => setMessage(await updateBusinessSettings(formData)));
  });
  return <form onSubmit={submit} className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2">{textFields.map(({ name, label, type }) => <label key={name} className="block text-sm font-medium text-slate-700">{label}<input {...register(name, type === "number" ? { valueAsNumber: true } : {})} type={type ?? "text"} step={type === "number" ? "0.01" : undefined} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600" />{errors[name] && <span className="mt-1 block text-xs text-red-600">{String(errors[name]?.message)}</span>}</label>)}</div>
    <label className="block text-sm font-medium text-slate-700">Business address<textarea {...register("address")} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" {...register("prices_include_tax")} className="size-4 accent-blue-700" />Product selling prices include GST</label>
    <label className="block text-sm font-medium text-slate-700">Invoice footer<textarea {...register("invoice_footer")} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
    <label className="block text-sm font-medium text-slate-700">Invoice terms<textarea {...register("invoice_terms")} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
    {message.error && <p role="alert" className="text-sm text-red-700">{message.error}</p>}{message.success && <p role="status" className="text-sm text-green-700">{message.success}</p>}
    <button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save business profile"}</button>
  </form>;
}
