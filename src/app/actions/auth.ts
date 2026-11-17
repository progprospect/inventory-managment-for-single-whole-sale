"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, resetSchema } from "@/lib/validation/auth";

export type ActionState = { error?: string; success?: string };

export async function signIn(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your sign-in details." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured. Add the project URL and anon key to .env.local." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Sign in failed. Check your email and password." };
  await supabase.rpc("log_user_login");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}

export async function sendPasswordReset(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured. Add the project URL and anon key to .env.local." };
  const origin = process.env.SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) return { error: "Could not send the reset email. Check Supabase Auth email settings." };
  return { success: "If an account exists for this email, a password reset link has been sent." };
}

export async function updatePassword(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 10) return { error: "Use a password with at least 10 characters." };
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Could not update the password. The reset link may have expired." };
  redirect("/");
}
