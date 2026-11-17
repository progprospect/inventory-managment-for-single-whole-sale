import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDateString, indiaDateString, indiaDayBounds, indiaMonthStart } from "@/lib/time/india";

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) return <main className="p-8">Configure Supabase to view audit logs.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (!["owner_admin", "manager"].includes(role?.role ?? "")) return <main className="p-8"><h1 className="text-2xl font-bold">Audit logs</h1><p className="mt-3 text-sm text-slate-600">Only the owner/admin and manager roles can view audit events.</p></main>;
  const today = indiaDateString();
  const requestedFrom = isDateString(params.from) ? params.from : indiaMonthStart(today);
  const requestedTo = isDateString(params.to) ? params.to : today;
  const from = requestedFrom <= requestedTo ? requestedFrom : indiaMonthStart(today);
  const to = requestedFrom <= requestedTo ? requestedTo : today;
  const { data: logs, error } = await supabase.from("audit_logs").select("id,actor_id,action,entity_type,entity_id,details,created_at").gte("created_at", indiaDayBounds(from).start).lt("created_at", indiaDayBounds(to).end).order("created_at", { ascending: false }).limit(500);
  const actorIds = [...new Set((logs ?? []).map((log) => log.actor_id).filter(Boolean))] as string[];
  const { data: actors } = await supabase.from("profiles").select("id,full_name,email").in("id", actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]);
  const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name || actor.email || "User"]));
  return <main className="mx-auto max-w-7xl p-6 md:p-10"><Link href="/" className="text-sm text-blue-700">&larr; Dashboard</Link><h1 className="mt-3 text-2xl font-bold">Audit logs</h1><p className="mb-6 mt-1 text-sm text-slate-500">Authentication and sensitive business changes recorded by the database.</p><form className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"><label className="text-xs font-medium text-slate-600">From<input type="date" name="from" defaultValue={from} className="mt-1 block rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label><label className="text-xs font-medium text-slate-600">To<input type="date" name="to" defaultValue={to} className="mt-1 block rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply dates</button></form><section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">{error ? <p className="p-5 text-sm text-red-700">Could not load audit events.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Date / time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{(logs ?? []).map((log) => <tr key={log.id}><td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(log.created_at))}</td><td className="px-4 py-3">{log.actor_id ? actorMap.get(log.actor_id) ?? "Former user" : "System"}</td><td className="px-4 py-3 font-medium">{log.action.replaceAll("_", " ")}</td><td className="px-4 py-3 text-xs text-slate-500">{log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0,8)}` : ""}</td><td className="max-w-md truncate px-4 py-3 text-xs text-slate-500">{JSON.stringify(log.details)}</td></tr>)}</tbody></table>}{!error && logs?.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No events found in this date range.</p>}</section></main>;
}
