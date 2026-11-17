"use client";

import { useActionState } from "react";
import { saveCategory, saveUnit } from "@/app/actions/catalog";

type State = { error?: string; success?: string };
export function CategoryForm() {
  const [state, action, pending] = useActionState(async (_previous: State, data: FormData) => saveCategory(data), {});
  return <form action={action} className="flex flex-wrap items-end gap-3"><label className="min-w-52 flex-1 text-sm font-medium">Category name<input name="name" required maxLength={100} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label className="min-w-52 flex-1 text-sm font-medium">Description<input name="description" maxLength={500} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">{pending ? "Saving…" : "Add category"}</button>{state.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="w-full text-sm text-green-700">{state.success}</p>}</form>;
}

export function UnitForm({ units }: { units: { id: string; name: string; abbreviation: string }[] }) {
  const [state, action, pending] = useActionState(async (_previous: State, data: FormData) => saveUnit(data), {});
  return <form action={action} className="grid gap-3 md:grid-cols-2"><label className="text-sm font-medium">Unit name<input name="name" required maxLength={60} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Case" /></label><label className="text-sm font-medium">Abbreviation<input name="abbreviation" required maxLength={12} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="cs" /></label><label className="text-sm font-medium">Base unit<select name="base_unit_id" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">This is a base unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select></label><label className="text-sm font-medium">Quantity in base units<input name="factor_to_base" type="number" min="0.000001" step="0.000001" defaultValue="1" required className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5" /><span className="mt-1 block text-xs text-slate-500">For example, 1 carton may contain 24 pieces.</span></label><button disabled={pending} className="w-fit rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">{pending ? "Saving…" : "Add unit"}</button>{state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}</form>;
}
