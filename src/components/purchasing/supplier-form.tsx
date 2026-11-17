"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { createSupplier } from "@/app/actions/purchasing";
import { supplierSchema } from "@/lib/validation/purchasing";
import type { z } from "zod";

type Values = z.input<typeof supplierSchema>;
type State = { error?: string; success?: string };
export function SupplierForm() {
  const [state, action, pending] = useActionState(async (_previous: State, data: FormData) => createSupplier(data), {});
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(supplierSchema), defaultValues: { name: "", contact_person: "", phone: "", email: "", address: "", gstin: "", state: "", state_code: "", opening_balance: 0 } });
  const submit = handleSubmit((_values, event) => { if (event?.target instanceof HTMLFormElement) action(new FormData(event.target)); });
  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
    {([ ["name","Supplier name"], ["contact_person","Contact person"], ["phone","Phone"], ["email","Email"], ["gstin","GSTIN"], ["state","State"], ["state_code","State code"], ["opening_balance","Opening balance"] ] as const).map(([key,label]) => <label key={key} className="text-sm font-medium text-slate-700">{label}<input {...register(key, key === "opening_balance" ? { valueAsNumber: true } : {})} type={key === "email" ? "email" : key === "opening_balance" ? "number" : "text"} step={key === "opening_balance" ? "0.01" : undefined} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />{errors[key] && <span className="mt-1 block text-xs text-red-600">{String(errors[key]?.message)}</span>}</label>)}
    <label className="text-sm font-medium text-slate-700 md:col-span-2">Address<textarea {...register("address")} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
    {state.error && <p role="alert" className="text-sm text-red-700 md:col-span-2">{state.error}</p>}{state.success && <p role="status" className="text-sm text-green-700 md:col-span-2">{state.success}</p>}
    <button disabled={pending} className="w-fit rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">{pending ? "Saving…" : "Add supplier"}</button>
  </form>;
}
