"use client";

import { useState, useTransition } from "react";
import { postSale } from "@/app/actions/sales";

export function PostSaleForm({ invoiceId }: { invoiceId: string }) {
  const [message, setMessage] = useState<{ error?: string; success?: string; invoiceNumber?: string }>({});
  const [pending, startTransition] = useTransition();
  return <form onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("invoice_id", invoiceId);
    formData.set("request_key", crypto.randomUUID());
    startTransition(async () => setMessage(await postSale(formData)));
  }} className="space-y-3"><button disabled={pending} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Posting invoice…" : "Confirm sale and post invoice"}</button>{message.error && <p role="alert" className="text-sm text-red-700">{message.error}</p>}{message.success && <p role="status" className="text-sm text-green-700">{message.success} {message.invoiceNumber}</p>}</form>;
}
