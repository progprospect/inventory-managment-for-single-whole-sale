import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/");
  }
  return <main className="grid min-h-screen place-items-center px-5 py-10"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <div className="mb-7 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-blue-700 text-white"><Boxes size={21} /></div><div><h1 className="font-bold">Wholesale Desk</h1><p className="text-xs text-slate-500">Inventory & billing</p></div></div>
    <h2 className="text-xl font-bold text-slate-900">Sign in to your account</h2><p className="mt-1 mb-6 text-sm text-slate-500">Use the account provided by your shop administrator.</p>
    <LoginForm /><p className="mt-5 text-center text-sm"><Link className="font-medium text-blue-700 hover:underline" href="/forgot-password">Forgot your password?</Link></p>
  </section></main>;
}
