import { ActionForm } from "@/components/auth/action-form";
import { updatePassword } from "@/app/actions/auth";

export default function ResetPasswordPage() {
  return <main className="grid min-h-screen place-items-center px-5"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-xl font-bold">Choose a new password</h1><p className="mb-6 mt-2 text-sm text-slate-500">Use at least 10 characters.</p><ActionForm action={updatePassword} button="Update password" password /></section></main>;
}
