import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm } from "@/components/purchasing/supplier-form";

export default async function SuppliersPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to manage suppliers.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: suppliers, error } = await supabase.from("suppliers").select("id,name,contact_person,phone,email,gstin,state,opening_balance").eq("is_archived", false).order("name");
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><div className="mb-6"><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Suppliers</h1><p className="mt-1 text-sm text-slate-500">Supplier contacts, tax details, and opening balances.</p></div><section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold">Add supplier</h2><SupplierForm /></section><section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load suppliers.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">GSTIN</th><th className="px-5 py-3">State</th><th className="px-5 py-3 text-right">Opening balance</th></tr></thead><tbody className="divide-y divide-slate-100">{(suppliers ?? []).map((supplier) => <tr key={supplier.id}><td className="px-5 py-4 font-semibold">{supplier.name}</td><td className="px-5 py-4 text-slate-600">{supplier.contact_person || "—"}</td><td className="px-5 py-4 text-slate-600">{supplier.phone || "—"}</td><td className="px-5 py-4 text-slate-600">{supplier.gstin || "—"}</td><td className="px-5 py-4 text-slate-600">{supplier.state || "—"}</td><td className="px-5 py-4 text-right">₹{Number(supplier.opening_balance).toFixed(2)}</td></tr>)}</tbody></table>}{!error && suppliers?.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No suppliers yet. Add a supplier before recording a purchase.</p>}</section></main>;
}
