"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/auth";

export function ActionForm({ action, button, password = false }: { action: (state: ActionState, data: FormData) => Promise<ActionState>; button: string; password?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="space-y-4">
    <label className="block text-sm font-medium text-slate-700">{password ? "New password" : "Email address"}<input required name={password ? "password" : "email"} type={password ? "password" : "email"} minLength={password ? 10 : undefined} autoComplete={password ? "new-password" : "email"} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Please wait…" : button}</button>
  </form>;
}
