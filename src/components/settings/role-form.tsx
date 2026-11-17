"use client";

import { useActionState } from "react";
import { changeUserRole } from "@/app/actions/users";

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action, pending] = useActionState(async (_previous: { error?: string; success?: string }, data: FormData) => changeUserRole(data), {});
  return <form action={action} className="flex items-center gap-2"><input type="hidden" name="user_id" value={userId} /><select aria-label="User role" name="role" defaultValue={role} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"><option value="owner_admin">Owner/Admin</option><option value="manager">Manager</option><option value="billing_staff">Billing staff</option><option value="inventory_staff">Inventory staff</option></select><button disabled={pending} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{pending ? "Saving" : "Save"}</button>{state.error && <span role="alert" className="text-xs text-red-700">{state.error}</span>}{state.success && <span role="status" className="text-xs text-green-700">Saved</span>}</form>;
}
