import Link from "next/link";
import { ActionForm } from "@/components/auth/action-form";
import { sendPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  return <main className="grid min-h-screen place-items-center px-5"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-xl font-bold">Reset your password</h1><p className="mb-6 mt-2 text-sm text-slate-500">We’ll send a reset link if the account exists.</p><ActionForm action={sendPasswordReset} button="Send reset link" /><Link className="mt-5 block text-center text-sm font-medium text-blue-700" href="/login">Back to sign in</Link></section></main>;
}
