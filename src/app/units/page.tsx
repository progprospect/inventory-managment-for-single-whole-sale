import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UnitForm } from "@/components/catalog/catalog-form";

export default async function UnitsPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to manage units.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: units, error } = await supabase.from("units").select("id,name,abbreviation,base_unit_id,factor_to_base,archived_at").order("name");
  const unitMap = new Map((units ?? []).map((unit) => [unit.id, unit]));
  const active = (units ?? []).filter((unit) => !unit.archived_at);
  return <main className="mx-auto max-w-5xl p-6 md:p-10"><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Product units</h1><p className="mb-6 mt-1 text-sm text-slate-500">Define base units and optional conversion factors for packs and cartons.</p><section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><UnitForm units={active} /></section><section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load units.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Unit</th><th className="px-5 py-3">Abbreviation</th><th className="px-5 py-3">Conversion</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{(units ?? []).map((unit) => <tr key={unit.id}><td className="px-5 py-4 font-semibold">{unit.name}</td><td className="px-5 py-4 text-slate-600">{unit.abbreviation}</td><td className="px-5 py-4 text-slate-600">{unit.base_unit_id ? `1 ${unit.abbreviation} = ${Number(unit.factor_to_base)} ${unitMap.get(unit.base_unit_id)?.abbreviation ?? "base units"}` : "Base unit"}</td><td className="px-5 py-4">{unit.archived_at ? "Archived" : "Active"}</td></tr>)}</tbody></table>}</section></main>;
}
