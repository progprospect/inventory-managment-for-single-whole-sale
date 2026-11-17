import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleForm } from "@/components/settings/role-form";

export default async function UserSettingsPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8"><h1 className="text-2xl font-bold">User management</h1><p className="mt-3 text-slate-600">Configure Supabase and apply the foundation migration to manage staff.</p></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: ownRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (ownRole?.role !== "owner_admin") return <main className="p-8"><h1 className="text-2xl font-bold">User management</h1><p className="mt-3 text-slate-600">Only an owner/admin can manage staff roles.</p></main>;
  const { data: profiles, error } = await supabase.from("profiles").select("id,full_name,email,user_roles(role)").order("created_at");
  return <main className="mx-auto max-w-5xl p-6 md:p-10"><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">User management</h1><p className="mb-6 mt-1 text-sm text-slate-500">Assign least-privilege access to staff accounts. Add accounts through Supabase Auth, then assign roles here.</p>
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load users. Apply the foundation migration and retry.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Staff member</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th></tr></thead><tbody className="divide-y divide-slate-100">{(profiles ?? []).map((profile) => { const roles = profile.user_roles as unknown as { role: string } | { role: string }[] | null; const role = Array.isArray(roles) ? roles[0]?.role : roles?.role; return <tr key={profile.id}><td className="px-5 py-4 font-medium text-slate-800">{profile.full_name || "Unnamed user"}{profile.id === user.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td><td className="px-5 py-4 text-slate-600">{profile.email}</td><td className="px-5 py-4"><RoleForm userId={profile.id} role={role ?? "billing_staff"} /></td></tr>; })}</tbody></table>}</section>
  </main>;
}
