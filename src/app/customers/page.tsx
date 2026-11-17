import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/components/customers/customer-form";

export default async function CustomersPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to manage customers.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: customers, error } = await supabase.from("customers").select("id,name,phone,email,gstin,state,customer_type,opening_balance").eq("is_archived", false).order("name").limit(500);
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><div className="mb-6"><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Customers</h1><p className="mt-1 text-sm text-slate-500">Customer contact details and GST information.</p></div><section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold">Add customer</h2><CustomerForm /></section><section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load customers.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">GSTIN</th><th className="px-5 py-3">State</th><th className="px-5 py-3">Type</th><th className="px-5 py-3 text-right">Opening balance</th></tr></thead><tbody className="divide-y divide-slate-100">{(customers ?? []).map((customer) => <tr key={customer.id}><td className="px-5 py-4 font-semibold">{customer.name}</td><td className="px-5 py-4">{customer.phone || "—"}</td><td className="px-5 py-4">{customer.email || "—"}</td><td className="px-5 py-4">{customer.gstin || "—"}</td><td className="px-5 py-4">{customer.state || "—"}</td><td className="px-5 py-4 capitalize">{customer.customer_type}</td><td className="px-5 py-4 text-right">₹{Number(customer.opening_balance).toFixed(2)}</td></tr>)}</tbody></table>}{!error && customers?.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No customers yet.</p>}</section></main>;
}
