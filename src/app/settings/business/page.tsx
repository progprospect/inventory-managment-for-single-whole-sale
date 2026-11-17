import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/settings/business-form";
import type { BusinessSettingsInput } from "@/lib/validation/business";

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Business profile</h1><p className="mt-3 text-slate-600">Configure Supabase in <code>.env.local</code> and apply the foundation migration to manage business details.</p></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (role?.role !== "owner_admin") return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Business profile</h1><p className="mt-3 text-slate-600">Only an owner/admin can edit business settings.</p><Link className="mt-4 inline-block text-blue-700" href="/">Return to dashboard</Link></main>;
  const { data } = await supabase.from("business_settings").select("*").eq("id", 1).single();
  if (!data) return <main className="p-8"><h1 className="text-xl font-bold">Business settings unavailable</h1><p className="mt-2 text-slate-600">Apply the Supabase migration and reload this page.</p></main>;
  const initial: BusinessSettingsInput = {
    shop_name: data.shop_name, address: data.address, phone: data.phone, email: data.email, gstin: data.gstin,
    state: data.state, state_code: data.state_code, invoice_prefix: data.invoice_prefix,
    default_gst_rate: Number(data.default_gst_rate), prices_include_tax: data.prices_include_tax,
    invoice_footer: data.invoice_footer, invoice_terms: data.invoice_terms,
  };
  return <main className="mx-auto max-w-4xl p-6 md:p-10"><div className="mb-7"><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold tracking-tight">Business profile</h1><p className="mt-1 text-sm text-slate-500">Shop details and default tax behavior used on invoices.</p></div><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><BusinessForm initial={initial} /></section></main>;
}
