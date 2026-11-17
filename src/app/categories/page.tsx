import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "@/components/catalog/catalog-form";
import { archiveCategory } from "@/app/actions/catalog";

export default async function CategoriesPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to manage categories.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: categories, error } = await supabase.from("categories").select("id,name,description,created_at").is("archived_at", null).order("name");
  return <main className="mx-auto max-w-5xl p-6 md:p-10"><Link href="/" className="text-sm text-blue-700">← Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Categories</h1><p className="mb-6 mt-1 text-sm text-slate-500">Organize products for faster catalogue search and reporting.</p><section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><CategoryForm /></section><section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load categories.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{(categories ?? []).map((category) => <tr key={category.id}><td className="px-5 py-4 font-semibold">{category.name}</td><td className="px-5 py-4 text-slate-600">{category.description || "—"}</td><td className="px-5 py-4 text-slate-500">{new Date(category.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td className="px-5 py-4"><form action={archiveCategory}><input type="hidden" name="id" value={category.id} /><button className="text-xs font-semibold text-red-700">Archive</button></form></td></tr>)}</tbody></table>}{!error && categories?.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No product categories created yet.</p>}</section></main>;
}
