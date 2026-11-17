"use client";

import { useState, useTransition } from "react";
import { postPurchase } from "@/app/actions/purchasing";

export function PostPurchaseForm({ purchaseId }: { purchaseId: string }) {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  return <form onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("purchase_id", purchaseId);
    formData.set("request_key", crypto.randomUUID());
    startTransition(async () => setMessage(await postPurchase(formData)));
  }} className="space-y-3"><button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Posting…" : "Confirm receipt and update stock"}</button>{message.error && <p role="alert" className="text-sm text-red-700">{message.error}</p>}{message.success && <p role="status" className="text-sm text-green-700">{message.success}</p>}</form>;
}
