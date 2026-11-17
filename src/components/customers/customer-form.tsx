"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { createCustomer } from "@/app/actions/customers";
import { customerSchema } from "@/lib/validation/customer";
import type { z } from "zod";

type Values = z.input<typeof customerSchema>;
type Parsed = z.infer<typeof customerSchema>;
export function CustomerForm({ onCreated }: { onCreated?: (id: string) => void }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<Values, unknown, Parsed>({ resolver: zodResolver(customerSchema), defaultValues: { name: "", phone: "", email: "", billing_address: "", state: "", state_code: "", gstin: "", customer_type: "wholesale", opening_balance: 0 } });
  const submit = handleSubmit((_values, event) => {
    if (!(event?.target instanceof HTMLFormElement)) return;
    const formData = new FormData(event.target);
    startTransition(async () => {
      const result = await createCustomer(formData);
      setMessage(result);
      if (result.id) onCreated?.(result.id);
    });
  });
  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
    {([ ["name","Customer name"], ["phone","Phone"], ["email","Email"], ["gstin","GSTIN"], ["state","State"], ["state_code","State code"], ["opening_balance","Opening balance"] ] as const).map(([key,label]) => <label key={key} className="text-sm font-medium text-slate-700">{label}<input {...register(key, key === "opening_balance" ? { valueAsNumber: true } : {})} type={key === "email" ? "email" : key === "opening_balance" ? "number" : "text"} step={key === "opening_balance" ? "0.01" : undefined} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />{errors[key] && <span className="mt-1 block text-xs text-red-600">{String(errors[key]?.message)}</span>}</label>)}
    <label className="text-sm font-medium text-slate-700">Customer type<select {...register("customer_type")} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="wholesale">Wholesale</option><option value="retail">Retail</option><option value="business">Business</option></select></label>
    <label className="text-sm font-medium text-slate-700 md:col-span-2">Billing address<textarea {...register("billing_address")} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
    {message.error && <p role="alert" className="text-sm text-red-700 md:col-span-2">{message.error}</p>}{message.success && <p role="status" className="text-sm text-green-700 md:col-span-2">{message.success}</p>}
    <button disabled={pending} className="w-fit rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">{pending ? "Saving…" : "Add customer"}</button>
  </form>;
}
