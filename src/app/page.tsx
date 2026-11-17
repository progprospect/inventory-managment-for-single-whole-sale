import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, PackageSearch, Tags, Ruler, ShoppingCart, Truck, ReceiptText, UserRound, RotateCcw, Settings, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { indiaDateString, indiaDayBounds, indiaMonthStart } from "@/lib/time/india";

const navigation = [
  ["Dashboard", "/", Boxes], ["Products", "/products", Boxes], ["Inventory", "/inventory", PackageSearch],
  ["Categories", "/categories", Tags], ["Units", "/units", Ruler], ["Purchases", "/purchases", ShoppingCart],
  ["Suppliers", "/suppliers", Truck], ["Sales & billing", "/billing", ShoppingCart], ["Invoices", "/invoices", ReceiptText],
  ["Customers", "/customers", UserRound], ["Returns", "/returns", RotateCcw], ["Reports", "/reports", ReceiptText],
  ["Audit logs", "/audit-logs", ReceiptText], ["User management", "/settings/users", Users], ["Business settings", "/settings/business", Settings],
] as const;

export default async function DashboardPage() {
  const today = indiaDateString();
  const nowHour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const greeting = nowHour < 12 ? "Good morning" : nowHour < 17 ? "Good afternoon" : "Good evening";
  const supabase = await createClient();
  let userName = "";
  let stats: Record<string, number | string> | null = null;
  let recentInvoices: { id: string; invoice_number: string; customer_name: string; grand_total: number | string; invoice_date: string }[] = [];
  let recentPurchases: { id: string; receipt_number: number; supplier_invoice_number: string; grand_total: number | string; posted_at: string; suppliers: unknown }[] = [];
  let loadError = false;
  let role = "";
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    userName = profile?.full_name ?? "";
    role = roleRow?.role ?? "";
    const day = indiaDayBounds(today);
    const month = new Date(`${indiaMonthStart(today)}T00:00:00+05:30`).toISOString();
    const [summary, salesRows, purchaseRows] = await Promise.all([
      supabase.rpc("dashboard_summary", { day_start: day.start, month_start: month }),
      supabase.from("sales_invoices").select("id,invoice_number,customer_name,grand_total,invoice_date").eq("status", "posted").order("invoice_date", { ascending: false }).limit(5),
      supabase.from("purchase_receipts").select("id,receipt_number,supplier_invoice_number,grand_total,posted_at,suppliers(name)").eq("status", "posted").order("posted_at", { ascending: false }).limit(5),
    ]);
    stats = summary.data as Record<string, number | string> | null;
    recentInvoices = salesRows.data ?? [];
    recentPurchases = purchaseRows.data ?? [];
    loadError = Boolean(summary.error);
  }
  const inr = (value: unknown) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value ?? 0));
  const canSales = ["owner_admin", "manager", "billing_staff"].includes(role);
  const cards = [
    ...( ["owner_admin", "manager", "billing_staff"].includes(role) ? [
      ["Today's sales", inr(stats?.today_sales), "Posted invoices today", "text-blue-700 bg-blue-50"],
      ["This month", inr(stats?.month_sales), "Posted sales", "text-violet-700 bg-violet-50"],
    ] : []),
    ...( ["owner_admin", "manager", "inventory_staff"].includes(role) ? [["Purchases this month", inr(stats?.month_purchases), "Posted receipts", "text-green-700 bg-green-50"]] : []),
    ["Stock at cost", inr(stats?.stock_value), "Current stock balance × purchase cost", "text-amber-700 bg-amber-50"],
  ];
  const visibleNavigation = supabase ? navigation.filter(([, href]) => {
    if (["/purchases", "/suppliers", "/categories", "/units"].includes(href)) return ["owner_admin", "manager", "inventory_staff"].includes(role);
    if (["/billing", "/invoices", "/customers"].includes(href)) return ["owner_admin", "manager", "billing_staff"].includes(role);
    if (["/settings/users", "/settings/business"].includes(href)) return role === "owner_admin";
    if (href === "/audit-logs") return ["owner_admin", "manager"].includes(role);
    return true;
  }) : navigation;
  return <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[248px_1fr]">
    <aside className="border-r border-slate-200 bg-white px-4 py-5 lg:min-h-screen"><div className="mb-7 flex items-center gap-3 px-2"><div className="grid size-10 place-items-center rounded-xl bg-blue-700 text-white"><Boxes size={21} /></div><div><p className="text-sm font-bold tracking-tight">Wholesale Desk</p><p className="mt-0.5 text-xs text-slate-500">Inventory & billing</p></div></div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p><nav className="space-y-1" aria-label="Main navigation">{visibleNavigation.map(([label, href, Icon]) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${href === "/" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={17} strokeWidth={1.8} />{label}</Link>)}</nav>{supabase && <form action={signOut} className="mt-7 border-t border-slate-100 pt-4"><button className="px-3 py-2 text-sm font-medium text-slate-600">Sign out</button></form>}</aside>
    <section className="px-5 py-7 md:px-8 lg:px-10"><header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium text-slate-500">{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date())}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{greeting}{userName ? `, ${userName.split(" ")[0]}` : ""}</h1><p className="mt-1 text-sm text-slate-500">Your shop&apos;s activity at a glance.</p></div>{canSales && <Link href="/billing" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm">Create sale</Link>}</header>
      {!supabase && <section className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-semibold text-blue-900">Connect your development database</h2><p className="mt-2 text-sm leading-6 text-blue-800">This dashboard does not use sample business data. Add your Supabase URL and anon key to <code>.env.local</code>, apply the migrations, then restart the server to sign in.</p></section>}
      {supabase && loadError && <section role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Dashboard data is unavailable. Check that all migrations have been applied.</section>}
      {supabase && stats && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,note,tone]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`grid size-9 place-items-center rounded-lg ${tone}`}><ReceiptText size={18} /></span></div><p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Low stock</p><p className="mt-1 text-xl font-bold text-amber-700">{stats.low_stock_count ?? 0}</p></article><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Out of stock</p><p className="mt-1 text-xl font-bold text-red-700">{stats.out_of_stock_count ?? 0}</p></article><article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Outstanding customer balance</p><p className="mt-1 text-xl font-bold">{inr(stats.outstanding_balance)}</p><p className="mt-1 text-xs text-slate-500">{stats.open_invoices ?? 0} open invoices</p></article></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between"><div><h2 className="text-sm font-bold">Recent invoices</h2><p className="mt-1 text-xs text-slate-500">Latest posted sales</p></div><Link href="/invoices" className="text-xs font-semibold text-blue-700">View all</Link></div>{recentInvoices.length ? <div className="divide-y divide-slate-100">{recentInvoices.map((invoice) => <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="flex justify-between py-3 text-sm"><span><span className="block font-semibold">{invoice.invoice_number}</span><span className="text-xs text-slate-500">{invoice.customer_name} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(invoice.invoice_date))}</span></span><span className="font-semibold">{inr(invoice.grand_total)}</span></Link>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No posted invoices.</p>}</section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between"><div><h2 className="text-sm font-bold">Recent purchases</h2><p className="mt-1 text-xs text-slate-500">Latest posted receipts</p></div><Link href="/purchases" className="text-xs font-semibold text-blue-700">View all</Link></div>{recentPurchases.length ? <div className="divide-y divide-slate-100">{recentPurchases.map((purchase) => { const supplier = purchase.suppliers as unknown as { name: string } | null; return <Link key={purchase.id} href={`/purchases/${purchase.id}`} className="flex justify-between py-3 text-sm"><span><span className="block font-semibold">PUR-{purchase.receipt_number}</span><span className="text-xs text-slate-500">{supplier?.name ?? "Supplier"} · {purchase.supplier_invoice_number}</span></span><span className="font-semibold">{inr(purchase.grand_total)}</span></Link>; })}</div> : <p className="py-8 text-center text-sm text-slate-500">No posted purchase receipts.</p>}</section></div></>}
    </section>
  </main>;
}
