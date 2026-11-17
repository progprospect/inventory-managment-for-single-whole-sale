"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signIn, type ActionState } from "@/app/actions/auth";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";

const initial: ActionState = {};

export function LoginForm() {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const submit = handleSubmit((values) => {
    const data = new FormData();
    data.set("email", values.email);
    data.set("password", values.password);
    startTransition(async () => setState(await signIn(initial, data)));
  });
  return <form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-medium text-slate-700">Email address<input {...register("email")} name="email" type="email" autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />{errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}</label>
    <label className="block text-sm font-medium text-slate-700">Password<input {...register("password")} name="password" type="password" autoComplete="current-password" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />{errors.password && <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>}</label>
    {(state.error || errors.root?.message) && <p role="alert" className="text-sm text-red-700">{state.error || errors.root?.message}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
